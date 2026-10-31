// Radiation system ported from HBM's Nuclear Tech Mod (LGPL-3.0).
// Numbers follow HazardRegistry, HazmatRegistry and EntityEffectHandler of the original.
import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { falloutRads } from "./fallout.js";
import { IMPORTED_RADS } from "./imported_rads.js";

/** RAD per second emitted by one item: isotope activity * form multiplier (HazardRegistry). */
const ITEM_RADS = {
  ...IMPORTED_RADS,
  "hbm:ore_uranium": 0.35,
  "hbm:ingot_uranium": 0.35,
  "hbm:nugget_uranium": 0.035,
  "hbm:powder_uranium": 0.35 * 3,
  "hbm:block_uranium": 3.5,
  "hbm:ore_thorium": 0.1,
  "hbm:ingot_th232": 0.1,
  "hbm:powder_thorium": 0.1 * 3,
  "hbm:nugget_pu239": 0.5,
  "hbm:ingot_pu239": 5.0,
  "hbm:rod_uranium": 0.35 * 3,
  // Spent fuel is far hotter than fresh uranium, like HBM's depleted rods and nuclear waste.
  "hbm:rod_uranium_depleted": 5.0,
  "hbm:det_nuke": 5.0 * 4,
  "hbm:missile_nuclear": 5.0 * 4,
  "hbm:grenade_nuclear": 0.5 * 1.5,
  "hbm:rbmk_fuel_ueu": 0.35 * 6,
  "hbm:rbmk_fuel_depleted": 15.0,
  // Reactor debris is the most radioactive thing in HBM; holding it is deadly within seconds.
  "hbm:rbmk_debris": 100.0,
};

/** Hazmat resistance per piece: hazYellow (0.6) * slot share (HazmatRegistry). */
const ARMOR_RESISTANCE = {
  "hbm:hazmat_helmet": 0.6 * 0.2,
  "hbm:hazmat_plate": 0.6 * 0.4,
  "hbm:hazmat_legs": 0.6 * 0.3,
  "hbm:hazmat_boots": 0.6 * 0.1,
};
const ARMOR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];

const RADX_RESISTANCE = 0.2;
const RADX_SECONDS = 3 * 60;
const RADAWAY_RADS = 140;
const RADAWAY_RATE = 20; // the original potion removes 1 RAD per tick
const MAX_RADS = 2500;

const PROP_RADS = "hbm:rads";
const PROP_RADX = "hbm:radx_seconds";
const PROP_RADAWAY = "hbm:radaway_left";

/** Incoming RAD/s per player id, read by the Geiger counter between radiation ticks. */
const radRate = new Map();

/** Adds a one-off dose, e.g. from a nuclear blast. @param {import("@minecraft/server").Player} player */
export function addRads(player, amount) {
  player.setDynamicProperty(PROP_RADS, Math.min(getNumber(player, PROP_RADS) + amount, MAX_RADS));
}

/** @param {import("@minecraft/server").Player} player @param {string} key */
function getNumber(player, key) {
  const value = player.getDynamicProperty(key);
  return typeof value === "number" ? value : 0;
}

/** @param {import("@minecraft/server").Player} player */
function inventoryRads(player) {
  let rads = 0;
  let hasGeiger = false;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (container) {
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (!item) continue;
      if (item.typeId === "hbm:geiger_counter") hasGeiger = true;
      rads += (ITEM_RADS[item.typeId] ?? 0) * item.amount;
    }
  }
  const offhand = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Offhand);
  if (offhand) {
    if (offhand.typeId === "hbm:geiger_counter") hasGeiger = true;
    rads += (ITEM_RADS[offhand.typeId] ?? 0) * offhand.amount;
  }
  return { rads, hasGeiger };
}

/** @param {import("@minecraft/server").Player} player */
function resistance(player) {
  let res = 0;
  const equippable = player.getComponent("minecraft:equippable");
  if (equippable) {
    for (const slot of ARMOR_SLOTS) {
      const piece = equippable.getEquipment(slot);
      if (piece) res += ARMOR_RESISTANCE[piece.typeId] ?? 0;
    }
  }
  if (getNumber(player, PROP_RADX) > 0) res += RADX_RESISTANCE;
  return res;
}

/** The original rolls 1/n every tick; this converts it to one roll per second. */
function chance(n) {
  return Math.random() < 20 / n;
}

