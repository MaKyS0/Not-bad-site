// HBM's loot crates and consumables. Contents and weights follow BlockCrate, BlockCanCrate,
// BlockAmmoCrate and BlockJungleCrate of the original; the starmetal crate uses its meteorite
// treasure pool. Entries the pack does not have are skipped.
import { world, system, ItemStack } from "@minecraft/server";
import { KNOWN_BLOCKS } from "./imported_machines.js";

const roll = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** @typedef {[string, number]} Weighted id and weight */
/** Picks from a weighted list. @param {Weighted[]} list */
function pick(list) {
  const usable = list.filter(([id]) => KNOWN_BLOCKS.has(id) || id.startsWith("minecraft:"));
  let r = Math.random() * usable.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of usable) if ((r -= w) < 0) return id;
  return usable[0]?.[0];
}

/** @type {Weighted[]} */
const SUPPLY = [["hbm:syringe_metal_stimpak", 10], ["hbm:syringe_antidote", 5], ["hbm:grenade_he", 18], ["hbm:ammo_container", 2]];
/** @type {Weighted[]} */
const WEAPONS = [
  ["hbm:gun_light_revolver", 10], ["hbm:gun_maresleg", 7], ["hbm:gun_heavy_revolver", 5], ["hbm:gun_greasegun", 5],
  ["hbm:gun_liberator", 2], ["hbm:gun_flaregun", 8], ["hbm:gun_panzerschreck", 1], ["hbm:gun_fliegerfaust", 2],
];
/** @type {Weighted[]} */
const LEAD = [
  ["hbm:ingot_uranium", 10], ["hbm:ingot_u238", 8], ["hbm:ingot_plutonium", 7], ["hbm:ingot_pu240", 6], ["hbm:ingot_neptunium", 7],
  ["hbm:ingot_uranium_fuel", 8], ["hbm:ingot_plutonium_fuel", 7], ["hbm:ingot_mox_fuel", 6], ["hbm:nugget_uranium", 10],
  ["hbm:nugget_u238", 8], ["hbm:nugget_plutonium", 7], ["hbm:nugget_pu240", 6], ["hbm:nugget_neptunium", 7],
  ["hbm:nugget_uranium_fuel", 8], ["hbm:nugget_plutonium_fuel", 7], ["hbm:nugget_mox_fuel", 6], ["hbm:cell_deuterium", 8],
  ["hbm:cell_tritium", 8], ["hbm:cell_uf6", 8], ["hbm:cell_puf6", 8], ["hbm:pellet_rtg", 6], ["hbm:pellet_rtg_weak", 7], ["hbm:powder_yellowcake", 10],
];
/** @type {Weighted[]} */
const METAL = [
  ["hbm:machine_press", 10], ["hbm:machine_wood_burner", 10], ["hbm:machine_diesel", 8], ["hbm:red_pylon", 9],
  ["hbm:machine_electric_furnace", 8], ["hbm:machine_assembly_machine", 10], ["hbm:machine_fluidtank", 7], ["hbm:centrifuge_element", 6],
  ["hbm:motor", 8], ["hbm:coil_tungsten", 7], ["hbm:photo_panel", 3], ["hbm:coil_copper", 10], ["hbm:blade_titanium", 3], ["hbm:piston_selenium", 6],
  ["hbm:machine_battery", 10], ["hbm:fluid_duct", 6],
];
const RED = [
  "hbm:mysteryshovel", "hbm:battery_spark", "hbm:bottle_sparkle", "hbm:bottle_rad", "hbm:ring_starmetal", "hbm:flame_pony", "hbm:broadcaster_pc",
  "hbm:ammo_secret_m44_equestrian", "hbm:ammo_secret_g12_equestrian", "hbm:ammo_secret_bmg50_equestrian",
];
/** @type {Weighted[]} */
const CANS = [
  ["hbm:can_smart", 1], ["hbm:can_creature", 1], ["hbm:can_redbomb", 1], ["hbm:can_mrsugar", 1], ["hbm:can_overcharge", 1],
  ["hbm:can_luna", 1], ["hbm:can_breen", 1], ["hbm:can_bepis", 1], ["hbm:pudding", 1], ["hbm:definitelyfood", 3],
];
const AMMO = [
  ["p9_sp", 16, 32], ["p9_fmj", 16, 32], ["m357_sp", 16, 32], ["m357_fmj", 16, 32], ["m44_sp", 16, 32], ["m44_fmj", 16, 32],
  ["r556_sp", 16, 32], ["r556_fmj", 16, 32], ["r762_sp", 16, 32], ["r762_fmj", 16, 32], ["g12", 16, 32], ["g12_slug", 16, 32],
  ["g40_he", 2, 4], ["rocket_he", 2, 4],
];
/** @type {Weighted[]} */
const STARMETAL = [
  ["hbm:ingot_starmetal", 4], ["hbm:gem_alexandrite", 3], ["hbm:ingot_cobalt", 6], ["hbm:ingot_niobium", 5], ["hbm:ingot_boron", 5],
  ["hbm:ingot_zirconium", 5], ["hbm:crystal_gold", 4], ["hbm:launch_code_piece", 2], ["hbm:blueprint_folder", 2], ["hbm:serum", 2],
  ["hbm:pill_herbal", 4], ["hbm:definitelyfood", 5], ["hbm:egg_glyphid", 2],
];

