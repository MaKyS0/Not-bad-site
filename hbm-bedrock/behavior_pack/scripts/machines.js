// Machines, the HE power grid and the fluid network, after HBM's TileEntityMachine* classes.
// Machines run once per second, so every per-tick number below is applied 20 times at once.
import { world, system, ItemStack, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { nuke } from "./bombs.js";
import { SMELT, SHRED, PRESS, ASSEMBLY, fuelTicks } from "./recipes.js";
import { RBMK, RBMK_TYPES, ROD_LIFE, RBMK_MELTDOWN, RBMK_OVERHEAT, runRbmk } from "./rbmk.js";
import { isMissile, launchMissile, targetOf } from "./missiles.js";
import { MACHINE_RECIPES, SMELT_EXTRA, SHRED_EXTRA, KNOWN_BLOCKS, FLUIDS } from "./imported_machines.js";
import { IMPORTED_RADS } from "./imported_rads.js";

const SECOND = 20;
const STACK = 64;
const CABLE = "hbm:red_cable";
const DUCT = "hbm:fluid_duct";
const PROP_PREFIX = "hbm:machine:";
/** Conduits and machines a single network search may visit. */
const MAX_NETWORK = 512;
const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);
/** Every fluid some machine makes or uses; HBM has about 150. */
const FLUID_NAMES = FLUIDS;

/**
 * @typedef {{ id: string, n: number }} Slot
 * @typedef {"input" | "output" | "fuel"} SlotName
 * @typedef {{
 *   type: string, dim: string, x: number, y: number, z: number, energy: number,
 *   input?: Slot, output?: Slot, fuel?: Slot, progress: number, burn: number,
 *   heat?: number, control?: number, burnup?: number, flux?: number,
 *   tanks?: Record<string, number>, recipe?: number, stock?: Record<string, number>,
 *   oilY?: number, oilRetry?: number, outbox?: Record<string, number>, mineY?: number, mineIndex?: number
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
 *   stockAccepts?: (id: string, m: Machine) => boolean, recipeList?: { output: string, count: number }[], autoRecipe?: boolean,
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
    recipe: smeltResult,
  }),
  "hbm:machine_shredder": processor({
    maxEnergy: 10_000,
    perTick: 5,
    duration: 60,
    recipe: (id) => shredResult(id),
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
    stockAccepts: (id, m) => !!ASSEMBLY[m.recipe ?? -1]?.input[id],
    recipeList: ASSEMBLY,
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
      ctx.action("hbm.assembler.choose", () => chooseRecipe(ctx.player, m, ASSEMBLY, false));
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
    accepts: { input: isMissile },
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

// ---------- machines imported from HBM ----------
// The blocks come from scripts/import-hbm.mjs; here each family gets behaviour, with HBM's
// recipe tables where the original has them and the logic of the hand-made machines otherwise.

function smeltResult(id) {
  const out = SMELT[id] ?? SMELT_EXTRA[id] ?? (charcoal(id) ? "minecraft:charcoal" : undefined);
  return out ? { id: out, count: 1 } : undefined;
}
function shredResult(id) {
  if (SHRED[id]) return { id: SHRED[id][0], count: SHRED[id][1] };
  const extra = SHRED_EXTRA[id];
  return extra ? { id: extra[0], count: extra[1] } : undefined;
}

const stampPattern = (type) => new RegExp(`^hbm:stamp_(\\w+_)?${type}$`);

/** A machine fed through a shared stock that runs one of HBM's recipe tables. */
const FLUID_TANK = 32_000;
const fluidOf = (/** @type {string | undefined} */ id) => (id?.startsWith("fluid:") ? id.slice(6) : undefined);

