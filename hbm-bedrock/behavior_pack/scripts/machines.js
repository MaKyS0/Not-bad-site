// Machines, the HE power grid and the fluid network, after HBM's TileEntityMachine* classes.
// Machines run once per second, so every per-tick number below is applied 20 times at once.
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { nuke } from "./bombs.js";
import { SMELT, SHRED, PRESS, ASSEMBLY, fuelTicks } from "./recipes.js";
import { RBMK, RBMK_TYPES, ROD_LIFE, RBMK_MELTDOWN, RBMK_OVERHEAT, runRbmk } from "./rbmk.js";
import { MISSILES, launchMissile, targetOf } from "./missiles.js";

const SECOND = 20;
const STACK = 64;
const CABLE = "hbm:red_cable";
const DUCT = "hbm:fluid_duct";
const PROP_PREFIX = "hbm:machine:";
/** Conduits and machines a single network search may visit. */
const MAX_NETWORK = 512;
const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);
const FLUID_NAMES = ["water", "steam", "oil", "diesel"];

/**
 * @typedef {{ id: string, n: number }} Slot
 * @typedef {"input" | "output" | "fuel"} SlotName
 * @typedef {{
 *   type: string, dim: string, x: number, y: number, z: number, energy: number,
 *   input?: Slot, output?: Slot, fuel?: Slot, progress: number, burn: number,
 *   heat?: number, control?: number, burnup?: number, flux?: number,
 *   tanks?: Record<string, number>, recipe?: number, stock?: Record<string, number>,
 *   oilY?: number, oilRetry?: number
 * }} Machine
 * @typedef {{ cap: number, role: "in" | "out" | "store" }} Tank
 * @typedef {{
 *   line: (key: string, ...values: (string | number)[]) => void,
 *   slot: (key: string, slot: Slot | undefined) => void,
 *   action: (label: string, run: () => void) => void,
 *   take: (label: string, slot: SlotName) => void,
 *   player: import("@minecraft/server").Player,
 * }} FormContext
 * @typedef {{
 *   power?: "gen" | "use" | "store", maxEnergy?: number, lit?: boolean,
 *   tanks?: Record<string, Tank>, anyFluid?: number,
 *   accepts?: Partial<Record<SlotName, (id: string) => boolean>>, maxInput?: number,
 *   assembler?: boolean,
 *   run?: (m: Machine, block: import("@minecraft/server").Block, key: string) => boolean,
 *   describe?: (m: Machine, ctx: FormContext) => void
 * }} MachineDef
 */

// ---------- machine behaviour ----------

const take = (/** @type {Slot} */ slot, n) => (slot.n > n ? { id: slot.id, n: slot.n - n } : undefined);
const add = (/** @type {Slot | undefined} */ slot, id, n) => ({ id, n: (slot?.n ?? 0) + n });
const fits = (/** @type {Slot | undefined} */ slot, id, n) => !slot || (slot.id === id && slot.n + n <= STACK);
const tank = (/** @type {Machine} */ m, fluid) => m.tanks?.[fluid] ?? 0;
function setTank(/** @type {Machine} */ m, fluid, amount) {
  m.tanks = { ...m.tanks, [fluid]: Math.max(0, amount) };
}

function waterSides(block) {
  let sides = 0;
  for (const neighbour of [block.north(), block.south(), block.east(), block.west(), block.above(), block.below()]) {
    if (neighbour && WATER_BLOCKS.has(neighbour.typeId)) sides++;
  }
  return sides;
}

/** Wood burner: every burning tick gives 100 HE while there is room for it. */
function burnFuel(/** @type {Machine} */ m) {
  const max = /** @type {number} */ (MACHINES[m.type].maxEnergy);
  let ticks = SECOND;
  while (ticks > 0 && m.energy < max) {
    if (m.burn <= 0) {
      if (!m.fuel) break;
      m.burn = fuelTicks(m.fuel.id);
      m.fuel = take(m.fuel, 1);
    }
    const burned = Math.min(ticks, m.burn);
    m.burn -= burned;
    ticks -= burned;
    m.energy = Math.min(max, m.energy + burned * 100);
  }
  return m.burn > 0;
}

/**
 * A one-input machine: furnace, shredder, press.
 * @param {{ maxEnergy: number, perTick: number, duration: number, lit?: boolean, recipe: (id: string) => { id: string, count: number } | undefined }} spec
 * @returns {MachineDef}
 */