/** @returns {[string, number][]} */
function contents(type) {
  /** @type {[string, number][]} */
  const out = [];
  const add = (id, n = 1) => id && (KNOWN_BLOCKS.has(id) || id.startsWith("minecraft:")) && out.push([id, n]);
  const picks = (list, n) => {
    for (let i = 0; i < n; i++) add(pick(list));
  };
  switch (type) {
    case "hbm:crate": picks(SUPPLY, roll(3, 5)); break;
    case "hbm:crate_weapon": picks(WEAPONS, Math.random() < 0.01 ? 25 : roll(1, 2)); break;
    case "hbm:crate_lead": picks(LEAD, roll(3, 5)); break;
    case "hbm:crate_metal": picks(METAL, roll(3, 5)); break;
    case "hbm:crate_red": for (const id of RED) add(id); break;
    case "hbm:crate_can": picks(CANS, roll(5, 8)); break;
    case "hbm:crate_ammo":
      add("hbm:cap_nuka", roll(12, 32));
      add("hbm:syringe_metal_stimpak", roll(1, 3));
      for (const [ammo, min, max] of AMMO) if (Math.random() < 0.5) add(`hbm:ammo_standard_${ammo}`, roll(min, max));
      if (Math.random() < 0.1) add("hbm:syringe_metal_super", 2);
      break;
    case "hbm:crate_jungle":
      add("minecraft:gold_ingot", roll(4, 7));
      add("minecraft:gold_nugget", roll(8, 17));
      add("hbm:powder_gold", roll(2, 4));
      add("hbm:wire_fine_gold", roll(4, 8));
      add("hbm:wire_dense_gold", roll(1, 2));
      if (Math.random() < 0.5) add("hbm:plate_gold", roll(1, 2));
      if (Math.random() < 1 / 3) add("hbm:crystal_gold");
      break;
    case "hbm:crate_starmetal":
      picks(STARMETAL, roll(4, 7));
      add("hbm:ammo_standard_rocket_he", roll(2, 6));
      add("hbm:syringe_metal_super", roll(1, 2));
      add("hbm:cap_nuka", roll(20, 60));
      for (const [ammo] of AMMO.slice(0, 12)) if (Math.random() < 0.3) add(`hbm:ammo_standard_${ammo}`, roll(32, 64));
      break;
  }
  return out;
}
const CRATES = new Set(["hbm:crate", "hbm:crate_weapon", "hbm:crate_lead", "hbm:crate_metal", "hbm:crate_red", "hbm:crate_can", "hbm:crate_ammo", "hbm:crate_jungle", "hbm:crate_starmetal"]);

/** Consumables: [effects as [effect, seconds, amplifier]], plus whether they cure poisons. */
const CONSUMABLES = {
  "hbm:syringe_metal_stimpak": [["instant_health", 1, 1], ["regeneration", 10, 0]],
  "hbm:syringe_metal_super": [["instant_health", 1, 3], ["regeneration", 30, 1], ["absorption", 60, 1]],
  "hbm:syringe_metal_medx": [["resistance", 120, 1]],
  "hbm:syringe_metal_psycho": [["strength", 120, 1], ["speed", 120, 0]],
  "hbm:syringe_awesome": [["strength", 60, 4], ["speed", 60, 3], ["resistance", 60, 3], ["jump_boost", 60, 2]],
  "hbm:syringe_poison": [["poison", 15, 1]],
  "hbm:syringe_antidote": [],
  "hbm:serum": [["regeneration", 60, 1]],
  "hbm:pill_herbal": [["regeneration", 15, 0]],
  "hbm:can_smart": [["speed", 60, 0]],
  "hbm:can_creature": [["speed", 60, 1], ["nausea", 10, 0]],
  "hbm:can_redbomb": [["speed", 60, 1], ["jump_boost", 60, 0]],
  "hbm:can_mrsugar": [["speed", 30, 0]],
  "hbm:can_overcharge": [["haste", 60, 1]],
  "hbm:can_luna": [["night_vision", 120, 0]],
  "hbm:can_bepis": [["speed", 30, 0]],
  "hbm:can_breen": [["weakness", 30, 0]],
  "hbm:bottle_nuka": [["speed", 30, 0]],
  "hbm:bottle_cherry": [["speed", 30, 0]],
  "hbm:bottle_quantum": [["speed", 60, 1], ["night_vision", 60, 0]],
  "hbm:bottle_sparkle": [["speed", 60, 1], ["regeneration", 20, 0]],
  "hbm:bottle_rad": [["speed", 60, 1], ["regeneration", 20, 1]],
};
const CURES = new Set(["hbm:syringe_antidote", "hbm:serum"]);
const LEAVES_BEHIND = { "hbm:syringe_metal_stimpak": "hbm:syringe_metal_empty", "hbm:syringe_metal_super": "hbm:syringe_metal_empty", "hbm:syringe_metal_medx": "hbm:syringe_metal_empty", "hbm:syringe_metal_psycho": "hbm:syringe_metal_empty" };

export function startCrates() {
  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    const type = brokenBlockPermutation.type.id;
    if (!CRATES.has(type)) return;
    const at = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    for (const [id, n] of contents(type)) {
      for (let left = n; left > 0; left -= 64) block.dimension.spawnItem(new ItemStack(id, Math.min(left, 64)), at);
    }
    block.dimension.playSound("dig.wood", at);
  });

  world.afterEvents.itemCompleteUse.subscribe(({ itemStack, source }) => {
    const effects = CONSUMABLES[itemStack.typeId];
    if (!effects) return;
    for (const [effect, seconds, amplifier] of effects) source.addEffect(effect, seconds * 20, { amplifier });
    if (CURES.has(itemStack.typeId)) for (const effect of ["poison", "wither", "nausea"]) source.removeEffect(effect);
    const empty = LEAVES_BEHIND[itemStack.typeId];
    if (empty && KNOWN_BLOCKS.has(empty)) system.run(() => source.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(empty)));
  });
}