function recipeMachine(set, { speed = 1, power = true, maxEnergy = 200_000 } = {}) {
  const recipes = MACHINE_RECIPES[set] ?? [];
  // A tank for every fluid the recipes use: inputs fill from pipes, outputs drain into them.
  /** @type {Record<string, Tank>} */
  const tanks = {};
  for (const r of recipes) {
    for (const i of r.inputs) if (fluidOf(i.id)) tanks[/** @type {string} */ (fluidOf(i.id))] = { cap: FLUID_TANK, role: "in" };
  }
  for (const r of recipes) {
    for (const [id] of r.outputs) if (fluidOf(id) && !tanks[/** @type {string} */ (fluidOf(id))]) tanks[/** @type {string} */ (fluidOf(id))] = { cap: FLUID_TANK, role: "out" };
  }
  const list = recipes.map((r) => ({ output: r.outputs[0][0], count: r.outputs[0][1] }));
  const matches = (input, id) => (input.stamp ? stampPattern(input.stamp).test(id) : input.id === id);
  const has = (m, input) => {
    if (input.stamp) return Object.entries(m.stock ?? {}).some(([id, n]) => n > 0 && matches(input, id));
    const fluid = fluidOf(input.id);
    return fluid ? tank(m, fluid) >= input.n : (m.stock?.[input.id] ?? 0) >= input.n;
  };
  const room = (m, id, n) => {
    const fluid = fluidOf(id);
    return fluid ? tank(m, fluid) + n <= FLUID_TANK : (m.outbox?.[id] ?? 0) + n <= STACK * 4;
  };
  const ready = (m, r) => r.inputs.every((i) => has(m, i)) && r.outputs.every(([id, n]) => room(m, id, n));
  /** @type {MachineDef} */
  const def = {
    power: power ? "use" : undefined,
    maxEnergy: power ? maxEnergy : undefined,
    tanks: Object.keys(tanks).length ? tanks : undefined,
    recipeList: list,
    autoRecipe: true,
    stockAccepts: (id, m) => {
      const pool = (m.recipe ?? -1) >= 0 ? [recipes[m.recipe ?? 0]].filter(Boolean) : recipes;
      return pool.some((r) => r.inputs.some((i) => matches(i, id)));
    },
    run: (m) => {
      const chosen = (m.recipe ?? -1) >= 0 ? recipes[m.recipe ?? 0] : recipes.find((r) => ready(m, r));
      if (!chosen || !ready(m, chosen)) {
        m.progress = 0;
        return false;
      }
      const cost = power ? chosen.power * SECOND : 0;
      if (m.energy < cost) return false;
      m.energy -= cost;
      m.progress += SECOND * speed;
      if (m.progress >= chosen.ticks) {
        m.progress = 0;
        const stock = { ...m.stock };
        for (const i of chosen.inputs) {
          if (i.keep || !i.id) continue;
          const fluid = fluidOf(i.id);
          if (fluid) setTank(m, fluid, tank(m, fluid) - i.n);
          else stock[i.id] -= i.n;
        }
        m.stock = stock;
        const outbox = { ...m.outbox };
        // SILEX-style recipes yield one of their outputs at random.
        const outputs = chosen.pick ? [chosen.outputs[Math.floor(Math.random() * chosen.outputs.length)]] : chosen.outputs;
        for (const [id, n] of outputs) {
          const fluid = fluidOf(id);
          if (fluid) setTank(m, fluid, tank(m, fluid) + n);
          else outbox[id] = (outbox[id] ?? 0) + n;
        }
        m.outbox = outbox;
      }
      return true;
    },
    describe: (m, ctx) => {
      const chosen = (m.recipe ?? -1) >= 0 ? recipes[m.recipe ?? 0] : undefined;
      if (chosen) ctx.slot("hbm.assembler.recipe", { id: chosen.outputs[0][0], n: chosen.outputs[0][1] });
      else ctx.line("hbm.assembler.auto_line", recipes.length);
      if (chosen) for (const i of chosen.inputs) if (i.id) ctx.slot("hbm.assembler.needs", { id: i.id, n: i.n });
      for (const [id, n] of Object.entries(m.stock ?? {})) if (n > 0) ctx.slot("hbm.assembler.stock", { id, n });
      for (const [id, n] of Object.entries(m.outbox ?? {})) if (n > 0) ctx.slot("hbm.machine.output", { id, n });
      ctx.line("hbm.machine.progress", `${Math.floor(m.progress / SECOND)} / ${Math.ceil((chosen?.ticks ?? 0) / SECOND)} s`);
      ctx.action("hbm.assembler.choose", () => chooseRecipe(ctx.player, m, list, true));
      if (Object.values(m.outbox ?? {}).some((n) => n > 0)) ctx.action("hbm.machine.take_output", () => takeOutbox(ctx.player, m));
      if (Object.values(m.stock ?? {}).some((n) => n > 0)) ctx.action("hbm.assembler.take_stock", () => returnStock(ctx.player, m));
    },
  };
  return def;
}

function takeOutbox(player, /** @type {Machine} */ m) {
  for (const [id, n] of Object.entries(m.outbox ?? {})) if (n > 0) give(player, { id, n });
  m.outbox = {};
}

/** Fuel-fired furnace (HBM's iron, steel and combination furnaces). */
function fuelFurnace(speed) {
  /** @type {MachineDef} */
  const def = {
    accepts: { fuel: (id) => fuelTicks(id) > 0 && !smeltResult(id), input: (id) => smeltResult(id) !== undefined },
    run: (m) => {
      const result = m.input && smeltResult(m.input.id);
      if (!result || !fits(m.output, result.id, 1)) return m.burn > 0 && (m.burn = Math.max(0, m.burn - SECOND)) > 0;
      if (m.burn <= 0) {
        if (!m.fuel) return false;
        m.burn = fuelTicks(m.fuel.id);
        m.fuel = take(m.fuel, 1);
      }
      m.burn -= SECOND;
      m.progress += SECOND * speed;
      if (m.progress >= 200) {
        m.progress = 0;
        m.input = take(/** @type {Slot} */ (m.input), 1);
        m.output = add(m.output, result.id, 1);
      }
      return true;
    },
    describe: (m, ctx) => {
      ctx.slot("hbm.machine.fuel", m.fuel);
      ctx.slot("hbm.machine.input", m.input);
      ctx.slot("hbm.machine.output", m.output);
      ctx.line("hbm.machine.progress", `${Math.floor((m.progress / 200) * 100)}%`);
      if (m.output) ctx.take("hbm.machine.take_output", "output");
      if (m.input) ctx.take("hbm.machine.take_input", "input");
      if (m.fuel) ctx.take("hbm.machine.take_fuel", "fuel");
    },
  };
  return def;
}