function processor({ maxEnergy, perTick, duration, recipe, lit = false }) {
  return {
    power: "use",
    maxEnergy,
    lit,
    accepts: { input: (id) => recipe(id) !== undefined },
    run: (m) => {
      const result = m.input && recipe(m.input.id);
      const cost = perTick * SECOND;
      if (!result || !fits(m.output, result.id, result.count) || m.energy < cost) {
        if (!result) m.progress = 0;
        return false;
      }
      m.energy -= cost;
      m.progress += SECOND;
      if (m.progress >= duration) {
        m.progress = 0;
        m.input = take(/** @type {Slot} */ (m.input), 1);
        m.output = add(m.output, result.id, result.count);
      }
      return true;
    },
    describe: (m, ctx) => {
      ctx.slot("hbm.machine.input", m.input);
      ctx.slot("hbm.machine.output", m.output);
      ctx.line("hbm.machine.progress", `${Math.floor((m.progress / duration) * 100)}%`);
      if (m.output) ctx.take("hbm.machine.take_output", "output");
      if (m.input) ctx.take("hbm.machine.take_input", "input");
    },
  };
}

const charcoal = (id) => /_(log|wood)$/.test(id) && !id.includes("crimson") && !id.includes("warped");

// Research reactor. Every rod not covered by control rods heats the core and makes power;
// water on its sides carries the heat away. Spent rods come out ready for the shredder.
const REACTOR_ROD_LIFE = 1200; // seconds of full power per rod
const HEAT_PER_ROD = 5; // °C per second; 8 rods stay safe with water on 4 sides
const COOLING_BASE = 2;
const COOLING_PER_WATER = 8;
const HEAT_LOSS = 0.01; // share of the heat above ambient lost each second
const HE_PER_ROD = 2500; // per second
const AMBIENT = 20;
const OVERHEAT = 800;
const MELTDOWN = 1000;

function warnNear(/** @type {Machine} */ m, key, value) {
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id === m.dim && Math.hypot(player.location.x - m.x, player.location.y - m.y, player.location.z - m.z) < 24) {
      player.onScreenDisplay.setActionBar({ rawtext: [{ translate: key, with: [String(Math.floor(value))] }] });
    }
  }
}

function runReactor(/** @type {Machine} */ m, block, key) {
  const rods = m.input?.n ?? 0;
  const flux = rods * (1 - (m.control ?? 100) / 100);
  const heat = m.heat ?? AMBIENT;
  const cooling = COOLING_BASE + waterSides(block) * COOLING_PER_WATER + (heat - AMBIENT) * HEAT_LOSS;
  m.heat = Math.max(AMBIENT, heat + flux * HEAT_PER_ROD - cooling);
  m.energy = Math.min(100_000, m.energy + flux * HE_PER_ROD);
  m.burnup = (m.burnup ?? 0) + flux;
  while (m.burnup >= REACTOR_ROD_LIFE && m.input) {
    m.burnup -= REACTOR_ROD_LIFE;
    m.input = take(m.input, 1);
    m.output = add(m.output, "hbm:rod_uranium_depleted", 1);
  }
  if (!m.input) m.burnup = 0;
  if (m.heat >= OVERHEAT) warnNear(m, "hbm.reactor.overheat", m.heat);
  if (m.heat >= MELTDOWN) {
    removeMachine(key);
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id === m.dim) player.sendMessage({ translate: "hbm.reactor.meltdown" });
    }
    const dimension = world.getDimension(m.dim);
    dimension.setBlockType({ x: m.x, y: m.y, z: m.z }, "minecraft:air");
    nuke(dimension, { x: m.x + 0.5, y: m.y + 0.5, z: m.z + 0.5 }, 12, { fallout: 40 });
    return false;
  }
  return flux > 0;
}

/** Control rod buttons; `scram` replaces the plain full-insert button (АЗ-5 on RBMK). */
function controlActions(/** @type {Machine} */ m, /** @type {FormContext} */ ctx, /** @type {(() => void) | undefined} */ scram) {
  const control = m.control ?? 100;
  const set = (/** @type {number} */ value) => () => {
    m.control = Math.min(100, Math.max(0, value));
  };
  if (control < 100) ctx.action("hbm.reactor.insert", set(control + 25));
  if (control > 0) ctx.action("hbm.reactor.withdraw", set(control - 25));
  if (scram) ctx.action("hbm.rbmk.az5", scram);
  else if (control < 100) ctx.action("hbm.reactor.scram", set(100));
}

// Oil derrick: pumps the first oil deposit straight below it; each pump may exhaust the block.
const OIL = "hbm:ore_oil";
const OIL_PER_PUMP = 500;
const OIL_EXHAUST_CHANCE = 0.1;

