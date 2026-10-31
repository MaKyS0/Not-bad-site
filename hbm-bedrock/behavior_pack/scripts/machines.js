// Machines and the HE power grid, after HBM's TileEntityMachineWoodBurner,
// TileEntityMachineElectricFurnace, TileEntityMachineShredder and MachineBattery.
// Machines run once per second, so every per-tick number below is applied 20 times at once.
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { nuke } from "./bombs.js";

const SECOND = 20;
const STACK = 64;
const CABLE = "hbm:red_cable";
const PROP_PREFIX = "hbm:machine:";
/** Cables and machines a single network search may visit. */
const MAX_NETWORK = 512;

const METALS = [
  ["ore_uranium", "ingot_uranium", "powder_uranium"],
  ["ore_titanium", "ingot_titanium", "powder_titanium"],
  ["ore_lead", "ingot_lead", "powder_lead"],
  ["ore_thorium", "ingot_th232", "powder_thorium"],
  ["ore_tungsten", "ingot_tungsten", "powder_tungsten"],
  ["ore_aluminium", "ingot_aluminium", "powder_aluminium"],
  ["ore_beryllium", "ingot_beryllium", "powder_beryllium"],
];

/** @type {Record<string, string>} input -> smelted output, one for one. */
const SMELT = {
  "hbm:powder_iron": "minecraft:iron_ingot",
  "hbm:powder_gold": "minecraft:gold_ingot",
  "hbm:powder_copper": "minecraft:copper_ingot",
  "hbm:powder_steel": "hbm:ingot_steel",
  "minecraft:raw_iron": "minecraft:iron_ingot",
  "minecraft:iron_ore": "minecraft:iron_ingot",
  "minecraft:deepslate_iron_ore": "minecraft:iron_ingot",
  "minecraft:raw_gold": "minecraft:gold_ingot",
  "minecraft:gold_ore": "minecraft:gold_ingot",
  "minecraft:deepslate_gold_ore": "minecraft:gold_ingot",
  "minecraft:raw_copper": "minecraft:copper_ingot",
  "minecraft:copper_ore": "minecraft:copper_ingot",
  "minecraft:deepslate_copper_ore": "minecraft:copper_ingot",
  "minecraft:ancient_debris": "minecraft:netherite_scrap",
  "minecraft:sand": "minecraft:glass",
  "minecraft:red_sand": "minecraft:glass",
  "minecraft:cobblestone": "minecraft:stone",
  "minecraft:stone": "minecraft:smooth_stone",
  "minecraft:cobbled_deepslate": "minecraft:deepslate",
  "minecraft:clay_ball": "minecraft:brick",
  "minecraft:netherrack": "minecraft:netherbrick",
  "minecraft:cactus": "minecraft:green_dye",
  "minecraft:kelp": "minecraft:dried_kelp",
  "minecraft:wet_sponge": "minecraft:sponge",
  "minecraft:potato": "minecraft:baked_potato",
  "minecraft:beef": "minecraft:cooked_beef",
  "minecraft:porkchop": "minecraft:cooked_porkchop",
  "minecraft:chicken": "minecraft:cooked_chicken",
  "minecraft:mutton": "minecraft:cooked_mutton",
  "minecraft:rabbit": "minecraft:cooked_rabbit",
  "minecraft:cod": "minecraft:cooked_cod",
  "minecraft:salmon": "minecraft:cooked_salmon",
};