/** Burns solid fuel into HE (Stirling engines and the like). */
function burnerGenerator(hePerTick, maxEnergy = 100_000) {
  /** @type {MachineDef} */
  const def = {
    power: "gen",
    maxEnergy,
    accepts: { fuel: (id) => fuelTicks(id) > 0 },
    run: (m) => {
      if (m.energy >= maxEnergy) return m.burn > 0;
      if (m.burn <= 0) {
        if (!m.fuel) return false;
        m.burn = fuelTicks(m.fuel.id);
        m.fuel = take(m.fuel, 1);
      }
      const burned = Math.min(SECOND, m.burn);
      m.burn -= burned;
      m.energy = Math.min(maxEnergy, m.energy + burned * hePerTick);
      return true;
    },
    describe: (m, ctx) => {
      ctx.slot("hbm.machine.fuel", m.fuel);
      if (m.burn > 0) ctx.line("hbm.machine.burning", Math.ceil(m.burn / SECOND));
      if (m.fuel) ctx.take("hbm.machine.take_input", "fuel");
    },
  };
  return def;
}

/** Burns a fluid fuel from its tank into HE. */
function fluidGenerator(fluid, perSecond, hePerSecond, maxEnergy = 200_000) {
  /** @type {MachineDef} */
  const def = {
    power: "gen",
    maxEnergy,
    tanks: { [fluid]: { cap: 32_000, role: "in" } },
    run: (m) => {
      if (tank(m, fluid) < perSecond || m.energy >= maxEnergy) return false;
      setTank(m, fluid, tank(m, fluid) - perSecond);
      m.energy = Math.min(maxEnergy, m.energy + hePerSecond);
      return true;
    },
  };
  return def;
}

/** Steam turbines of every size: steam in, condensate out, 5 HE per mB. */
function turbine(rate, maxEnergy = 1_000_000) {
  /** @type {MachineDef} */
  const def = {
    power: "gen",
    maxEnergy,
    tanks: { steam: { cap: rate * 8, role: "in" }, water: { cap: rate * 8, role: "out" } },
    run: (m) => {
      const used = Math.min(tank(m, "steam"), rate);
      if (used <= 0) return false;
      setTank(m, "steam", tank(m, "steam") - used);
      setTank(m, "water", Math.min(rate * 8, tank(m, "water") + used));
      m.energy = Math.min(maxEnergy, m.energy + used * 5);
      return true;
    },
  };
  return def;
}

/** Boilers: water in, steam out; heated by fuel, or by the sun for the solar boiler. */
function boiler(rate, solar = false) {
  /** @type {MachineDef} */
  const def = {
    tanks: { water: { cap: rate * 8, role: "in" }, steam: { cap: rate * 8, role: "out" } },
    accepts: solar ? undefined : { fuel: (id) => fuelTicks(id) > 0 },
    run: (m) => {
      if (solar) {
        const time = world.getTimeOfDay();
        if (time > 12_500) return false;
      } else if (m.burn <= 0) {
        if (!m.fuel) return false;
        m.burn = fuelTicks(m.fuel.id);
        m.fuel = take(m.fuel, 1);
      }
      if (!solar) m.burn = Math.max(0, m.burn - SECOND);
      const boiled = Math.min(rate, tank(m, "water"), rate * 8 - tank(m, "steam"));
      setTank(m, "water", tank(m, "water") - boiled);
      setTank(m, "steam", tank(m, "steam") + boiled);
      return boiled > 0;
    },
    describe: solar
      ? undefined
      : (m, ctx) => {
          ctx.slot("hbm.machine.fuel", m.fuel);
          if (m.fuel) ctx.take("hbm.machine.take_input", "fuel");
        },
  };
  return def;
}

/** Condensers and cooling towers: steam back to water. */
function condenser(rate) {
  /** @type {MachineDef} */
  const def = {
    tanks: { steam: { cap: rate * 8, role: "in" }, water: { cap: rate * 8, role: "out" } },
    run: (m) => {
      const done = Math.min(rate, tank(m, "steam"), rate * 8 - tank(m, "water"));
      setTank(m, "steam", tank(m, "steam") - done);
      setTank(m, "water", tank(m, "water") + done);
      return done > 0;
    },
  };
  return def;
}