function findOil(/** @type {Machine} */ m, block) {
  const dimension = block.dimension;
  if (m.oilY !== undefined && dimension.getBlock({ x: m.x, y: m.oilY, z: m.z })?.typeId === OIL) return m.oilY;
  if ((m.oilRetry ?? 0) > 0) {
    m.oilRetry = (m.oilRetry ?? 0) - 1;
    return undefined;
  }
  for (let y = m.y - 1; y >= dimension.heightRange.min; y--) {
    if (dimension.getBlock({ x: m.x, y, z: m.z })?.typeId === OIL) return (m.oilY = y);
  }
  m.oilY = undefined;
  m.oilRetry = 30; // search the column again in half a minute
  return undefined;
}

// Assembly machine: pick a recipe, load its ingredients, it builds while powered.
function runAssembler(/** @type {Machine} */ m) {
  const recipe = ASSEMBLY[m.recipe ?? -1];
  const cost = 20 * SECOND;
  if (!recipe || !fits(m.output, recipe.output, recipe.count) || m.energy < cost) return false;
  const stock = m.stock ?? {};
  if (Object.entries(recipe.input).some(([id, n]) => (stock[id] ?? 0) < n)) {
    m.progress = 0;
    return false;
  }
  m.energy -= cost;
  m.progress += SECOND;
  if (m.progress >= recipe.ticks) {
    m.progress = 0;
    for (const [id, n] of Object.entries(recipe.input)) stock[id] -= n;
    m.stock = stock;
    m.output = add(m.output, recipe.output, recipe.count);
  }
  return true;
}