/** @type {Record<string, [string, number]>} input -> [output, count]; ores double like in HBM. */
const SHRED = {
  "minecraft:raw_iron": ["hbm:powder_iron", 2],
  "minecraft:iron_ore": ["hbm:powder_iron", 2],
  "minecraft:deepslate_iron_ore": ["hbm:powder_iron", 2],
  "minecraft:iron_ingot": ["hbm:powder_iron", 1],
  "minecraft:raw_gold": ["hbm:powder_gold", 2],
  "minecraft:gold_ore": ["hbm:powder_gold", 2],
  "minecraft:deepslate_gold_ore": ["hbm:powder_gold", 2],
  "minecraft:gold_ingot": ["hbm:powder_gold", 1],
  "minecraft:raw_copper": ["hbm:powder_copper", 2],
  "minecraft:copper_ore": ["hbm:powder_copper", 2],
  "minecraft:deepslate_copper_ore": ["hbm:powder_copper", 2],
  "minecraft:copper_ingot": ["hbm:powder_copper", 1],
  "minecraft:coal": ["hbm:powder_coal", 1],
  "minecraft:charcoal": ["hbm:powder_coal", 1],
  "hbm:ingot_steel": ["hbm:powder_steel", 1],
  "minecraft:stone": ["minecraft:cobblestone", 1],
  "minecraft:cobblestone": ["minecraft:gravel", 1],
  "minecraft:gravel": ["minecraft:sand", 1],
  "minecraft:bone": ["minecraft:bone_meal", 4],
  "minecraft:blaze_rod": ["minecraft:blaze_powder", 3],
  "minecraft:glowstone": ["minecraft:glowstone_dust", 4],
  "hbm:rod_uranium_depleted": ["hbm:nugget_pu239", 3],
};

for (const [ore, ingot, powder] of METALS) {
  SMELT[`hbm:${ore}`] = `hbm:${ingot}`;
  SMELT[`hbm:${powder}`] = `hbm:${ingot}`;
  SHRED[`hbm:${ore}`] = [`hbm:${powder}`, 2];
  SHRED[`hbm:${ingot}`] = [`hbm:${powder}`, 1];
}

/** Furnace burn time in ticks; the wood burner turns every burning tick into 100 HE. */
function fuelTicks(id) {
  const fixed = {
    "minecraft:coal": 1600,
    "minecraft:charcoal": 1600,
    "hbm:powder_coal": 1600,
    "minecraft:coal_block": 16000,
    "minecraft:blaze_rod": 2400,
    "minecraft:dried_kelp_block": 4000,
    "minecraft:stick": 100,
    "minecraft:bamboo": 50,
  }[id];
  if (fixed) return fixed;
  if (id.includes("crimson") || id.includes("warped")) return 0;
  return /_(log|wood|planks)$/.test(id) ? 300 : 0;
}

/**
 * @typedef {{ id: string, n: number }} Slot
 * @typedef {{
 *   type: string, dim: string, x: number, y: number, z: number, energy: number,
 *   input?: Slot, output?: Slot, fuel?: Slot, progress: number, burn: number,
 *   heat?: number, control?: number, burnup?: number
 * }} Machine
 * @typedef {{ id: string, count: number }} Result
 * @typedef {{
 *   kind: "generator" | "consumer" | "storage" | "reactor", maxEnergy: number, lit?: boolean, maxInput?: number,
 *   perTick?: number, duration?: number, recipe?: (id: string) => Result | undefined
 * }} MachineDef
 */

/** @type {Record<string, MachineDef>} */
const MACHINES = {
  "hbm:machine_wood_burner": { kind: "generator", maxEnergy: 100_000, lit: true },
  "hbm:machine_electric_furnace": {
    kind: "consumer",
    maxEnergy: 100_000,
    lit: true,
    perTick: 50,
    duration: 100,
    recipe: (id) => {
      const out = SMELT[id] ?? (/_(log|wood)$/.test(id) && !id.includes("crimson") && !id.includes("warped") ? "minecraft:charcoal" : undefined);
      return out ? { id: out, count: 1 } : undefined;
    },
  },
  "hbm:machine_shredder": {
    kind: "consumer",
    maxEnergy: 10_000,
    perTick: 5,
    duration: 60,
    recipe: (id) => (SHRED[id] ? { id: SHRED[id][0], count: SHRED[id][1] } : undefined),
  },
  "hbm:machine_battery": { kind: "storage", maxEnergy: 1_000_000 },
  "hbm:machine_reactor": { kind: "reactor", maxEnergy: 100_000, lit: true, maxInput: 8 },
};

