// Writes every data file of both packs from the tables below: blocks, items, recipes,
// ore generation, armor attachables, texture atlases, sounds and both languages.
// Textures and scripts are kept by hand. Run `npm run generate` after editing a table.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(root, "behavior_pack");
const RP = join(root, "resource_pack");

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
}

const lang = { en_US: {}, ru_RU: {} };
function name(key, en, ru) {
  lang.en_US[key] = en;
  lang.ru_RU[key] = ru;
}

// ---------- ores: vein count, vein size and height range follow HbmWorldGen ----------

/** Metal ores smelt into an ingot and shred into two powders. */
const METALS = [
  { metal: "uranium", ingot: "ingot_uranium", powder: "powder_uranium", veins: 7, size: 5, y: [8, 25], en: "Uranium", ru: ["Урановая руда", "Урановый слиток", "Урановый порошок"] },
  { metal: "titanium", ingot: "ingot_titanium", powder: "powder_titanium", veins: 8, size: 6, y: [8, 35], en: "Titanium", ru: ["Титановая руда", "Титановый слиток", "Титановый порошок"] },
  { metal: "lead", ingot: "ingot_lead", powder: "powder_lead", veins: 6, size: 9, y: [8, 35], en: "Lead", ru: ["Свинцовая руда", "Свинцовый слиток", "Свинцовый порошок"] },
  { metal: "thorium", ingot: "ingot_th232", powder: "powder_thorium", veins: 7, size: 5, y: [8, 30], en: "Thorium", ru: ["Ториевая руда", "Слиток тория-232", "Ториевый порошок"], ingotEn: "Thorium-232 Ingot" },
  { metal: "tungsten", ingot: "ingot_tungsten", powder: "powder_tungsten", veins: 10, size: 8, y: [8, 35], en: "Tungsten", ru: ["Вольфрамовая руда", "Вольфрамовый слиток", "Вольфрамовый порошок"] },
  { metal: "aluminium", ingot: "ingot_aluminium", powder: "powder_aluminium", veins: 7, size: 6, y: [8, 45], en: "Aluminium", ru: ["Алюминиевая руда", "Алюминиевый слиток", "Алюминиевый порошок"] },
  { metal: "beryllium", ingot: "ingot_beryllium", powder: "powder_beryllium", veins: 6, size: 4, y: [8, 35], en: "Beryllium", ru: ["Бериллиевая руда", "Бериллиевый слиток", "Бериллиевый порошок"] },
];

/** Mineral ores drop 2-4 of their item, like BlockOre.quantityDropped. */
const MINERALS = [
  { ore: "ore_sulfur", drop: "sulfur", veins: 5, size: 8, y: [8, 35], en: ["Sulfur Ore", "Sulfur"], ru: ["Серная руда", "Сера"] },
  { ore: "ore_niter", drop: "niter", veins: 6, size: 6, y: [8, 35], en: ["Niter Ore", "Niter"], ru: ["Селитровая руда", "Селитра"] },
  { ore: "ore_fluorite", drop: "fluorite", veins: 6, size: 4, y: [8, 50], en: ["Fluorite Ore", "Fluorite"], ru: ["Флюоритовая руда", "Флюорит"] },
];

const STORAGE_BLOCKS = [
  { metal: "uranium", en: "Block of Uranium", ru: "Урановый блок" },
  { metal: "titanium", en: "Block of Titanium", ru: "Титановый блок" },
  { metal: "lead", en: "Block of Lead", ru: "Свинцовый блок" },
];

// ---------- blocks ----------

const terrain = {};
const ORE_REPLACES = ["minecraft:stone", "minecraft:granite", "minecraft:diorite", "minecraft:andesite"];