/** @type {Record<string, MachineDef>} */
const MACHINES = {
  "hbm:machine_wood_burner": {
    power: "gen",
    maxEnergy: 100_000,
    lit: true,
    accepts: { fuel: (id) => fuelTicks(id) > 0 },
    run: burnFuel,
    describe: (m, ctx) => {
      ctx.slot("hbm.machine.fuel", m.fuel);
      if (m.burn > 0) ctx.line("hbm.machine.burning", Math.ceil(m.burn / SECOND));
      if (m.fuel) ctx.take("hbm.machine.take_input", "fuel");
    },
  },
  "hbm:machine_electric_furnace": processor({
    maxEnergy: 100_000,
    perTick: 50,
    duration: 100,
    lit: true,
    recipe: (id) => {
      const out = SMELT[id] ?? (charcoal(id) ? "minecraft:charcoal" : undefined);
      return out ? { id: out, count: 1 } : undefined;
    },
  }),
  "hbm:machine_shredder": processor({
    maxEnergy: 10_000,
    perTick: 5,
    duration: 60,
    recipe: (id) => (SHRED[id] ? { id: SHRED[id][0], count: SHRED[id][1] } : undefined),
  }),
  "hbm:machine_press": processor({
    maxEnergy: 50_000,
    perTick: 20,
    duration: 40,
    recipe: (id) => (PRESS[id] ? { id: PRESS[id], count: 1 } : undefined),
  }),
  "hbm:machine_battery": { power: "store", maxEnergy: 1_000_000 },
  "hbm:machine_reactor": {
    power: "gen",
    maxEnergy: 100_000,
    lit: true,
    maxInput: 8,
    accepts: { input: (id) => id === "hbm:rod_uranium" },
    run: runReactor,
    describe: (m, ctx) => {
      const control = m.control ?? 100;
      const rods = m.input?.n ?? 0;
      const block = blockOf(m);
      ctx.line("hbm.reactor.heat", Math.floor(m.heat ?? AMBIENT));
      ctx.line("hbm.reactor.rods", rods, m.output?.n ?? 0, `${Math.floor(((m.burnup ?? 0) / REACTOR_ROD_LIFE) * 100)}%`);
      ctx.line("hbm.reactor.control", `${control}%`);
      ctx.line("hbm.reactor.cooling", block ? waterSides(block) : 0);
      ctx.line("hbm.reactor.output", formatNumber(rods * (1 - control / 100) * HE_PER_ROD));
      controlActions(m, ctx, undefined);
      if (m.output) ctx.take("hbm.reactor.take_depleted", "output");
      if (m.input) ctx.take("hbm.reactor.take_fuel", "input");
    },
  },
  "hbm:machine_assembler": {
    power: "use",
    maxEnergy: 100_000,
    assembler: true,
    run: runAssembler,
    describe: (m, ctx) => {
      const recipe = ASSEMBLY[m.recipe ?? -1];
      if (recipe) {
        ctx.slot("hbm.assembler.recipe", { id: recipe.output, n: recipe.count });
        for (const [id, n] of Object.entries(recipe.input)) {
          ctx.slot("hbm.assembler.needs", { id, n });
          ctx.line("hbm.assembler.loaded", m.stock?.[id] ?? 0);
        }
        ctx.line("hbm.machine.progress", `${Math.floor((m.progress / recipe.ticks) * 100)}%`);
      } else {
        ctx.line("hbm.assembler.no_recipe");
      }
      ctx.slot("hbm.machine.output", m.output);
      ctx.action("hbm.assembler.choose", () => chooseRecipe(ctx.player, m));
      if (m.output) ctx.take("hbm.machine.take_output", "output");
      if (Object.values(m.stock ?? {}).some((n) => n > 0)) ctx.action("hbm.assembler.take_stock", () => returnStock(ctx.player, m));
    },
  },
  "hbm:machine_pump": {
    tanks: { water: { cap: 16_000, role: "out" } },
    run: (m, block) => {
      const pumped = Math.min(16_000 - tank(m, "water"), waterSides(block) * 1000);
      setTank(m, "water", tank(m, "water") + pumped);
      return pumped > 0;
    },
    describe: (m, ctx) => {
      const block = blockOf(m);
      ctx.line("hbm.reactor.cooling", block ? waterSides(block) : 0);
    },
  },
  "hbm:machine_derrick": {
    power: "use",
    maxEnergy: 100_000,
    tanks: { oil: { cap: 16_000, role: "out" } },
    run: (m, block) => {
      const cost = 50 * SECOND;
      if (m.energy < cost || tank(m, "oil") + OIL_PER_PUMP > 16_000) return false;
      const oilY = findOil(m, block);
      if (oilY === undefined) return false;
      m.energy -= cost;
      m.progress += SECOND;
      if (m.progress >= 40) {
        m.progress = 0;
        setTank(m, "oil", tank(m, "oil") + OIL_PER_PUMP);
        if (Math.random() < OIL_EXHAUST_CHANCE) {
          block.dimension.setBlockType({ x: m.x, y: oilY, z: m.z }, "hbm:ore_oil_empty");
          m.oilY = undefined;
        }
      }
      return true;
    },
    describe: (m, ctx) => {
      if (m.oilY !== undefined) ctx.line("hbm.derrick.oil", m.y - m.oilY);
      else ctx.line("hbm.derrick.no_oil");
    },
  },
  "hbm:machine_refinery": {
    power: "use",
    maxEnergy: 100_000,
    tanks: { oil: { cap: 16_000, role: "in" }, diesel: { cap: 16_000, role: "out" } },
    run: (m) => {
      const cost = 50 * SECOND;
      if (m.energy < cost || tank(m, "oil") < 100 || tank(m, "diesel") + 60 > 16_000) return false;
      m.energy -= cost;
      setTank(m, "oil", tank(m, "oil") - 100);
      setTank(m, "diesel", tank(m, "diesel") + 60);
      return true;
    },
  },
  "hbm:machine_diesel": {
    power: "gen",
    maxEnergy: 100_000,
    tanks: { diesel: { cap: 16_000, role: "in" } },
    run: (m) => {
      if (tank(m, "diesel") < 10 || m.energy >= 100_000) return false;
      setTank(m, "diesel", tank(m, "diesel") - 10);
      m.energy = Math.min(100_000, m.energy + 2500);
      return true;
    },
  },
  "hbm:machine_fluidtank": { anyFluid: 64_000 },
  "hbm:machine_turbine": {
    power: "gen",
    maxEnergy: 1_000_000,
    tanks: { steam: { cap: 16_000, role: "in" }, water: { cap: 16_000, role: "out" } },
    run: (m) => {
      const used = Math.min(tank(m, "steam"), 2000);
      if (used <= 0) return false;
      setTank(m, "steam", tank(m, "steam") - used);
      // Condensate goes back out as water; whatever the tank cannot hold is vented.
      setTank(m, "water", Math.min(16_000, tank(m, "water") + used));
      m.energy = Math.min(1_000_000, m.energy + used * 5);
      return true;
    },
  },
  "hbm:launch_pad": {
    maxInput: 1,
    accepts: { input: (id) => id in MISSILES },
    describe: (m, ctx) => {
      ctx.slot("hbm.missile.loaded", m.input);
      const target = targetOf(ctx.player);
      if (target) ctx.line("hbm.missile.target", `${target.x} ${target.y} ${target.z}`);
      else ctx.line("hbm.missile.no_target");
      if (m.input && target) {
        ctx.action("hbm.missile.launch", () => {
          const missile = /** @type {Slot} */ (m.input).id;
          m.input = undefined;
          launchMissile(world.getDimension(m.dim), { x: m.x, y: m.y, z: m.z }, target, missile, ctx.player);
        });
      }
      if (m.input) ctx.take("hbm.missile.take", "input");
    },
  },
  [RBMK.FUEL]: {
    maxInput: 1,
    accepts: { input: (id) => id === "hbm:rbmk_fuel_ueu" },
    describe: (m, ctx) => {
      ctx.line("hbm.rbmk.heat", Math.floor(m.heat ?? AMBIENT));
      ctx.line("hbm.rbmk.flux", (m.flux ?? 0).toFixed(1));
      ctx.slot("hbm.rbmk.rod", m.input);
      if (m.input) ctx.line("hbm.rbmk.burnup", `${Math.floor(((m.burnup ?? 0) / ROD_LIFE) * 100)}%`);
      if (m.input) ctx.take("hbm.rbmk.take_rod", "input");
      if (m.output) ctx.take("hbm.rbmk.take_spent", "output");
    },
  },
  [RBMK.CONTROL]: {
    describe: (m, ctx) => {
      ctx.line("hbm.rbmk.heat", Math.floor(m.heat ?? AMBIENT));
      ctx.line("hbm.rbmk.insertion", `${m.control ?? 100}%`);
      controlActions(m, ctx, () => scramRbmk(m));
    },
  },
  [RBMK.BOILER]: {
    tanks: { water: { cap: 16_000, role: "in" }, steam: { cap: 16_000, role: "out" } },
    describe: (m, ctx) => ctx.line("hbm.rbmk.heat", Math.floor(m.heat ?? AMBIENT)),
  },
};