// Research reactor. Every rod not covered by control rods heats the core and makes power;
// water on its sides carries the heat away. Spent rods come out ready for the shredder.
const ROD_LIFE = 1200; // seconds of full power per rod
const HEAT_PER_ROD = 5; // °C per second; 8 rods stay safe with water on 4 sides
const COOLING_BASE = 2;
const COOLING_PER_WATER = 8;
const HEAT_LOSS = 0.01; // share of the heat above ambient lost each second
const HE_PER_ROD = 2500; // per second
const AMBIENT = 20;
const OVERHEAT = 800;
const MELTDOWN = 1000;
const WATER = new Set(["minecraft:water", "minecraft:flowing_water"]);

/** @type {[string, number, number, number][]} */
const SIDES = [
  ["n", 0, 0, -1],
  ["s", 0, 0, 1],
  ["e", 1, 0, 0],
  ["w", -1, 0, 0],
  ["u", 0, 1, 0],
  ["d", 0, -1, 0],
];

/** @type {Map<string, Machine>} */
const machines = new Map();
/** @type {Set<string>} */
const dirty = new Set();
/** Bumped whenever a cable or machine appears or disappears, invalidating cached networks. */
let topology = 0;
/** @type {Map<string, { topology: number, members: string[] }>} */
const networks = new Map();

const keyOf = (dim, x, y, z) => `${dim}|${x}|${y}|${z}`;
const machineKey = (/** @type {Machine} */ m) => keyOf(m.dim, m.x, m.y, m.z);

function load() {
  for (const prop of world.getDynamicPropertyIds()) {
    if (!prop.startsWith(PROP_PREFIX)) continue;
    const raw = world.getDynamicProperty(prop);
    if (typeof raw !== "string") continue;
    try {
      const m = JSON.parse(raw);
      if (MACHINES[m.type]) machines.set(machineKey(m), m);
    } catch {
      world.setDynamicProperty(prop, undefined);
    }
  }
}

function save() {
  for (const key of dirty) {
    const m = machines.get(key);
    world.setDynamicProperty(PROP_PREFIX + key, m ? JSON.stringify(m) : undefined);
  }
  dirty.clear();
}

/** The machine's block, or undefined when its chunk is not loaded. */
function blockOf(/** @type {Machine} */ m) {
  try {
    return world.getDimension(m.dim).getBlock({ x: m.x, y: m.y, z: m.z });
  } catch {
    return undefined;
  }
}

/** @returns {Machine} */
function ensureMachine(dim, { x, y, z }, type) {
  const key = keyOf(dim, x, y, z);
  const existing = machines.get(key);
  if (existing && existing.type === type) return existing;
  /** @type {Machine} */
  const m = { type, dim, x, y, z, energy: 0, progress: 0, burn: 0 };
  machines.set(key, m);
  dirty.add(key);
  topology++;
  return m;
}

function removeMachine(key, dropAt) {
  const m = machines.get(key);
  if (!m) return;
  if (dropAt) {
    for (const slot of [m.input, m.output, m.fuel]) {
      for (const stack of stacksOf(slot)) dropAt.dimension.spawnItem(stack, dropAt.location);
    }
  }
  machines.delete(key);
  networks.delete(key);
  dirty.add(key);
  topology++;
}

function* stacksOf(/** @type {Slot | undefined} */ slot) {
  if (!slot) return;
  for (let left = slot.n; left > 0; left -= STACK) yield new ItemStack(slot.id, Math.min(left, STACK));
}

/** Machines reachable from this one through cables, or by touching it directly. */
function networkOf(/** @type {Machine} */ m) {
  const key = machineKey(m);
  const cached = networks.get(key);
  if (cached?.topology === topology) return cached.members;

  const dimension = world.getDimension(m.dim);
  const seen = new Set([key]);
  const queue = [{ x: m.x, y: m.y, z: m.z }];
  const members = [];
  while (queue.length && seen.size < MAX_NETWORK) {
    const p = /** @type {{x: number, y: number, z: number}} */ (queue.shift());
    for (const [, dx, dy, dz] of SIDES) {
      const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      const k = keyOf(m.dim, q.x, q.y, q.z);
      if (seen.has(k)) continue;
      seen.add(k);
      if (machines.has(k)) {
        members.push(k);
        continue;
      }
      try {
        if (dimension.getBlock(q)?.typeId === CABLE) queue.push(q);
      } catch {
        // unloaded chunk: the cable run ends here
      }
    }
  }
  networks.set(key, { topology, members });
  return members;
}

