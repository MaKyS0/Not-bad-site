// Recipe tables for the machines. Ore and powder numbers follow HBM; vanilla entries mirror the furnace.

export const METALS = [
  ["ore_uranium", "ingot_uranium", "powder_uranium"],
  ["ore_titanium", "ingot_titanium", "powder_titanium"],
  ["ore_lead", "ingot_lead", "powder_lead"],
  ["ore_thorium", "ingot_th232", "powder_thorium"],
  ["ore_tungsten", "ingot_tungsten", "powder_tungsten"],
  ["ore_aluminium", "ingot_aluminium", "powder_aluminium"],
  ["ore_beryllium", "ingot_beryllium", "powder_beryllium"],
];

/** @type {Record<string, string>} input -> smelted output, one for one. */
export const SMELT = {
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
export const SHRED = {
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
  "hbm:rbmk_fuel_depleted": ["hbm:nugget_pu239", 9],
};

for (const [ore, ingot, powder] of METALS) {
  SMELT[`hbm:${ore}`] = `hbm:${ingot}`;
  SMELT[`hbm:${powder}`] = `hbm:${ingot}`;
  SHRED[`hbm:${ore}`] = [`hbm:${powder}`, 2];
  SHRED[`hbm:${ingot}`] = [`hbm:${powder}`, 1];
}

/** Furnace burn time in ticks; the wood burner turns every burning tick into 100 HE. */
export function fuelTicks(id) {
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

/** @type {Record<string, string>} ingot -> plate, one for one, like HBM's press with a plate stamp. */
export const PRESS = {
  "minecraft:iron_ingot": "hbm:plate_iron",
  "hbm:ingot_steel": "hbm:plate_steel",
  "minecraft:copper_ingot": "hbm:plate_copper",
  "minecraft:gold_ingot": "hbm:plate_gold",
  "hbm:ingot_titanium": "hbm:plate_titanium",
  "hbm:ingot_lead": "hbm:plate_lead",
  "hbm:ingot_aluminium": "hbm:plate_aluminium",
};

/**
 * Assembly machine recipes: ingredients, product and time in ticks.
 * @type {{ output: string, count: number, ticks: number, input: Record<string, number> }[]}
 */
export const ASSEMBLY = [
  { output: "hbm:circuit", count: 2, ticks: 100, input: { "hbm:plate_copper": 1, "hbm:plate_iron": 1, "minecraft:redstone": 2 } },
  { output: "hbm:motor", count: 1, ticks: 100, input: { "hbm:plate_steel": 2, "hbm:coil_copper": 2, "hbm:plate_iron": 1 } },
  { output: "hbm:rbmk_fuel_ueu", count: 1, ticks: 200, input: { "hbm:rod_empty": 1, "hbm:ingot_uranium": 6, "hbm:plate_steel": 2 } },
  { output: "hbm:missile_generic", count: 1, ticks: 300, input: { "hbm:plate_titanium": 6, "hbm:det_charge": 1, "hbm:circuit": 2, "minecraft:blaze_powder": 2 } },
  { output: "hbm:missile_incendiary", count: 1, ticks: 300, input: { "hbm:plate_aluminium": 6, "minecraft:fire_charge": 4, "hbm:circuit": 2, "minecraft:blaze_powder": 2 } },
  { output: "hbm:missile_nuclear", count: 1, ticks: 400, input: { "hbm:missile_generic": 1, "hbm:det_nuke": 1, "hbm:plate_lead": 4, "hbm:circuit": 4 } },
  { output: "hbm:gun_b92", count: 1, ticks: 400, input: { "hbm:plate_steel": 4, "hbm:circuit": 4, "minecraft:diamond": 2, "minecraft:redstone_block": 2 } },
  { output: "hbm:gun_rifle", count: 1, ticks: 300, input: { "hbm:plate_steel": 6, "hbm:ingot_tungsten": 2, "hbm:motor": 1 } },
  { output: "hbm:grenade_nuclear", count: 2, ticks: 200, input: { "hbm:grenade_he": 2, "hbm:nugget_pu239": 3, "hbm:plate_lead": 1 } },
];