// ---------- registry and persistence ----------

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
/** Bumped whenever a conduit or machine appears or disappears, invalidating cached networks. */
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
    const stock = Object.entries(m.stock ?? {}).map(([id, n]) => ({ id, n }));
    for (const slot of [m.input, m.output, m.fuel, ...stock]) {
      for (const stack of stacksOf(slot)) dropAt.dimension.spawnItem(stack, dropAt.location);
    }
  }
  machines.delete(key);
  dirty.add(key);
  topology++;
}

function* stacksOf(/** @type {Slot | undefined} */ slot) {
  if (!slot) return;
  for (let left = slot.n; left > 0; left -= STACK) yield new ItemStack(slot.id, Math.min(left, STACK));
}

// ---------- networks ----------

/** Machines reachable from this one through a conduit type, or by touching it directly. */
function networkOf(/** @type {Machine} */ m, conduit) {
  const key = machineKey(m);
  const cacheKey = `${key}#${conduit}`;
  const cached = networks.get(cacheKey);
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
        if (dimension.getBlock(q)?.typeId === conduit) queue.push(q);
      } catch {
        // unloaded chunk: the run ends here
      }
    }
  }
  networks.set(cacheKey, { topology, members });
  return members;
}

/** Shares `amount` evenly between targets, smallest room first; returns how much was handed out. */
function share(amount, /** @type {{ room: number, give: (n: number) => void }[]} */ targets) {
  const sorted = targets.filter((t) => t.room > 0).sort((a, b) => a.room - b.room);
  let given = 0;
  sorted.forEach((t, i) => {
    const n = Math.min(t.room, Math.floor((amount - given) / (sorted.length - i)));
    if (n <= 0) return;
    t.give(n);
    given += n;
  });
  return given;
}

/** Like HBM's power nets: users are filled before stores get anything. */
function pushEnergy(/** @type {Machine} */ from, /** @type {("use" | "store")[]} */ roles, /** @type {Set<string>} */ active) {
  for (const role of roles) {
    if (from.energy <= 0) return;
    const targets = networkOf(from, CABLE)
      .filter((k) => active.has(k))
      .map((k) => /** @type {Machine} */ (machines.get(k)))
      .filter((t) => MACHINES[t.type].power === role)
      .map((t) => ({
        room: (MACHINES[t.type].maxEnergy ?? 0) - t.energy,
        give: (/** @type {number} */ n) => {
          t.energy += n;
          dirty.add(machineKey(t));
        },
      }));
    from.energy -= share(from.energy, targets);
    dirty.add(machineKey(from));
  }
}

/** The tank of `fluid` in this machine, if it has one; a free-for-all tank takes the first fluid it gets. */
function tankOf(/** @type {Machine} */ m, fluid) {
  const def = MACHINES[m.type];
  if (def.tanks?.[fluid]) return def.tanks[fluid];
  if (def.anyFluid) {
    const held = FLUID_NAMES.find((f) => tank(m, f) > 0);
    if (!held || held === fluid) return { cap: def.anyFluid, role: /** @type {const} */ ("store") };
  }
  return undefined;
}