function burnFuel(/** @type {Machine} */ m, /** @type {MachineDef} */ def) {
  let ticks = SECOND;
  while (ticks > 0 && m.energy < def.maxEnergy) {
    if (m.burn <= 0) {
      if (!m.fuel) break;
      m.burn = fuelTicks(m.fuel.id);
      m.fuel = take(m.fuel, 1);
    }
    const burned = Math.min(ticks, m.burn);
    m.burn -= burned;
    ticks -= burned;
    m.energy = Math.min(def.maxEnergy, m.energy + burned * 100);
  }
  return m.burn > 0;
}

/**
 * Shares energy evenly between machines of the given kinds on the same network, like HBM's
 * power nets: every kind is filled before the next one gets anything.
 */
function pushEnergy(/** @type {Machine} */ from, /** @type {string[]} */ kinds, /** @type {Set<string>} */ active) {
  for (const kind of kinds) {
    const targets = networkOf(from)
      .filter((k) => active.has(k))
      .map((k) => /** @type {Machine} */ (machines.get(k)))
      .filter((t) => MACHINES[t.type].kind === kind)
      .map((t) => ({ t, room: MACHINES[t.type].maxEnergy - t.energy }))
      .filter(({ room }) => room > 0)
      .sort((a, b) => a.room - b.room);
    // Smallest room first, so whatever a nearly full machine cannot take goes to the others.
    targets.forEach(({ t, room }, i) => {
      const give = Math.min(room, Math.floor(from.energy / (targets.length - i)));
      if (give <= 0) return;
      t.energy += give;
      from.energy -= give;
      dirty.add(machineKey(t));
      dirty.add(machineKey(from));
    });
    if (from.energy <= 0) return;
  }
}

function runRecipe(/** @type {Machine} */ m, /** @type {MachineDef} */ def) {
  const result = m.input && def.recipe?.(m.input.id);
  const fits = result && (!m.output || (m.output.id === result.id && m.output.n + result.count <= STACK));
  const cost = (def.perTick ?? 0) * SECOND;
  if (!result || !fits || m.energy < cost) {
    if (!result) m.progress = 0;
    return false;
  }
  m.energy -= cost;
  m.progress += SECOND;
  if (m.progress >= (def.duration ?? SECOND)) {
    m.progress = 0;
    m.input = take(/** @type {Slot} */ (m.input), 1);
    m.output = { id: result.id, n: (m.output?.n ?? 0) + result.count };
  }
  return true;
}

function waterSides(block) {
  let sides = 0;
  for (const neighbour of [block.north(), block.south(), block.east(), block.west(), block.above(), block.below()]) {
    if (neighbour && WATER.has(neighbour.typeId)) sides++;
  }
  return sides;
}

/** One second of the reactor; returns whether it is running and whether it melted down. */
function runReactor(/** @type {Machine} */ m, /** @type {MachineDef} */ def, block) {
  const rods = m.input?.n ?? 0;
  const flux = rods * (1 - (m.control ?? 100) / 100);
  const heat = m.heat ?? AMBIENT;
  const cooling = COOLING_BASE + waterSides(block) * COOLING_PER_WATER + (heat - AMBIENT) * HEAT_LOSS;
  m.heat = Math.max(AMBIENT, heat + flux * HEAT_PER_ROD - cooling);
  m.energy = Math.min(def.maxEnergy, m.energy + flux * HE_PER_ROD);

  m.burnup = (m.burnup ?? 0) + flux;
  while (m.burnup >= ROD_LIFE && m.input) {
    m.burnup -= ROD_LIFE;
    m.input = take(m.input, 1);
    m.output = { id: "hbm:rod_uranium_depleted", n: (m.output?.n ?? 0) + 1 };
  }
  if (!m.input) m.burnup = 0;

  if (m.heat >= OVERHEAT) {
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id === m.dim && Math.hypot(player.location.x - m.x, player.location.y - m.y, player.location.z - m.z) < 24) {
        player.onScreenDisplay.setActionBar({ rawtext: [{ translate: "hbm.reactor.overheat", with: [String(Math.floor(m.heat))] }] });
      }
    }
  }
  return { running: flux > 0, meltdown: m.heat >= MELTDOWN };
}