/** RTG: each pellet gives a steady trickle of power forever, as in HBM. */
const RTG_PELLET = /^hbm:pellet_rtg/;
function rtg(perPellet, maxPellets) {
  /** @type {MachineDef} */
  const def = {
    power: "gen",
    maxEnergy: 100_000,
    maxInput: maxPellets,
    accepts: { input: (id) => RTG_PELLET.test(id) },
    run: (m) => {
      const pellets = m.input?.n ?? 0;
      m.energy = Math.min(100_000, m.energy + pellets * perPellet);
      return pellets > 0;
    },
    describe: (m, ctx) => {
      ctx.slot("hbm.machine.fuel", m.input);
      if (m.input) ctx.take("hbm.machine.take_input", "input");
    },
  };
  return def;
}

/** Radiation generator: eats radioactive items, more power the hotter they are. */
const radioactivity = (id) => IMPORTED_RADS[id] ?? 0;
/** @type {MachineDef} */
const RADGEN = {
  power: "gen",
  maxEnergy: 500_000,
  accepts: { fuel: (id) => radioactivity(id) > 0 },
  run: (m) => {
    if (m.burn <= 0) {
      if (!m.fuel) return false;
      m.burn = 10 * SECOND;
      m.progress = radioactivity(m.fuel.id);
      m.fuel = take(m.fuel, 1);
    }
    m.burn -= SECOND;
    m.energy = Math.min(500_000, m.energy + Math.ceil(m.progress * 200));
    return true;
  },
  describe: (m, ctx) => {
    ctx.slot("hbm.machine.fuel", m.fuel);
    if (m.fuel) ctx.take("hbm.machine.take_input", "fuel");
  },
};

/** Oil wells, pumpjacks and fracking towers: the derrick, faster. */
function derrick(speed) {
  const base = MACHINES["hbm:machine_derrick"];
  /** @type {MachineDef} */
  const def = {
    ...base,
    run: (m, block, key) => {
      let ok = false;
      for (let i = 0; i < speed; i++) ok = (base.run?.(m, block, key) ?? false) || ok;
      return ok;
    },
  };
  return def;
}

/** Turrets shoot the nearest hostile mob; most need ammo, all need power. */
const AMMO = /^hbm:(ammo_|gun_\w+_ammo|.*bullet|.*shell)|^minecraft:arrow$/;
function turret({ damage, range, shots = 1, ammo = true, explode = 0, fire = 0, freeze = false, particle = "minecraft:basic_crit_particle" }) {
  /** @type {MachineDef} */
  const def = {
    power: "use",
    maxEnergy: 100_000,
    accepts: ammo ? { input: (id) => AMMO.test(id) } : undefined,
    run: (m, block) => {
      let fired = false;
      const from = { x: m.x + 0.5, y: m.y + 1.2, z: m.z + 0.5 };
      for (let shot = 0; shot < shots; shot++) {
        if (m.energy < 200 || (ammo && !m.input)) break;
        const target = block.dimension.getEntities({ location: from, maxDistance: range, families: ["monster"], closest: 1 })[0];
        if (!target) break;
        const to = target.location;
        const length = Math.max(1, Math.hypot(to.x - from.x, to.y + 1 - from.y, to.z - from.z));
        for (let d = 0; d < length; d += 1.5) {
          const t = d / length;
          try {
            block.dimension.spawnParticle(particle, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y + 1 - from.y) * t, z: from.z + (to.z - from.z) * t });
          } catch {
            break;
          }
        }
        try {
          target.applyDamage(damage, { cause: EntityDamageCause.entityAttack });
          if (fire) target.setOnFire(fire, true);
          if (freeze) target.addEffect("slowness", 100, { amplifier: 3 });
          if (explode) block.dimension.createExplosion(to, explode, { breaksBlocks: false });
        } catch {
          // the target is gone
        }
        m.energy -= 200;
        if (ammo) m.input = take(/** @type {Slot} */ (m.input), 1);
        fired = true;
      }
      return fired;
    },
    describe: (m, ctx) => {
      ctx.line("hbm.turret.stats", damage, range, shots);
      if (ammo) ctx.slot("hbm.turret.ammo", m.input);
      if (m.input) ctx.take("hbm.machine.take_input", "input");
    },
  };
  return def;
}