function pushFluid(/** @type {Machine} */ from, fluid, /** @type {Set<string>} */ active) {
  const role = tankOf(from, fluid)?.role;
  if (!role || role === "in" || tank(from, fluid) <= 0) return;
  // Outputs fill inputs, then stores; stores only feed inputs, so tanks never ping-pong.
  for (const targetRole of role === "out" ? ["in", "store"] : ["in"]) {
    const targets = networkOf(from, DUCT)
      .filter((k) => active.has(k))
      .map((k) => /** @type {Machine} */ (machines.get(k)))
      .flatMap((t) => {
        const target = tankOf(t, fluid);
        if (target?.role !== targetRole) return [];
        const give = (/** @type {number} */ n) => {
          setTank(t, fluid, tank(t, fluid) + n);
          dirty.add(machineKey(t));
        };
        return [{ room: target.cap - tank(t, fluid), give }];
      });
    const given = share(tank(from, fluid), targets);
    if (given > 0) {
      setTank(from, fluid, tank(from, fluid) - given);
      dirty.add(machineKey(from));
    }
  }
}

// ---------- RBMK ----------

/** Every RBMK block joined to this channel, sideways or vertically. */
function rbmkStructure(/** @type {Machine} */ start) {
  const dimension = world.getDimension(start.dim);
  const seen = new Set([keyOf(start.dim, start.x, start.y, start.z)]);
  const queue = [{ x: start.x, y: start.y, z: start.z }];
  const found = [];
  while (queue.length && found.length < MAX_NETWORK) {
    const p = /** @type {{x: number, y: number, z: number}} */ (queue.shift());
    found.push(p);
    for (const [, dx, dy, dz] of SIDES) {
      const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
      const k = keyOf(start.dim, q.x, q.y, q.z);
      if (seen.has(k)) continue;
      seen.add(k);
      try {
        if (RBMK_TYPES.has(dimension.getBlock(q)?.typeId ?? "")) queue.push(q);
      } catch {
        // unloaded
      }
    }
  }
  return found;
}

/** АЗ-5: every control channel of the reactor drops fully in. */
function scramRbmk(/** @type {Machine} */ m) {
  for (const p of rbmkStructure(m)) {
    const column = machines.get(keyOf(m.dim, p.x, p.y, p.z));
    if (column?.type === RBMK.CONTROL) {
      column.control = 100;
      dirty.add(machineKey(column));
    }
  }
}

/** The whole reactor turns to debris, the failed channel blows up and the area is poisoned for long. */
function rbmkExplosion(/** @type {Machine} */ m) {
  const dimension = world.getDimension(m.dim);
  for (const p of rbmkStructure(m)) {
    removeMachine(keyOf(m.dim, p.x, p.y, p.z));
    try {
      dimension.setBlockType(p, "hbm:rbmk_debris");
    } catch {
      // unloaded
    }
  }
  for (const player of world.getAllPlayers()) {
    if (player.dimension.id === m.dim) player.sendMessage({ translate: "hbm.rbmk.meltdown" });
  }
  nuke(dimension, { x: m.x + 0.5, y: m.y + 1.5, z: m.z + 0.5 }, 8, { fallout: 50, falloutRadius: 150 });
}

// ---------- tick ----------

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
  /** @type {Map<string, boolean>} */
  const lit = new Map();

  for (const key of [...active]) {
    const m = /** @type {Machine} */ (machines.get(key));
    const run = MACHINES[m.type].run;
    if (!run) continue;
    lit.set(key, run(m, /** @type {import("@minecraft/server").Block} */ (blocks.get(key)), key));
    dirty.add(key);
    if (!machines.has(key)) active.delete(key);
  }

  const columns = [...active].map((k) => /** @type {Machine} */ (machines.get(k))).filter((m) => RBMK_TYPES.has(m.type));
  if (columns.length) {
    const machineAt = (dim, x, y, z) => (active.has(keyOf(dim, x, y, z)) ? machines.get(keyOf(dim, x, y, z)) : undefined);
    const typeAt = (dim, x, y, z) => {
      try {
        return world.getDimension(dim).getBlock({ x, y, z })?.typeId;
      } catch {
        return undefined;
      }
    };
    runRbmk(columns, machineAt, typeAt);
    for (const column of columns) {
      dirty.add(machineKey(column));
      if ((column.heat ?? 0) >= RBMK_OVERHEAT) warnNear(column, "hbm.rbmk.overheat", column.heat ?? 0);
    }
    const failed = columns.find((c) => (c.heat ?? 0) >= RBMK_MELTDOWN);
    if (failed) {
      rbmkExplosion(failed);
      for (const key of [...active]) if (!machines.has(key)) active.delete(key);
    }
  }

  const live = [...active].map((k) => /** @type {Machine} */ (machines.get(k)));
  for (const m of live) if (MACHINES[m.type].power === "gen") pushEnergy(m, ["use", "store"], active);
  for (const m of live) if (MACHINES[m.type].power === "store") pushEnergy(m, ["use"], active);
  for (const m of live) for (const fluid of FLUID_NAMES) pushFluid(m, fluid, active);

  for (const [key, on] of lit) {
    const block = blocks.get(key);
    if (block && machines.has(key) && MACHINES[block.typeId]?.lit) setLit(block, on);
  }
  save();
}