function meltdown(key, /** @type {Machine} */ m) {
  removeMachine(key);
  const dimension = world.getDimension(m.dim);
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id === m.dim) player.sendMessage({ translate: "hbm.reactor.meltdown" });
  }
  dimension.setBlockType({ x: m.x, y: m.y, z: m.z }, "minecraft:air");
  nuke(dimension, { x: m.x + 0.5, y: m.y + 0.5, z: m.z + 0.5 }, 12, { fallout: 40 });
}

function take(/** @type {Slot} */ slot, n) {
  return slot.n > n ? { id: slot.id, n: slot.n - n } : undefined;
}

function setLit(block, lit) {
  if (block.permutation.getState("hbm:lit") !== lit) {
    block.setPermutation(block.permutation.withState("hbm:lit", lit));
  }
}

function tick() {
  /** @type {Map<string, import("@minecraft/server").Block>} */
  const blocks = new Map();
  for (const [key, m] of machines) {
    const block = blockOf(m);
    if (!block) continue;
    if (block.typeId !== m.type) {
      removeMachine(key, block);
      continue;
    }
    blocks.set(key, block);
  }
  const active = new Set(blocks.keys());
  const byKind = (kind) => [...active].map((k) => /** @type {Machine} */ (machines.get(k))).filter((m) => MACHINES[m.type].kind === kind);

  /** @type {Map<string, boolean>} */
  const lit = new Map();
  for (const m of byKind("generator")) {
    const before = JSON.stringify([m.energy, m.burn, m.fuel]);
    lit.set(machineKey(m), burnFuel(m, MACHINES[m.type]));
    if (JSON.stringify([m.energy, m.burn, m.fuel]) !== before) dirty.add(machineKey(m));
    pushEnergy(m, ["consumer", "storage"], active);
  }
  for (const m of byKind("reactor")) {
    const key = machineKey(m);
    const { running, meltdown: melted } = runReactor(m, MACHINES[m.type], /** @type {import("@minecraft/server").Block} */ (blocks.get(key)));
    dirty.add(key);
    if (melted) {
      meltdown(key, m);
      active.delete(key);
      continue;
    }
    lit.set(key, running);
    pushEnergy(m, ["consumer", "storage"], active);
  }
  for (const m of byKind("storage")) pushEnergy(m, ["consumer"], active);
  for (const m of byKind("consumer")) {
    const before = m.progress;
    const working = runRecipe(m, MACHINES[m.type]);
    lit.set(machineKey(m), working);
    if (working || before !== m.progress) dirty.add(machineKey(m));
  }

  for (const [key, on] of lit) {
    const block = blocks.get(key);
    if (block && MACHINES[block.typeId].lit) setLit(block, on);
  }
  save();
}

// ---------- cables ----------

function isConductor(typeId) {
  return typeId === CABLE || MACHINES[typeId] !== undefined;
}