function simpleBlock(id, { en, ru, texture, seconds, resist, color, category, group, loot }) {
  name(`tile.hbm.${id}.name`, en, ru);
  terrain[`hbm_${texture}`] = { textures: `textures/blocks/${texture}` };
  const components = {
    "minecraft:display_name": `tile.hbm.${id}.name`,
    "minecraft:destructible_by_mining": { seconds_to_destroy: seconds },
    "minecraft:destructible_by_explosion": { explosion_resistance: resist },
    "minecraft:material_instances": { "*": { texture: `hbm_${texture}`, render_method: "opaque" } },
    "minecraft:map_color": color,
    "tag:minecraft:is_pickaxe_item_destructible": {},
    "tag:stone": {},
  };
  if (loot) components["minecraft:loot"] = loot;
  write(join(BP, `blocks/${id}.json`), {
    format_version: "1.21.60",
    "minecraft:block": {
      description: { identifier: `hbm:${id}`, menu_category: group ? { category, group } : { category } },
      components,
    },
  });
}

function oreGeneration(ore, { veins, size, y }) {
  write(join(BP, `features/${ore}_feature.json`), {
    format_version: "1.13.0",
    "minecraft:ore_feature": {
      description: { identifier: `hbm:${ore}_feature` },
      count: size,
      replace_rules: [{ places_block: `hbm:${ore}`, may_replace: ORE_REPLACES }],
    },
  });
  write(join(BP, `feature_rules/${ore}_rule.json`), {
    format_version: "1.13.0",
    "minecraft:feature_rules": {
      description: { identifier: `hbm:${ore}_rule`, places_feature: `hbm:${ore}_feature` },
      conditions: {
        placement_pass: "underground_pass",
        "minecraft:biome_filter": { test: "has_biome_tag", operator: "==", value: "overworld" },
      },
      distribution: {
        iterations: veins,
        coordinate_eval_order: "zyx",
        x: { distribution: "uniform", extent: [0, 16] },
        y: { distribution: "uniform", extent: y },
        z: { distribution: "uniform", extent: [0, 16] },
      },
    },
  });
}

const ORE_GROUP = "minecraft:itemGroup.name.ore";
for (const m of METALS) {
  const ore = `ore_${m.metal}`;
  simpleBlock(ore, { en: `${m.en} Ore`, ru: m.ru[0], texture: ore, seconds: 3, resist: 3, color: "#7a7a7a", category: "nature", group: ORE_GROUP });
  oreGeneration(ore, m);
}
for (const m of MINERALS) {
  write(join(BP, `loot_tables/blocks/${m.ore}.json`), {
    pools: [{
      rolls: 1,
      entries: [{ type: "item", name: `hbm:${m.drop}`, weight: 1, functions: [{ function: "set_count", count: { min: 2, max: 4 } }] }],
    }],
  });
  simpleBlock(m.ore, {
    en: m.en[0], ru: m.ru[0], texture: m.ore, seconds: 3, resist: 3, color: "#7a7a7a",
    category: "nature", group: ORE_GROUP, loot: `loot_tables/blocks/${m.ore}.json`,
  });
  oreGeneration(m.ore, m);
}
for (const b of STORAGE_BLOCKS) {
  simpleBlock(`block_${b.metal}`, { en: b.en, ru: b.ru, texture: `block_${b.metal}`, seconds: 5, resist: 6, color: "#9a9a9a", category: "construction" });
}

// Machines: a cube whose front (north face of the model) turns toward the player.
const ROTATIONS = { north: 0, west: 90, south: 180, east: -90 };