// ---------- conduits ----------

const isGridBlock = (typeId) => typeId === CABLE || typeId === DUCT || MACHINES[typeId] !== undefined;

/** Whether a conduit of this type joins to the block next to it. */
function joins(conduit, typeId) {
  if (typeId === conduit) return true;
  const def = MACHINES[typeId];
  if (!def) return false;
  return conduit === CABLE ? def.power !== undefined : def.tanks !== undefined || def.anyFluid !== undefined;
}

/** Re-joins the conduits at `location` and around it to their neighbours. */
function refreshConduits(dimension, location) {
  for (const [, dx, dy, dz] of [/** @type {[string, number, number, number]} */ (["", 0, 0, 0]), ...SIDES]) {
    const at = { x: location.x + dx, y: location.y + dy, z: location.z + dz };
    let conduit;
    try {
      conduit = dimension.getBlock(at);
    } catch {
      continue;
    }
    if (conduit?.typeId !== CABLE && conduit?.typeId !== DUCT) continue;
    let permutation = conduit.permutation;
    for (const [side, sx, sy, sz] of SIDES) {
      let neighbour;
      try {
        neighbour = dimension.getBlock({ x: at.x + sx, y: at.y + sy, z: at.z + sz });
      } catch {
        neighbour = undefined;
      }
      permutation = permutation.withState(`hbm:${side}`, joins(conduit.typeId, neighbour?.typeId ?? ""));
    }
    conduit.setPermutation(permutation);
  }
}

// ---------- player interaction ----------

const formatNumber = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const BLOCK_IDS = /^(ore_|block_|machine_|red_cable$|fluid_duct$|rbmk_(fuel|control|boiler|moderator|blank|debris)$|launch_pad$|det_|charge_|waste_)/;