/** Re-joins the cable at `location` and the cables around it to their neighbours. */
function refreshCables(dimension, location) {
  for (const [, dx, dy, dz] of [/** @type {[string, number, number, number]} */ (["", 0, 0, 0]), ...SIDES]) {
    const at = { x: location.x + dx, y: location.y + dy, z: location.z + dz };
    let cable;
    try {
      cable = dimension.getBlock(at);
    } catch {
      continue;
    }
    if (cable?.typeId !== CABLE) continue;
    let permutation = cable.permutation;
    for (const [side, sx, sy, sz] of SIDES) {
      let neighbour;
      try {
        neighbour = dimension.getBlock({ x: at.x + sx, y: at.y + sy, z: at.z + sz });
      } catch {
        neighbour = undefined;
      }
      permutation = permutation.withState(`hbm:${side}`, isConductor(neighbour?.typeId ?? ""));
    }
    cable.setPermutation(permutation);
  }
}

// ---------- player interaction ----------

const formatNumber = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Our ids use the pack's language file; vanilla ids fall back to a readable form of the id. */
function itemLabel(id) {
  if (id.startsWith("hbm:")) {
    const short = id.slice(4);
    return { translate: /^(ore_|block_|machine_|red_cable)/.test(short) ? `tile.hbm.${short}.name` : `item.hbm.${short}.name` };
  }
  const words = id.replace(/^minecraft:/, "").split("_");
  return { text: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") };
}

function slotLine(labelKey, /** @type {Slot | undefined} */ slot) {
  const content = slot ? [itemLabel(slot.id), { text: ` ×${slot.n}` }] : [{ translate: "hbm.machine.empty" }];
  return [{ translate: labelKey }, ...content, { text: "\n" }];
}

/** Which slot of `m` accepts this item, if any. */
function slotFor(/** @type {Machine} */ m, id) {
  const def = MACHINES[m.type];
  if (def.kind === "generator") return fuelTicks(id) > 0 ? "fuel" : undefined;
  if (def.kind === "consumer") return def.recipe?.(id) ? "input" : undefined;
  if (def.kind === "reactor") return id === "hbm:rod_uranium" ? "input" : undefined;
  return undefined;
}

function give(player, /** @type {Slot | undefined} */ slot) {
  const container = player.getComponent("minecraft:inventory")?.container;
  for (const stack of stacksOf(slot)) {
    const left = container?.addItem(stack) ?? stack;
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

function interact(player, dim, location, type) {
  const m = ensureMachine(dim, location, type);
  const key = machineKey(m);
  const container = player.getComponent("minecraft:inventory")?.container;
  const held = container?.getItem(player.selectedSlotIndex);
  const target = held && slotFor(m, held.typeId);

  if (container && held && target) {
    const current = m[target];
    if (current && current.id !== held.typeId) {
      player.onScreenDisplay.setActionBar({ translate: "hbm.machine.slot_busy" });
      return;
    }
    const amount = Math.min(held.amount, (MACHINES[m.type].maxInput ?? STACK) - (current?.n ?? 0));
    if (amount <= 0) {
      player.onScreenDisplay.setActionBar({ translate: "hbm.machine.slot_busy" });
      return;
    }
    m[target] = { id: held.typeId, n: (current?.n ?? 0) + amount };
    if (amount >= held.amount) {
      container.setItem(player.selectedSlotIndex, undefined);
    } else {
      held.amount -= amount;
      container.setItem(player.selectedSlotIndex, held);
    }
    dirty.add(key);
    save();
    player.onScreenDisplay.setActionBar({ rawtext: [{ translate: "hbm.machine.inserted", with: [String(amount)] }] });
    return;
  }
  showMachine(player, m);
}

function showMachine(player, /** @type {Machine} */ m) {
  const def = MACHINES[m.type];
  const key = machineKey(m);
  /** @type {import("@minecraft/server").RawMessage[]} */
  const body = [{ translate: "hbm.machine.energy", with: [formatNumber(m.energy), formatNumber(def.maxEnergy)] }, { text: "\n" }];
  /** @type {{ label: string, run: () => void }[]} */
  const actions = [];
  const takeAction = (label, /** @type {"input" | "output" | "fuel"} */ slot) =>
    actions.push({
      label,
      run: () => {
        give(player, m[slot]);
        m[slot] = undefined;
        if (slot === "input") m.progress = 0;
      },
    });
  const line = (translate, ...values) => body.push({ translate, with: values.map(String) }, { text: "\n" });

  if (def.kind === "generator") {
    body.push(...slotLine("hbm.machine.fuel", m.fuel));
    if (m.burn > 0) line("hbm.machine.burning", Math.ceil(m.burn / SECOND));
    if (m.fuel) takeAction("hbm.machine.take_input", "fuel");
  } else if (def.kind === "consumer") {
    body.push(...slotLine("hbm.machine.input", m.input), ...slotLine("hbm.machine.output", m.output));
    line("hbm.machine.progress", `${Math.floor((m.progress / (def.duration ?? 1)) * 100)}%`);
    if (m.output) takeAction("hbm.machine.take_output", "output");
    if (m.input) takeAction("hbm.machine.take_input", "input");
  } else if (def.kind === "reactor") {
    const control = m.control ?? 100;
    const rods = m.input?.n ?? 0;
    const block = blockOf(m);
    line("hbm.reactor.heat", Math.floor(m.heat ?? AMBIENT));
    line("hbm.reactor.rods", rods, m.output?.n ?? 0, `${Math.floor(((m.burnup ?? 0) / ROD_LIFE) * 100)}%`);
    line("hbm.reactor.control", `${control}%`);
    line("hbm.reactor.cooling", block ? waterSides(block) : 0);
    line("hbm.reactor.output", formatNumber(rods * (1 - control / 100) * HE_PER_ROD));
    const setControl = (/** @type {number} */ value) => () => (m.control = Math.min(100, Math.max(0, value)));
    if (control < 100) actions.push({ label: "hbm.reactor.insert", run: setControl(control + 25) });
    if (control > 0) actions.push({ label: "hbm.reactor.withdraw", run: setControl(control - 25) });
    if (control < 100) actions.push({ label: "hbm.reactor.scram", run: setControl(100) });
    if (m.output) takeAction("hbm.reactor.take_depleted", "output");
    if (m.input) takeAction("hbm.reactor.take_fuel", "input");
  }
  body.push({ translate: "hbm.machine.network", with: [String(networkOf(m).length)] }, { text: "\n\n" }, { translate: "hbm.machine.hint" });

  const form = new ActionFormData().title({ translate: `tile.hbm.${m.type.slice(4)}.name` }).body({ rawtext: body });
  for (const action of actions) form.button({ translate: action.label });
  form.button({ translate: "hbm.machine.close" });

  form.show(player).then((response) => {
    const action = response.selection === undefined ? undefined : actions[response.selection];
    // The form stays open while the machine keeps running; act on its current state.
    if (!action || machines.get(key) !== m) return;
    action.run();
    dirty.add(key);
    save();
  });
}

export function startMachines() {
  load();
  system.runInterval(tick, SECOND);

  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { block, player } = event;
    if (!MACHINES[block.typeId]) return;
    // Sneaking with an item in hand keeps the vanilla behaviour, so blocks can be placed against machines.
    if (player.isSneaking && event.itemStack) return;
    event.cancel = true;
    if (!event.isFirstEvent) return;
    const dim = block.dimension.id;
    const location = { x: block.location.x, y: block.location.y, z: block.location.z };
    const type = block.typeId;
    system.run(() => interact(player, dim, location, type));
  });

  world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    if (!isConductor(block.typeId)) return;
    if (MACHINES[block.typeId]) ensureMachine(block.dimension.id, block.location, block.typeId);
    topology++;
    refreshCables(block.dimension, block.location);
    save();
  });

  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    const type = brokenBlockPermutation.type.id;
    if (!isConductor(type)) return;
    removeMachine(keyOf(block.dimension.id, block.location.x, block.location.y, block.location.z), block);
    topology++;
    refreshCables(block.dimension, block.location);
    save();
  });

  world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
    const type = explodedBlockPermutation.type.id;
    if (!isConductor(type)) return;
    removeMachine(keyOf(dimension.id, block.location.x, block.location.y, block.location.z), block);
    topology++;
    refreshCables(dimension, block.location);
    save();
  });
}