function machineBlock(id, { en, ru, front, frontOn, side, top, bottom }) {
  name(`tile.hbm.${id}.name`, en, ru);
  for (const t of [front, frontOn, side, top, bottom].filter(Boolean)) {
    terrain[`hbm_${t}`] = { textures: `textures/blocks/${t}` };
  }
  const faces = (frontTexture) => {
    const m = (t) => ({ texture: `hbm_${t}`, render_method: "opaque" });
    return { "*": m(side), north: m(frontTexture), south: m(side), east: m(side), west: m(side), up: m(top), down: m(bottom) };
  };
  const permutations = Object.entries(ROTATIONS).map(([dir, angle]) => ({
    condition: `q.block_state('minecraft:cardinal_direction') == '${dir}'`,
    components: { "minecraft:transformation": { rotation: [0, angle, 0] } },
  }));
  const description = {
    identifier: `hbm:${id}`,
    menu_category: { category: "items" },
    traits: { "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 } },
  };
  if (frontOn) {
    description.states = { "hbm:lit": [false, true] };
    permutations.push({
      condition: "q.block_state('hbm:lit')",
      components: { "minecraft:material_instances": faces(frontOn), "minecraft:light_emission": 13 },
    });
  }
  write(join(BP, `blocks/${id}.json`), {
    format_version: "1.21.60",
    "minecraft:block": {
      description,
      components: {
        "minecraft:display_name": `tile.hbm.${id}.name`,
        "minecraft:destructible_by_mining": { seconds_to_destroy: 4 },
        "minecraft:destructible_by_explosion": { explosion_resistance: 10 },
        "minecraft:geometry": "geometry.hbm.machine",
        "minecraft:material_instances": faces(front),
        "minecraft:map_color": "#8c8c8c",
        "tag:minecraft:is_pickaxe_item_destructible": {},
        "tag:metal": {},
      },
      permutations,
    },
  });
}

machineBlock("machine_wood_burner", {
  en: "Wood Burner Generator", ru: "Дровяной генератор",
  front: "machine_furnace_brick_front_off", frontOn: "machine_furnace_brick_front_on",
  side: "machine_furnace_brick_side", top: "machine_furnace_brick_top", bottom: "machine_furnace_brick_bottom",
});
machineBlock("machine_electric_furnace", {
  en: "Electric Furnace", ru: "Электропечь",
  front: "machine_electric_furnace_front_off", frontOn: "machine_electric_furnace_front_on",
  side: "machine_electric_furnace_side", top: "machine_electric_furnace_top", bottom: "machine_electric_furnace_bottom",
});
machineBlock("machine_shredder", {
  en: "Shredder", ru: "Измельчитель",
  front: "machine_shredder_front_alt", side: "machine_shredder_side_alt",
  top: "machine_shredder_top_alt", bottom: "machine_shredder_bottom_alt",
});
machineBlock("machine_battery", {
  en: "Battery Block", ru: "Аккумуляторный блок",
  front: "battery_front_alt", side: "battery_side_alt", top: "battery_top", bottom: "battery_top",
});

// Cable: a core plus one arm per side; the script flips a state for each connected side.
const CABLE_SIDES = ["n", "s", "e", "w", "u", "d"];
name("tile.hbm.red_cable.name", "Red Copper Cable", "Красный медный провод");
terrain.hbm_red_cable = { textures: "textures/blocks/red_cable" };
write(join(BP, "blocks/red_cable.json"), {
  format_version: "1.21.60",
  "minecraft:block": {
    description: {
      identifier: "hbm:red_cable",
      menu_category: { category: "items" },
      states: Object.fromEntries(CABLE_SIDES.map((s) => [`hbm:${s}`, [false, true]])),
    },
    components: {
      "minecraft:display_name": "tile.hbm.red_cable.name",
      "minecraft:destructible_by_mining": { seconds_to_destroy: 0.5 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 5 },
      "minecraft:geometry": {
        identifier: "geometry.hbm.cable",
        bone_visibility: Object.fromEntries(CABLE_SIDES.map((s) => [s, `q.block_state('hbm:${s}')`])),
      },
      "minecraft:material_instances": { "*": { texture: "hbm_red_cable", render_method: "opaque", ambient_occlusion: false } },
      "minecraft:collision_box": { origin: [-3, 5, -3], size: [6, 6, 6] },
      "minecraft:selection_box": { origin: [-4, 4, -4], size: [8, 8, 8] },
      "minecraft:light_dampening": 0,
      "minecraft:map_color": "#b03a1a",
    },
  },
});

write(join(RP, "textures/terrain_texture.json"), {
  resource_pack_name: "hbm",
  texture_name: "atlas.terrain",
  padding: 8,
  num_mip_levels: 4,
  texture_data: terrain,
});

// ---------- block models (Bedrock geometry: north is -Z, +X is west) ----------

const faceUv = (u, v, w, h, instance) => ({ uv: [u, v], uv_size: [w, h], ...(instance && { material_instance: instance }) });
write(join(RP, "models/blocks/hbm_machine.geo.json"), {
  format_version: "1.12.0",
  "minecraft:geometry": [{
    description: { identifier: "geometry.hbm.machine", texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 2.5, visible_bounds_offset: [0, 0.75, 0] },
    bones: [{
      name: "block",
      pivot: [0, 0, 0],
      cubes: [{
        origin: [-8, 0, -8],
        size: [16, 16, 16],
        uv: Object.fromEntries(["north", "south", "east", "west", "up", "down"].map((f) => [f, faceUv(0, 0, 16, 16, f)])),
      }],
    }],
  }],
});

/** Arms take the grey insulation for their long faces and the copper core on the outer end. */
function cableCube(origin, size, endFace) {
  const [sx, sy, sz] = size;
  const dims = { north: [sx, sy], south: [sx, sy], east: [sz, sy], west: [sz, sy], up: [sx, sz], down: [sx, sz] };
  const uv = {};
  for (const [face, [w, h]] of Object.entries(dims)) {
    uv[face] = face === endFace || !endFace ? faceUv(5, 5, 6, 6) : faceUv(0, 1, w, h);
  }
  return { origin, size, uv };
}
const ARMS = {
  n: cableCube([-3, 5, -8], [6, 6, 5], "north"),
  s: cableCube([-3, 5, 3], [6, 6, 5], "south"),
  w: cableCube([3, 5, -3], [5, 6, 6], "west"),
  e: cableCube([-8, 5, -3], [5, 6, 6], "east"),
  u: cableCube([-3, 11, -3], [6, 5, 6], "up"),
  d: cableCube([-3, 0, -3], [6, 5, 6], "down"),
};
write(join(RP, "models/blocks/hbm_cable.geo.json"), {
  format_version: "1.12.0",
  "minecraft:geometry": [{
    description: { identifier: "geometry.hbm.cable", texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 2.5, visible_bounds_offset: [0, 0.75, 0] },
    bones: [
      { name: "core", pivot: [0, 0, 0], cubes: [cableCube([-3, 5, -3], [6, 6, 6])] },
      ...Object.entries(ARMS).map(([bone, cube]) => ({ name: bone, parent: "core", pivot: [0, 0, 0], cubes: [cube] })),
    ],
  }],
});

// ---------- items ----------

const itemTextures = {};
function item(id, { en, ru, texture = id, category = "items", components = {} }) {
  name(`item.hbm.${id}.name`, en, ru);
  itemTextures[`hbm_${id}`] = { textures: `textures/items/${texture}` };
  write(join(BP, `items/${id}.json`), {
    format_version: "1.21.60",
    "minecraft:item": {
      description: { identifier: `hbm:${id}`, menu_category: { category } },
      components: {
        "minecraft:icon": { textures: { default: `hbm_${id}` } },
        "minecraft:display_name": { value: `item.hbm.${id}.name` },
        "minecraft:max_stack_size": 64,
        ...components,
      },
    },
  });
}

for (const m of METALS) {
  item(m.ingot, { en: m.ingotEn ?? `${m.en} Ingot`, ru: m.ru[1] });
  item(m.powder, { en: `${m.en} Powder`, ru: m.ru[2] });
}
for (const m of MINERALS) item(m.drop, { en: m.en[1], ru: m.ru[1] });

item("nugget_uranium", { en: "Uranium Nugget", ru: "Урановый самородок" });
item("ingot_steel", { en: "Steel Ingot", ru: "Стальной слиток" });
item("powder_steel", { en: "Steel Powder", ru: "Стальной порошок" });
item("powder_iron", { en: "Iron Powder", ru: "Железный порошок" });
item("powder_gold", { en: "Gold Powder", ru: "Золотой порошок" });
item("powder_copper", { en: "Copper Powder", ru: "Медный порошок" });
item("powder_coal", { en: "Coal Powder", ru: "Угольный порошок" });
item("hazmat_cloth", { en: "Hazmat Cloth", ru: "Ткань химзащиты" });
item("iv_empty", { en: "IV Bag", ru: "Пакет для капельницы" });

item("geiger_counter", {
  en: "Geiger Counter", ru: "Счётчик Гейгера", category: "equipment",
  components: { "minecraft:max_stack_size": 1, "minecraft:allow_off_hand": true },
});
item("radaway", {
  en: "RadAway", ru: "Антирадин",
  components: {
    "minecraft:max_stack_size": 16,
    "minecraft:food": { can_always_eat: true, nutrition: 0, saturation_modifier: 0, using_converts_to: "hbm:iv_empty" },
    "minecraft:use_animation": "drink",
    "minecraft:use_modifiers": { use_duration: 1.6, movement_modifier: 0.35 },
  },
});
item("radx", {
  en: "Rad-X", ru: "Рад-Икс",
  components: {
    "minecraft:food": { can_always_eat: true, nutrition: 0, saturation_modifier: 0 },
    "minecraft:use_animation": "eat",
    "minecraft:use_modifiers": { use_duration: 0.8, movement_modifier: 0.35 },
  },
});

// Armor protection is cloth-like; radiation resistance lives in the script.
const ARMOR = {
  hazmat_helmet: { slot: "slot.armor.head", enchant: "armor_head", protection: 1, durability: 60, geometry: "helmet", layer: "hazmat_1", visible: "helmet", en: "Hazmat Helmet", ru: "Шлем химзащиты" },
  hazmat_plate: { slot: "slot.armor.chest", enchant: "armor_torso", protection: 3, durability: 90, geometry: "chestplate", layer: "hazmat_1", visible: "chest", en: "Hazmat Chestplate", ru: "Нагрудник химзащиты" },
  hazmat_legs: { slot: "slot.armor.legs", enchant: "armor_legs", protection: 2, durability: 80, geometry: "leggings", layer: "hazmat_2", visible: "leg", en: "Hazmat Leggings", ru: "Поножи химзащиты" },
  hazmat_boots: { slot: "slot.armor.feet", enchant: "armor_feet", protection: 1, durability: 70, geometry: "boots", layer: "hazmat_1", visible: "boot", en: "Hazmat Boots", ru: "Ботинки химзащиты" },
};
for (const [id, a] of Object.entries(ARMOR)) {
  item(id, {
    en: a.en, ru: a.ru, category: "equipment",
    components: {
      "minecraft:max_stack_size": 1,
      "minecraft:wearable": { slot: a.slot, protection: a.protection },
      "minecraft:durability": { max_durability: a.durability },
      "minecraft:enchantable": { slot: a.enchant, value: 10 },
      "minecraft:repairable": { repair_items: [{ items: ["hbm:hazmat_cloth"], repair_amount: Math.floor(a.durability / 4) }] },
      "minecraft:tags": { tags: ["minecraft:is_armor"] },
    },
  });
  write(join(RP, `attachables/${id}.json`), {
    format_version: "1.10.0",
    "minecraft:attachable": {
      description: {
        identifier: `hbm:${id}`,
        materials: { default: "armor", enchanted: "armor_enchanted" },
        textures: { default: `textures/models/armor/${a.layer}`, enchanted: "textures/misc/enchanted_item_glint" },
        geometry: { default: `geometry.humanoid.armor.${a.geometry}` },
        scripts: { parent_setup: `variable.${a.visible}_layer_visible = 0.0;` },
        render_controllers: ["controller.render.armor"],
      },
    },
  });
}

write(join(RP, "textures/item_texture.json"), {
  resource_pack_name: "hbm",
  texture_name: "atlas.items",
  texture_data: itemTextures,
});

// ---------- recipes ----------

function furnace(id, input, output) {
  write(join(BP, `recipes/${id}.json`), {
    format_version: "1.12",
    "minecraft:recipe_furnace": { description: { identifier: `hbm:${id}` }, tags: ["furnace", "blast_furnace"], input, output },
  });
}
function shaped(id, pattern, key, result, count = 1) {
  write(join(BP, `recipes/${id}.json`), {
    format_version: "1.12",
    "minecraft:recipe_shaped": {
      description: { identifier: `hbm:${id}` },
      tags: ["crafting_table"],
      pattern,
      key: Object.fromEntries(Object.entries(key).map(([k, v]) => [k, { item: v }])),
      result: { item: result, count },
    },
  });
}
function shapeless(id, ingredients, result, count = 1) {
  write(join(BP, `recipes/${id}.json`), {
    format_version: "1.12",
    "minecraft:recipe_shapeless": {
      description: { identifier: `hbm:${id}` },
      tags: ["crafting_table"],
      ingredients: ingredients.map((i) => ({ item: i })),
      result: { item: result, count },
    },
  });
}

for (const m of METALS) {
  furnace(`smelt_${m.ingot}`, `hbm:ore_${m.metal}`, `hbm:${m.ingot}`);
  furnace(`smelt_${m.powder}`, `hbm:${m.powder}`, `hbm:${m.ingot}`);
}
furnace("smelt_powder_iron", "hbm:powder_iron", "minecraft:iron_ingot");
furnace("smelt_powder_gold", "hbm:powder_gold", "minecraft:gold_ingot");
furnace("smelt_powder_copper", "hbm:powder_copper", "minecraft:copper_ingot");
furnace("smelt_powder_steel", "hbm:powder_steel", "hbm:ingot_steel");

for (const b of STORAGE_BLOCKS) {
  shaped(`block_${b.metal}`, ["###", "###", "###"], { "#": `hbm:ingot_${b.metal}` }, `hbm:block_${b.metal}`);
  shapeless(`ingot_${b.metal}_from_block`, [`hbm:block_${b.metal}`], `hbm:ingot_${b.metal}`, 9);
}
shaped("ingot_uranium_from_nuggets", ["###", "###", "###"], { "#": "hbm:nugget_uranium" }, "hbm:ingot_uranium");
shapeless("nugget_uranium", ["hbm:ingot_uranium"], "hbm:nugget_uranium", 9);
shapeless("powder_steel", ["hbm:powder_iron", "hbm:powder_coal"], "hbm:powder_steel");
shapeless("gunpowder", ["hbm:niter", "hbm:niter", "hbm:sulfur", "minecraft:coal"], "minecraft:gunpowder", 4);

// Simplified: the originals need rubber, circuits and plates, which are not ported yet.
shaped("hazmat_cloth", ["WLW"], { W: "minecraft:white_wool", L: "hbm:ingot_lead" }, "hbm:hazmat_cloth", 2);
shaped("hazmat_helmet", ["EEE", "EIE", " P "], { E: "hbm:hazmat_cloth", I: "minecraft:glass_pane", P: "minecraft:iron_ingot" }, "hbm:hazmat_helmet");
shaped("hazmat_plate", ["E E", "EEE", "EEE"], { E: "hbm:hazmat_cloth" }, "hbm:hazmat_plate");
shaped("hazmat_legs", ["EEE", "E E", "E E"], { E: "hbm:hazmat_cloth" }, "hbm:hazmat_legs");
shaped("hazmat_boots", ["E E", "E E"], { E: "hbm:hazmat_cloth" }, "hbm:hazmat_boots");
shaped("geiger_counter", ["GTT", "RCT", "RBB"], { G: "minecraft:gold_ingot", T: "hbm:ingot_titanium", R: "minecraft:redstone", C: "minecraft:copper_ingot", B: "hbm:ingot_beryllium" }, "hbm:geiger_counter");
shaped("iv_empty", ["K", "I", "K"], { K: "minecraft:dried_kelp", I: "minecraft:iron_ingot" }, "hbm:iv_empty", 4);
shapeless("radaway", ["hbm:iv_empty", "minecraft:coal", "minecraft:pumpkin_seeds"], "hbm:radaway");
shapeless("radx", ["minecraft:coal", "minecraft:coal", "hbm:fluorite"], "hbm:radx");

shaped("red_cable", [" L ", "CRC", " L "], { L: "hbm:ingot_lead", C: "minecraft:copper_ingot", R: "minecraft:redstone" }, "hbm:red_cable", 8);
shaped("machine_wood_burner", ["BBB", "BFB", "CRC"], { B: "minecraft:brick", F: "minecraft:furnace", C: "minecraft:copper_ingot", R: "minecraft:redstone" }, "hbm:machine_wood_burner");
shaped("machine_shredder", ["ITI", "PRP", "ICI"], { I: "minecraft:iron_ingot", T: "hbm:ingot_tungsten", P: "minecraft:piston", R: "minecraft:redstone", C: "minecraft:copper_ingot" }, "hbm:machine_shredder");
shaped("machine_electric_furnace", ["SSS", "SFS", "CRC"], { S: "hbm:ingot_steel", F: "minecraft:furnace", C: "minecraft:copper_ingot", R: "minecraft:redstone_block" }, "hbm:machine_electric_furnace");
shaped("machine_battery", ["LAL", "CRC", "LAL"], { L: "hbm:ingot_lead", A: "hbm:ingot_aluminium", C: "minecraft:copper_ingot", R: "minecraft:redstone_block" }, "hbm:machine_battery");

// ---------- sounds and texts ----------

write(join(RP, "sounds/sound_definitions.json"), {
  format_version: "1.14.0",
  sound_definitions: Object.fromEntries(
    [1, 2, 3, 4, 5, 6].map((n) => [`hbm.geiger${n}`, { category: "player", sounds: [`sounds/hbm/geiger${n}`] }])
  ),
});

name("pack.name", "HBM Nuclear Tech (Bedrock)", "HBM Nuclear Tech (Bedrock)");
name("pack.description", "Port of HBM's Nuclear Tech Mod", "Порт мода HBM's Nuclear Tech");
name("hbm.geiger.actionbar", "§eRadiation: §f%s RAD/s §7| §eDose: §f%s RAD", "§eРадиация: §f%s РАД/с §7| §eДоза: §f%s РАД");
name("hbm.geiger.report", "§aGeiger counter:§r dose §e%s RAD§r, incoming §e%s RAD/s§r, protection §e%s", "§aСчётчик Гейгера:§r доза §e%s РАД§r, поступает §e%s РАД/с§r, защита §e%s");
name("hbm.radx.taken", "§6Rad-X taken: radiation resistance for 3 minutes", "§6Рад-Икс принят: защита от радиации на 3 минуты");
name("hbm.machine.energy", "Energy: %s / %s HE", "Энергия: %s / %s HE");
name("hbm.machine.input", "Input: ", "Вход: ");
name("hbm.machine.output", "Output: ", "Выход: ");
name("hbm.machine.fuel", "Fuel: ", "Топливо: ");
name("hbm.machine.progress", "Progress: %s", "Прогресс: %s");
name("hbm.machine.burning", "Burning: %s s left", "Горит: ещё %s с");
name("hbm.machine.empty", "empty", "пусто");
name("hbm.machine.network", "Machines on the network: %s", "Машин в сети: %s");
name("hbm.machine.take_output", "Take output", "Забрать результат");
name("hbm.machine.take_input", "Take loaded items back", "Забрать загруженное");
name("hbm.machine.close", "Close", "Закрыть");
name("hbm.machine.inserted", "§aLoaded: %s", "§aЗагружено: %s шт.");
name("hbm.machine.wrong_item", "§cThis item does not fit here", "§cЭтот предмет сюда не подходит");
name("hbm.machine.slot_busy", "§cThe slot holds a different item", "§cВ слоте уже другой предмет");
name("hbm.machine.hint", "§7Tap with an item to load it. Sneak to place blocks against the machine.", "§7Нажмите предметом, чтобы загрузить его. Присядьте, чтобы ставить блоки рядом.");

for (const [code, entries] of Object.entries(lang)) {
  write(join(RP, `texts/${code}.lang`), Object.entries(entries).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}
write(join(RP, "texts/languages.json"), Object.keys(lang));

console.log(`generated: ${Object.keys(terrain).length} block textures, ${Object.keys(itemTextures).length} items, ${Object.keys(lang.en_US).length} strings`);