/** Radar: lists every creature and player in range with distance and bearing. */
function radar(range) {
  /** @type {MachineDef} */
  const def = {
    power: "use",
    maxEnergy: 50_000,
    describe: (m, ctx) => {
      const block = blockOf(m);
      if (!block) return;
      const here = { x: m.x + 0.5, y: m.y, z: m.z + 0.5 };
      const contacts = block.dimension
        .getEntities({ location: here, maxDistance: range, excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:arrow"] })
        .filter((e) => e.typeId === "minecraft:player" || e.matches({ families: ["monster"] }) || e.matches({ families: ["mob"] }))
        .slice(0, 20);
      ctx.line("hbm.radar.count", contacts.length, range);
      for (const e of contacts) {
        const dx = e.location.x - here.x;
        const dz = e.location.z - here.z;
        const bearing = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "S" : "N";
        const label = e.typeId === "minecraft:player" ? /** @type {any} */ (e).name ?? "player" : e.typeId.replace(/^minecraft:/, "");
        ctx.line("hbm.radar.contact", label, Math.round(Math.hypot(dx, dz)), bearing);
      }
    },
  };
  return def;
}

/** Mining laser / excavator: digs out a square shaft below itself, layer by layer. */
function miner(size, perSecond) {
  /** @type {MachineDef} */
  const def = {
    power: "use",
    maxEnergy: 500_000,
    run: (m, block) => {
      const dimension = block.dimension;
      const half = Math.floor(size / 2);
      let mined = 0;
      let checked = 0;
      m.mineY ??= m.y - 1;
      m.mineIndex ??= 0;
      while (mined < perSecond && checked < size * size * 2 && m.mineY > dimension.heightRange.min && m.energy >= 1000) {
        checked++;
        const dx = (m.mineIndex % size) - half;
        const dz = Math.floor(m.mineIndex / size) - half;
        const at = { x: m.x + dx, y: m.mineY, z: m.z + dz };
        m.mineIndex++;
        if (m.mineIndex >= size * size) {
          m.mineIndex = 0;
          m.mineY--;
        }
        let type;
        try {
          type = dimension.getBlock(at)?.typeId;
        } catch {
          return mined > 0;
        }
        if (!type || /air|water|lava|bedrock|barrier/.test(type)) continue;
        dimension.runCommand(`setblock ${at.x} ${at.y} ${at.z} air destroy`);
        m.energy -= 1000;
        mined++;
      }
      // Bring the drops up to the machine so nothing is left at the bottom of the shaft.
      if (mined) {
        system.runTimeout(() => {
          try {
            for (const item of dimension.getEntities({ type: "minecraft:item", location: { x: m.x, y: m.mineY ?? m.y, z: m.z }, maxDistance: size + 4 })) {
              item.teleport({ x: m.x + 0.5, y: m.y + 1.5, z: m.z + 0.5 });
            }
          } catch {
            // unloaded
          }
        }, 5);
      }
      return mined > 0;
    },
    describe: (m, ctx) => ctx.line("hbm.miner.depth", m.y - (m.mineY ?? m.y - 1)),
  };
  return def;
}

/** Autosaw: fells logs within reach and drops them by the machine. */
/** @type {MachineDef} */
const AUTOSAW = {
  power: "use",
  maxEnergy: 50_000,
  run: (m, block) => {
    if (m.energy < 500) return false;
    for (let dy = 0; dy <= 8; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        for (let dz = -5; dz <= 5; dz++) {
          const at = { x: m.x + dx, y: m.y + dy, z: m.z + dz };
          let type;
          try {
            type = block.dimension.getBlock(at)?.typeId;
          } catch {
            continue;
          }
          if (!type || !/_(log|stem)$/.test(type)) continue;
          block.dimension.runCommand(`setblock ${at.x} ${at.y} ${at.z} air destroy`);
          m.energy -= 500;
          return true;
        }
      }
    }
    return false;
  },
};

/** Annihilator: destroys whatever is put into it. */
/** @type {MachineDef} */
const ANNIHILATOR = {
  accepts: { input: () => true },
  run: (m) => {
    m.input = undefined;
    return false;
  },
};

const researchReactor = MACHINES["hbm:machine_reactor"];
/** ZIRNOX runs on its own rods; spent ones come out as their depleted variant when HBM has one. */
/** @type {MachineDef} */
const ZIRNOX = {
  ...researchReactor,
  accepts: { input: (id) => /^hbm:rod_zirnox_/.test(id) && !/depleted/.test(id) },
};

const assembler = recipeMachine("assembly");
const launchPad = MACHINES["hbm:launch_pad"];
Object.assign(MACHINES, {
  "hbm:machine_assembly_machine": assembler,
  "hbm:machine_assembly_factory": recipeMachine("assembly", { speed: 4, maxEnergy: 1_000_000 }),
  "hbm:machine_chemical_factory": recipeMachine("chemical", { speed: 2 }),
  "hbm:machine_precass": recipeMachine("precass"),
  "hbm:machine_rockmill": recipeMachine("rockmill", { power: false }),
  "hbm:machine_supercomputer": recipeMachine("supercomputer"),
  "hbm:machine_centrifuge": recipeMachine("centrifuge"),
  "hbm:machine_epress": recipeMachine("press"),
  "hbm:machine_conveyor_press": recipeMachine("press", { speed: 2 }),
  "hbm:machine_blast_furnace": recipeMachine("blast", { power: false }),
  "hbm:furnace_iron": fuelFurnace(1),
  "hbm:furnace_steel": fuelFurnace(2),
  "hbm:furnace_combination": fuelFurnace(3),
  "hbm:machine_arc_furnace": processor({ maxEnergy: 500_000, perTick: 200, duration: 20, recipe: smeltResult }),
  "hbm:machine_rotary_furnace": processor({ maxEnergy: 200_000, perTick: 100, duration: 40, recipe: smeltResult }),
  "hbm:machine_microwave": processor({ maxEnergy: 50_000, perTick: 50, duration: 40, recipe: smeltResult }),
  "hbm:machine_stirling": burnerGenerator(50),
  "hbm:machine_stirling_steel": burnerGenerator(150),
  "hbm:machine_stirling_creative": { power: "gen", maxEnergy: 1_000_000, run: (m) => ((m.energy = 1_000_000), true) },
  "hbm:machine_combustion_engine": fluidGenerator("diesel", 10, 3000),
  "hbm:machine_turbofan": fluidGenerator("diesel", 40, 15_000, 1_000_000),
  "hbm:machine_turbinegas": fluidGenerator("diesel", 25, 9000, 500_000),
  "hbm:machine_rtg_grey": rtg(100, 15),
  "hbm:machine_radgen": RADGEN,
  "hbm:machine_steam_engine": turbine(500),
  "hbm:machine_large_turbine": turbine(4000, 5_000_000),
  "hbm:machine_industrial_turbine": turbine(10_000, 10_000_000),
  "hbm:machine_chungus": turbine(40_000, 100_000_000),
  "hbm:machine_boiler": boiler(1000),
  "hbm:machine_industrial_boiler": boiler(8000),
  "hbm:machine_solar_boiler": boiler(1500, true),
  "hbm:machine_condenser": condenser(2000),
  "hbm:machine_condenser_powered": condenser(10_000),
  "hbm:machine_tower_small": condenser(5000),
  "hbm:machine_tower_large": condenser(20_000),
  "hbm:machine_battery_socket": { power: "store", maxEnergy: 5_000_000 },
  "hbm:machine_battery_redd": { power: "store", maxEnergy: 100_000_000 },
  "hbm:machine_bat9000": { anyFluid: 2_048_000 },
  "hbm:machine_bigasstank": { anyFluid: 512_000 },
  "hbm:machine_orbus": { anyFluid: 1_024_000 },
  "hbm:machine_storage_drum": { anyFluid: 128_000 },
  "hbm:machine_well": derrick(1),
  "hbm:machine_pumpjack": derrick(3),
  "hbm:machine_fracking_tower": derrick(6),
  "hbm:machine_fraction_tower": MACHINES["hbm:machine_refinery"],
  "hbm:machine_catalytic_cracker": MACHINES["hbm:machine_refinery"],
  "hbm:machine_vacuum_distill": MACHINES["hbm:machine_refinery"],
  "hbm:machine_hydrotreater": MACHINES["hbm:machine_refinery"],
  "hbm:machine_catalytic_reformer": MACHINES["hbm:machine_refinery"],
  "hbm:machine_coker": MACHINES["hbm:machine_refinery"],
  "hbm:machine_reactor_small": researchReactor,
  "hbm:machine_zirnox": ZIRNOX,
  "hbm:launch_pad_rusted": launchPad,
  "hbm:launch_pad_large": launchPad,
  "hbm:compact_launcher": launchPad,
  "hbm:launch_table": launchPad,
  "hbm:turret_chekhov": turret({ damage: 6, range: 48, shots: 4 }),
  "hbm:turret_friendly": turret({ damage: 6, range: 48, shots: 4 }),
  "hbm:turret_jeremy": turret({ damage: 25, range: 64, explode: 2 }),
  "hbm:turret_tauon": turret({ damage: 15, range: 48, shots: 2, ammo: false, particle: "minecraft:electric_spark_particle" }),
  "hbm:turret_richard": turret({ damage: 10, range: 64, explode: 3 }),
  "hbm:turret_howard": turret({ damage: 3, range: 32, shots: 10 }),
  "hbm:turret_howard_damaged": turret({ damage: 3, range: 32, shots: 5 }),
  "hbm:turret_maxwell": turret({ damage: 12, range: 32, ammo: false, fire: 4, particle: "minecraft:basic_flame_particle" }),
  "hbm:turret_fritz": turret({ damage: 4, range: 16, shots: 3, fire: 8, particle: "minecraft:basic_flame_particle" }),
  "hbm:turret_arty": turret({ damage: 20, range: 128, explode: 4 }),
  "hbm:turret_himars": turret({ damage: 15, range: 128, shots: 3, explode: 3 }),
  "hbm:turret_sentry": turret({ damage: 5, range: 32, shots: 2 }),
  "hbm:turret_sentry_damaged": turret({ damage: 5, range: 24 }),
  "hbm:machine_radar": radar(128),
  "hbm:machine_radar_large": radar(256),
  "hbm:machine_mining_laser": miner(9, 4),
  "hbm:machine_excavator": miner(5, 2),
  "hbm:machine_autosaw": AUTOSAW,
  "hbm:machine_annihilator": ANNIHILATOR,
});
/**
 * A machine that makes a fluid out of nothing but power or surroundings (air intake, geothermal...).
 * @param {string} fluid
 * @param {number} perSecond
 * @param {{ powerPerSecond?: number, needs?: (block: import("@minecraft/server").Block) => boolean }} [options]
 */
function fluidSource(fluid, perSecond, { powerPerSecond = 0, needs } = {}) {
  /** @type {MachineDef} */
  const def = {
    power: powerPerSecond ? "use" : undefined,
    maxEnergy: powerPerSecond ? 100_000 : undefined,
    tanks: { [fluid]: { cap: FLUID_TANK, role: "out" } },
    run: (m, block) => {
      if (needs && !needs(block)) return false;
      if (m.energy < powerPerSecond) return false;
      const made = Math.min(perSecond, FLUID_TANK - tank(m, fluid));
      if (made <= 0) return false;
      m.energy -= powerPerSecond;
      setTank(m, fluid, tank(m, fluid) + made);
      return true;
    },
  };
  return def;
}

/** Drains and flare stacks: whatever fluid arrives is disposed of; a flare turns gas into a little power. */
function sink(hePerMb) {
  /** @type {MachineDef} */
  const def = {
    power: hePerMb ? "gen" : undefined,
    maxEnergy: hePerMb ? 100_000 : undefined,
    anyFluid: 16_000,
    run: (m) => {
      const held = Object.entries(m.tanks ?? {}).find(([, n]) => n > 0);
      if (!held) return false;
      const burned = Math.min(held[1], 1000);
      setTank(m, held[0], held[1] - burned);
      if (hePerMb) m.energy = Math.min(100_000, m.energy + burned * hePerMb);
      return true;
    },
  };
  return def;
}

const touches = (block, type) => [block.north(), block.south(), block.east(), block.west(), block.below()].some((b) => b?.typeId?.includes(type));

/** Forcefield: shoves hostile mobs out of a 16-block bubble while powered. */
/** @type {MachineDef} */
const FORCEFIELD = {
  power: "use",
  maxEnergy: 200_000,
  run: (m, block) => {
    if (m.energy < 2000) return false;
    const here = { x: m.x + 0.5, y: m.y + 0.5, z: m.z + 0.5 };
    for (const e of block.dimension.getEntities({ location: here, maxDistance: 16, families: ["monster"] })) {
      const dx = e.location.x - here.x;
      const dz = e.location.z - here.z;
      const d = Math.max(0.5, Math.hypot(dx, dz));
      try {
        e.applyImpulse({ x: (dx / d) * 1.5, y: 0.4, z: (dz / d) * 1.5 });
      } catch {
        // not pushable
      }
    }
    m.energy -= 2000;
    return true;
  },
};

/** Siren: wails at everyone within 64 blocks while it gets a redstone signal. */
/** @type {MachineDef} */
const SIREN = {
  run: (m, block) => {
    const powered = (block.getRedstonePower() ?? 0) > 0 || [block.north(), block.south(), block.east(), block.west(), block.above(), block.below()].some((b) => (b?.getRedstonePower() ?? 0) > 0);
    if (!powered) return false;
    for (const player of world.getAllPlayers()) {
      if (player.dimension.id === m.dim && Math.hypot(player.location.x - m.x, player.location.z - m.z) < 64) player.playSound("mob.wither.ambient", { volume: 0.6, pitch: 0.5 });
    }
    return true;
  },
};

/** Radiation detector: the form shows the dose rate the radiation system reads here. */
/** @type {MachineDef} */
const DETECTOR = {
  describe: (m, ctx) => {
    let total = 0;
    const block = blockOf(m);
    for (const e of block?.dimension.getEntities({ type: "minecraft:item", location: { x: m.x, y: m.y, z: m.z }, maxDistance: 8 }) ?? []) {
      const stack = e.getComponent("minecraft:item")?.itemStack;
      if (stack) total += (IMPORTED_RADS[stack.typeId] ?? 0) * stack.amount;
    }
    ctx.line("hbm.detector.rads", total.toFixed(2));
  },
};

Object.assign(MACHINES, {
  "hbm:machine_chemical_factory": recipeMachine("chemical", { speed: 2 }),
  "hbm:machine_purex": recipeMachine("purex"),
  "hbm:machine_crystallizer": recipeMachine("crystallizer"),
  "hbm:machine_liquefactor": recipeMachine("liquefaction"),
  "hbm:machine_solidifier": recipeMachine("solidification"),
  "hbm:machine_mixer": recipeMachine("mixer"),
  "hbm:machine_electrolyser": recipeMachine("electrolysis"),
  "hbm:machine_compressor": recipeMachine("compressor"),
  "hbm:machine_compressor_compact": recipeMachine("compressor", { speed: 2 }),
  "hbm:machine_cyclotron": recipeMachine("cyclotron"),
  "hbm:machine_silex": recipeMachine("silex"),
  "hbm:machine_exposure_chamber": recipeMachine("exposure"),
  "hbm:machine_arc_welder": recipeMachine("arcwelder"),
  "hbm:machine_soldering_station": recipeMachine("soldering"),
  "hbm:machine_ammo_press": recipeMachine("ammopress", { power: false }),
  "hbm:furnace_combination": recipeMachine("combination", { power: false }),
  "hbm:machine_hydrotreater": recipeMachine("hydrotreating"),
  "hbm:machine_catalytic_reformer": recipeMachine("reforming"),
  "hbm:machine_fraction_tower": recipeMachine("refinery"),
  "hbm:machine_vacuum_distill": recipeMachine("refinery"),
  "hbm:machine_intake": fluidSource("air", 1000),
  "hbm:machine_deuterium_tower": fluidSource("heavywater", 20, { powerPerSecond: 2000, needs: (b) => touches(b, "water") }),
  "hbm:machine_hephaestus": fluidSource("lava", 100, { needs: (b) => touches(b, "lava") }),
  "hbm:machine_drain": sink(0),
  "hbm:machine_flare": sink(2),
  "hbm:machine_forcefield": FORCEFIELD,
  "hbm:machine_siren": SIREN,
  "hbm:machine_detector": DETECTOR,
  "hbm:machine_transformer": { power: "store", maxEnergy: 1_000_000 },
  "hbm:machine_converter_he_rf": { power: "store", maxEnergy: 1_000_000 },
  "hbm:machine_converter_rf_he": { power: "store", maxEnergy: 1_000_000 },
  "hbm:machine_sawmill": processor({ maxEnergy: 20_000, perTick: 10, duration: 40, recipe: (id) => (/_log$|_stem$/.test(id) ? { id: id.replace(/^minecraft:(stripped_)?/, "minecraft:").replace(/_(log|stem)$/, "_planks"), count: 6 } : undefined) }),
});

// Only blocks that exist get behaviour.
for (const id of Object.keys(MACHINES)) if (id.startsWith("hbm:") && !KNOWN_BLOCKS.has(id)) delete MACHINES[id];

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
    const stock = Object.entries({ ...m.stock, ...m.outbox }).map(([id, n]) => ({ id, n }));
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
  const current = block.permutation.getState("hbm:lit");
  // Imported blocks have no lit state even when they share a hand-made machine's behaviour.
  if (current !== undefined && current !== lit) {
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
  for (const m of live) for (const [fluid, amount] of Object.entries(m.tanks ?? {})) if (amount > 0) pushFluid(m, fluid, active);

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
  if (id.startsWith("fluid:")) return { translate: `hbm.fluid.${id.slice(6)}` };
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

/** Recipe picker; with `auto`, the first button lets the machine pick whatever its stock allows. */
function chooseRecipe(player, /** @type {Machine} */ m, /** @type {{ output: string, count: number }[]} */ list, auto) {
  const form = new ActionFormData().title({ translate: "hbm.assembler.choose" });
  if (auto) form.button({ translate: "hbm.assembler.auto" });
  for (const recipe of list) form.button({ rawtext: [itemLabel(recipe.output), { text: ` ×${recipe.count}` }] });
  form.show(player).then((response) => {
    if (response.selection === undefined || machines.get(machineKey(m)) !== m) return;
    if (!auto) returnStock(player, m);
    m.recipe = auto ? response.selection - 1 : response.selection;
    dirty.add(machineKey(m));
    save();
  });
}

/** Loads the held item into the machine; false when the machine has no use for it. */
function insert(player, /** @type {Machine} */ m, held, container) {
  const def = MACHINES[m.type];
  const say = (message) => player.onScreenDisplay.setActionBar(message);
  // Buckets: pour water or lava into a tank that takes it, or scoop it out with an empty bucket.
  const bucketFluid = { "minecraft:water_bucket": "water", "minecraft:lava_bucket": "lava" }[held.typeId];
  if (bucketFluid) {
    const t = tankOf(m, bucketFluid);
    if (!t || t.role === "out" || tank(m, bucketFluid) + 1000 > t.cap) return false;
    setTank(m, bucketFluid, tank(m, bucketFluid) + 1000);
    container.setItem(player.selectedSlotIndex, new ItemStack("minecraft:bucket", 1));
    dirty.add(machineKey(m));
    save();
    say({ rawtext: [{ translate: "hbm.machine.poured" }, { translate: `hbm.fluid.${bucketFluid}` }] });
    return true;
  }
  if (held.typeId === "minecraft:bucket") {
    const fluid = ["water", "lava"].find((f) => tank(m, f) >= 1000);
    if (!fluid) return false;
    setTank(m, fluid, tank(m, fluid) - 1000);
    if (held.amount > 1) {
      held.amount -= 1;
      container.setItem(player.selectedSlotIndex, held);
      give(player, { id: `minecraft:${fluid}_bucket`, n: 1 });
    } else {
      container.setItem(player.selectedSlotIndex, new ItemStack(`minecraft:${fluid}_bucket`, 1));
    }
    dirty.add(machineKey(m));
    save();
    return true;
  }
  let amount = 0;
  if (def.stockAccepts) {
    if (!def.stockAccepts(held.typeId, m)) return false;
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