/** @param {import("@minecraft/server").Player} player @param {number} rads */
function applySickness(player, rads) {
  if (rads >= 1000) {
    player.setDynamicProperty(PROP_RADS, 0);
    player.applyDamage(1000, { cause: EntityDamageCause.magic });
    return;
  }
  if (rads >= 600) {
    const strength = rads >= 800 ? 2 : 1;
    if (chance(300)) player.addEffect("nausea", 150);
    if (chance(300)) player.addEffect("slowness", 200, { amplifier: 2 });
    if (chance(300)) player.addEffect("weakness", 200, { amplifier: 2 });
    if (chance(500)) player.addEffect("poison", 60, { amplifier: strength });
    if (rads >= 800 && chance(700)) player.addEffect("wither", 60, { amplifier: 1 });
  } else if (rads >= 400) {
    if (chance(300)) player.addEffect("nausea", 150);
    if (chance(500)) player.addEffect("slowness", 100);
    if (chance(300)) player.addEffect("weakness", 100, { amplifier: 1 });
  } else if (rads >= 200) {
    if (chance(300)) player.addEffect("nausea", 100);
    if (chance(500)) player.addEffect("weakness", 100);
  }
}

/** @param {import("@minecraft/server").Player} player */
function radiationTick(player) {
  const { rads: emitted, hasGeiger } = inventoryRads(player);
  const ambient = falloutRads(player.dimension.id, player.location);
  const incoming = (emitted + ambient) * Math.pow(10, -resistance(player));
  radRate.set(player.id, incoming);

  let rads = getNumber(player, PROP_RADS) + incoming;

  const radaway = getNumber(player, PROP_RADAWAY);
  if (radaway > 0) {
    const removed = Math.min(radaway, RADAWAY_RATE);
    rads -= removed;
    player.setDynamicProperty(PROP_RADAWAY, radaway - removed);
  }
  const radx = getNumber(player, PROP_RADX);
  if (radx > 0) player.setDynamicProperty(PROP_RADX, radx - 1);

  rads = Math.min(Math.max(rads, 0), MAX_RADS);
  player.setDynamicProperty(PROP_RADS, rads);
  applySickness(player, rads);

  const held = player.getComponent("minecraft:equippable");
  const holdingGeiger =
    held?.getEquipment(EquipmentSlot.Mainhand)?.typeId === "hbm:geiger_counter" ||
    held?.getEquipment(EquipmentSlot.Offhand)?.typeId === "hbm:geiger_counter";
  if (hasGeiger && holdingGeiger) {
    player.onScreenDisplay.setActionBar({
      rawtext: [{ translate: "hbm.geiger.actionbar", with: [incoming.toFixed(2), rads.toFixed(1)] }],
    });
  }
}

/** Click pattern of ItemGeigerCounter: busier clicks as the incoming dose rises. */
function geigerClick(rate) {
  if (rate <= 1e-5) return Math.random() < 1 / 50 ? 1 : 0;
  const options = [];
  if (rate < 1) options.push(0);
  if (rate < 5) options.push(0);
  if (rate < 10) options.push(1);
  if (rate > 5 && rate < 15) options.push(2);
  if (rate > 10 && rate < 20) options.push(3);
  if (rate > 15 && rate < 25) options.push(4);
  if (rate > 20 && rate < 30) options.push(5);
  if (rate > 25) options.push(6);
  return options[Math.floor(Math.random() * options.length)];
}

export function startRadiation() {
  system.runInterval(() => {
    for (const player of world.getAllPlayers()) radiationTick(player);
  }, 20);

  system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
      if (!inventoryRads(player).hasGeiger) continue;
      const click = geigerClick(radRate.get(player.id) ?? 0);
      if (click > 0) player.playSound(`hbm.geiger${click}`);
    }
  }, 5);

  world.afterEvents.itemCompleteUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId === "hbm:radaway") {
      source.setDynamicProperty(PROP_RADAWAY, getNumber(source, PROP_RADAWAY) + RADAWAY_RADS);
    } else if (itemStack.typeId === "hbm:radx") {
      source.setDynamicProperty(PROP_RADX, RADX_SECONDS);
      source.sendMessage({ translate: "hbm.radx.taken" });
    }
  });

  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId !== "hbm:geiger_counter") return;
    const rads = getNumber(source, PROP_RADS);
    const rate = radRate.get(source.id) ?? 0;
    const resPercent = (1 - Math.pow(10, -resistance(source))) * 100;
    source.sendMessage({
      rawtext: [{ translate: "hbm.geiger.report", with: [rads.toFixed(1), rate.toFixed(2), `${resPercent.toFixed(0)}%`] }],
    });
  });

  world.afterEvents.entityDie.subscribe(
    ({ deadEntity }) => {
      if (deadEntity.typeId !== "minecraft:player") return;
      deadEntity.setDynamicProperty(PROP_RADS, 0);
      deadEntity.setDynamicProperty(PROP_RADAWAY, 0);
      deadEntity.setDynamicProperty(PROP_RADX, 0);
    },
    { entityTypes: ["minecraft:player"] }
  );

  // /scriptevent hbm:setrads <value> — set your own dose, handy for testing the sickness stages.
  system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
    if (id !== "hbm:setrads" || sourceEntity?.typeId !== "minecraft:player") return;
    const value = Number(message);
    if (!Number.isFinite(value)) return;
    sourceEntity.setDynamicProperty(PROP_RADS, Math.min(Math.max(value, 0), MAX_RADS));
  });
}