/** Our ids use the pack's language file; vanilla ids fall back to a readable form of the id. */
function itemLabel(id) {
  if (id.startsWith("hbm:")) {
    const short = id.slice(4);
    return { translate: BLOCK_IDS.test(short) ? `tile.hbm.${short}.name` : `item.hbm.${short}.name` };
  }
  const words = id.replace(/^minecraft:/, "").split("_");
  return { text: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") };
}

function give(player, /** @type {Slot | undefined} */ slot) {
  const container = player.getComponent("minecraft:inventory")?.container;
  for (const stack of stacksOf(slot)) {
    const left = container?.addItem(stack) ?? stack;
    if (left) player.dimension.spawnItem(left, player.location);
  }
}

function returnStock(player, /** @type {Machine} */ m) {
  for (const [id, n] of Object.entries(m.stock ?? {})) if (n > 0) give(player, { id, n });
  m.stock = {};
  m.progress = 0;
}

function chooseRecipe(player, /** @type {Machine} */ m) {
  const form = new ActionFormData().title({ translate: "hbm.assembler.choose" });
  for (const recipe of ASSEMBLY) form.button({ rawtext: [itemLabel(recipe.output), { text: ` ×${recipe.count}` }] });
  form.show(player).then((response) => {
    if (response.selection === undefined || machines.get(machineKey(m)) !== m) return;
    returnStock(player, m);
    m.recipe = response.selection;
    dirty.add(machineKey(m));
    save();
  });
}

/** Loads the held item into the machine; false when the machine has no use for it. */
function insert(player, /** @type {Machine} */ m, held, container) {
  const def = MACHINES[m.type];
  const say = (message) => player.onScreenDisplay.setActionBar(message);
  let amount = 0;
  if (def.assembler) {
    if (!ASSEMBLY[m.recipe ?? -1]?.input[held.typeId]) return false;
    const stock = m.stock ?? {};
    amount = Math.min(held.amount, STACK - (stock[held.typeId] ?? 0));
    if (amount > 0) m.stock = { ...stock, [held.typeId]: (stock[held.typeId] ?? 0) + amount };
  } else {
    const slot = /** @type {SlotName | undefined} */ (Object.entries(def.accepts ?? {}).find(([, ok]) => ok?.(held.typeId))?.[0]);
    if (!slot) return false;
    const current = m[slot];
    if (current && current.id !== held.typeId) {
      say({ translate: "hbm.machine.slot_busy" });
      return true;
    }
    amount = Math.min(held.amount, (def.maxInput ?? STACK) - (current?.n ?? 0));
    if (amount > 0) m[slot] = add(current, held.typeId, amount);
  }
  if (amount <= 0) {
    say({ translate: "hbm.machine.slot_busy" });
    return true;
  }
  if (amount >= held.amount) {
    container.setItem(player.selectedSlotIndex, undefined);
  } else {
    held.amount -= amount;
    container.setItem(player.selectedSlotIndex, held);
  }
  dirty.add(machineKey(m));
  save();
  say({ rawtext: [{ translate: "hbm.machine.inserted", with: [String(amount)] }] });
  return true;
}

function interact(player, dim, location, type) {
  const m = ensureMachine(dim, location, type);
  const container = player.getComponent("minecraft:inventory")?.container;
  const held = container?.getItem(player.selectedSlotIndex);
  if (container && held && insert(player, m, held, container)) return;
  showMachine(player, m);
}

function showMachine(player, /** @type {Machine} */ m) {
  const def = MACHINES[m.type];
  const key = machineKey(m);
  /** @type {import("@minecraft/server").RawMessage[]} */
  const body = [];
  /** @type {{ label: string, run: () => void }[]} */
  const actions = [];
  /** @type {FormContext} */
  const ctx = {
    player,
    line: (translate, ...values) => {
      body.push({ translate, with: values.map(String) }, { text: "\n" });
    },
    slot: (translate, slot) => {
      body.push({ translate }, ...(slot ? [itemLabel(slot.id), { text: ` ×${slot.n}` }] : [{ translate: "hbm.machine.empty" }]), { text: "\n" });
    },
    action: (label, run) => {
      actions.push({ label, run });
    },
    take: (label, slot) => {
      actions.push({
        label,
        run: () => {
          give(player, m[slot]);
          m[slot] = undefined;
          if (slot === "input") m.progress = 0;
        },
      });
    },
  };

  if (def.maxEnergy) ctx.line("hbm.machine.energy", formatNumber(m.energy), formatNumber(def.maxEnergy));
  for (const fluid of FLUID_NAMES) {
    const t = tankOf(m, fluid);
    if (t && (def.tanks?.[fluid] || tank(m, fluid) > 0)) {
      body.push({ translate: `hbm.fluid.${fluid}` }, { text: `: ${formatNumber(tank(m, fluid))} / ${formatNumber(t.cap)} mB\n` });
    }
  }
  if (def.anyFluid && !FLUID_NAMES.some((f) => tank(m, f) > 0)) ctx.line("hbm.fluid.empty_tank", formatNumber(def.anyFluid));
  def.describe?.(m, ctx);
  if (def.power) ctx.line("hbm.machine.network", networkOf(m, CABLE).length);
  if (def.tanks || def.anyFluid) ctx.line("hbm.machine.pipes", networkOf(m, DUCT).length);
  body.push({ text: "\n" }, { translate: "hbm.machine.hint" });

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

/** Oil detector: looks for oil under a 13×13 area around the player. */
function detectOil(player) {
  const dimension = player.dimension;
  const px = Math.floor(player.location.x);
  const py = Math.floor(player.location.y);
  const pz = Math.floor(player.location.z);
  let best;
  for (let dx = -6; dx <= 6; dx += 2) {
    for (let dz = -6; dz <= 6; dz += 2) {
      for (let y = py - 1; y >= dimension.heightRange.min; y--) {
        let type;
        try {
          type = dimension.getBlock({ x: px + dx, y, z: pz + dz })?.typeId;
        } catch {
          break;
        }
        if (type !== OIL) continue;
        const distance = Math.hypot(dx, dz);
        if (!best || distance < best.distance) best = { distance, depth: py - y };
        break;
      }
    }
  }
  if (!best) player.sendMessage({ translate: "hbm.detector.none" });
  else if (best.distance === 0) player.sendMessage({ translate: "hbm.detector.below", with: [String(best.depth)] });
  else player.sendMessage({ translate: "hbm.detector.near", with: [String(Math.round(best.distance)), String(best.depth)] });
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

  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack.typeId === "hbm:oil_detector") detectOil(source);
  });

  world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
    if (!isGridBlock(block.typeId) && !RBMK_TYPES.has(block.typeId)) return;
    if (MACHINES[block.typeId]) ensureMachine(block.dimension.id, block.location, block.typeId);
    topology++;
    refreshConduits(block.dimension, block.location);
    save();
  });

  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (!isGridBlock(brokenBlockPermutation.type.id)) return;
    removeMachine(keyOf(block.dimension.id, block.location.x, block.location.y, block.location.z), block);
    topology++;
    refreshConduits(block.dimension, block.location);
    save();
  });

  world.afterEvents.blockExplode.subscribe(({ block, dimension, explodedBlockPermutation }) => {
    if (!isGridBlock(explodedBlockPermutation.type.id)) return;
    removeMachine(keyOf(dimension.id, block.location.x, block.location.y, block.location.z), block);
    topology++;
    refreshConduits(dimension, block.location);
    save();
  });
}
