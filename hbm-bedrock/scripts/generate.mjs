// Writes every data file of both packs from the tables below: blocks, items, recipes,
// ore generation, armor attachables, texture atlases, sounds and both languages.
// Textures and scripts are kept by hand. Run `npm run generate` after editing a table.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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

/** Ids defined by hand below; the imported catalog never replaces them. */
const defined = new Set();
/** Everything imported from HBM and NTM Extended by scripts/import-hbm.mjs. */
const catalogPath = join(root, "imported/catalog.json");
const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, "utf8")) : { items: [], blocks: [], recipes: [], rads: {} };
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

/** Break and step sounds per block, written to the resource pack's blocks.json. */
const blockSounds = {};
const SOUND_OF_TAG = { stone: "stone", metal: "metal", wood: "wood", dirt: "grass", explosive: "grass" };

/**
 * `texture` covers every face; `up` and `down` override the top and bottom. Blocks use our cube
 * model rather than the default one: on the default cube the game ignored our textures and drew dirt.
 */
function simpleBlock(id, { en, ru, texture, up, down, seconds, resist, color, category, group, loot, tag = "stone" }) {
  name(`tile.hbm.${id}.name`, en, ru);
  defined.add(`hbm:${id}`);
  blockSounds[`hbm:${id}`] = { sound: SOUND_OF_TAG[tag] ?? "stone" };
  const faceTexture = { "*": texture, north: texture, south: texture, east: texture, west: texture, up: up ?? texture, down: down ?? texture };
  const materials = {};
  for (const [face, t] of Object.entries(faceTexture)) {
    terrain[`hbm_${t}`] = { textures: `textures/blocks/${t}` };
    materials[face] = { texture: `hbm_${t}`, render_method: "opaque" };
  }
  const components = {
    "minecraft:display_name": `tile.hbm.${id}.name`,
    "minecraft:destructible_by_mining": { seconds_to_destroy: seconds },
    "minecraft:destructible_by_explosion": { explosion_resistance: resist },
    "minecraft:geometry": "geometry.hbm.machine",
    "minecraft:material_instances": materials,
    "minecraft:map_color": color,
    "tag:minecraft:is_pickaxe_item_destructible": {},
    [`tag:${tag}`]: {},
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

function oreGeneration(ore, { veins, size, y, chance }) {
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
        ...(chance && { scatter_chance: { numerator: 1, denominator: chance } }),
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
  defined.add(`hbm:${id}`);
  blockSounds[`hbm:${id}`] = { sound: "metal" };
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
machineBlock("machine_reactor", {
  en: "Research Reactor", ru: "Исследовательский реактор",
  front: "machine_reactor_front_off", frontOn: "machine_reactor_front_on",
  side: "machine_reactor_top", top: "machine_reactor_top", bottom: "machine_reactor_top",
});

for (const [id, en, ru, front] of [
  ["machine_press", "Electric Press", "Электропресс", "machine_press_front"],
  ["machine_assembler", "Assembly Machine", "Сборочная машина", "machine_assembler_front"],
  ["machine_pump", "Water Pump", "Водяной насос", "machine_pump_front"],
  ["machine_derrick", "Oil Derrick", "Нефтяная вышка", "machine_derrick_front"],
  ["machine_refinery", "Oil Refinery", "Нефтеперерабатывающий завод", "machine_refinery_front"],
  ["machine_diesel", "Diesel Generator", "Дизельный генератор", "machine_diesel_front"],
  ["machine_fluidtank", "Fluid Tank", "Цистерна", "machine_fluidtank_front"],
]) {
  machineBlock(id, { en, ru, front, side: "block_steel", top: "block_steel", bottom: "block_steel" });
}
machineBlock("machine_turbine", {
  en: "Steam Turbine", ru: "Паровая турбина",
  front: "machine_turbine_base", side: "machine_turbine_base", top: "machine_turbine_top", bottom: "machine_turbine_base",
});
for (const [id, en, ru, t] of [
  ["rbmk_fuel", "RBMK Fuel Channel", "Топливный канал РБМК", "rbmk_element"],
  ["rbmk_control", "RBMK Control Rod Channel", "Канал СУЗ РБМК", "rbmk_control"],
  ["rbmk_boiler", "RBMK Boiler Channel", "Канал-кипятильник РБМК", "rbmk_boiler"],
]) {
  machineBlock(id, { en, ru, front: `${t}_side`, side: `${t}_side`, top: `${t}_top`, bottom: "rbmk_blank_top" });
}
simpleBlock("rbmk_moderator", { en: "RBMK Graphite Moderator", ru: "Графитовый замедлитель РБМК", texture: "rbmk_moderator_side", up: "rbmk_moderator_top", down: "rbmk_blank_top", seconds: 4, resist: 10, color: "#3a3a3a", category: "items", tag: "metal" });
simpleBlock("rbmk_blank", { en: "RBMK Structural Channel", ru: "Пустой канал РБМК", texture: "rbmk_blank_side", up: "rbmk_blank_top", down: "rbmk_blank_top", seconds: 4, resist: 10, color: "#9a9a9a", category: "items", tag: "metal" });
simpleBlock("rbmk_debris", { en: "RBMK Debris", ru: "Обломки РБМК", texture: "rbmk_debris", seconds: 3, resist: 10, color: "#2a2a2a", category: "nature" });
simpleBlock("launch_pad", { en: "Missile Launch Pad", ru: "Стартовая площадка", texture: "block_steel", up: "launch_pad_top", seconds: 4, resist: 20, color: "#8c8c8c", category: "items", tag: "metal" });
simpleBlock("ore_oil", { en: "Oil Deposit", ru: "Нефтяная залежь", texture: "ore_oil", seconds: 3, resist: 3, color: "#202020", category: "nature", group: ORE_GROUP });
simpleBlock("ore_oil_empty", { en: "Empty Oil Deposit", ru: "Истощённая залежь", texture: "ore_oil_empty", seconds: 3, resist: 3, color: "#505050", category: "nature", group: ORE_GROUP });
// HBM's oil sits in big pockets; here one pocket in roughly every sixth chunk.
oreGeneration("ore_oil", { veins: 1, size: 40, y: [10, 40], chance: 6 });

// Explosives: the script arms them with flint and steel or a redstone signal.
simpleBlock("charge_semtex", { en: "Semtex", ru: "Семтекс", texture: "semtex_side", up: "semtex_top", down: "semtex_bottom", seconds: 1, resist: 0, color: "#d8a030", category: "items", tag: "explosive" });
simpleBlock("det_charge", { en: "Detonation Charge", ru: "Подрывной заряд", texture: "det_charge", seconds: 1, resist: 0, color: "#c8a060", category: "items", tag: "explosive" });
simpleBlock("det_nuke", { en: "Nuclear Charge", ru: "Ядерный заряд", texture: "det_nuke", up: "det_nuke_top", down: "det_nuke_top", seconds: 2, resist: 0, color: "#d0c020", category: "items", tag: "explosive" });

// Fallout: what grass and logs turn into around a nuclear blast.
simpleBlock("waste_earth", { en: "Dead Grass", ru: "Мёртвая земля", texture: "waste_grass_side", up: "waste_grass_top", down: "waste_earth_bottom", seconds: 0.8, resist: 1, color: "#4a4a30", category: "nature", tag: "dirt" });
simpleBlock("waste_log", { en: "Charred Log", ru: "Обугленное бревно", texture: "waste_log_side", up: "waste_log_top", down: "waste_log_top", seconds: 2, resist: 2, color: "#2a2a2a", category: "nature", tag: "wood" });

// Conduits (cable, fluid duct): a core plus one arm per side; the script flips a state per connected side.
const CABLE_SIDES = ["n", "s", "e", "w", "u", "d"];
function conduit(id, { en, ru, color }) {
  name(`tile.hbm.${id}.name`, en, ru);
  defined.add(`hbm:${id}`);
  blockSounds[`hbm:${id}`] = { sound: "metal" };
  terrain[`hbm_${id}`] = { textures: `textures/blocks/${id}` };
  write(join(BP, `blocks/${id}.json`), {
    format_version: "1.21.60",
    "minecraft:block": {
      description: {
        identifier: `hbm:${id}`,
        menu_category: { category: "items" },
        states: Object.fromEntries(CABLE_SIDES.map((s) => [`hbm:${s}`, [false, true]])),
      },
      components: {
        "minecraft:display_name": `tile.hbm.${id}.name`,
        "minecraft:destructible_by_mining": { seconds_to_destroy: 0.5 },
        "minecraft:destructible_by_explosion": { explosion_resistance: 5 },
        "minecraft:geometry": {
          identifier: "geometry.hbm.cable",
          bone_visibility: Object.fromEntries(CABLE_SIDES.map((s) => [s, `q.block_state('hbm:${s}')`])),
        },
        "minecraft:material_instances": { "*": { texture: `hbm_${id}`, render_method: "opaque", ambient_occlusion: false } },
        "minecraft:collision_box": { origin: [-3, 5, -3], size: [6, 6, 6] },
        "minecraft:selection_box": { origin: [-4, 4, -4], size: [8, 8, 8] },
        "minecraft:light_dampening": 0,
        "minecraft:map_color": color,
      },
    },
  });
}
conduit("red_cable", { en: "Red Copper Cable", ru: "Красный медный провод", color: "#b03a1a" });
conduit("fluid_duct", { en: "Fluid Duct", ru: "Трубопровод", color: "#c8c8c8" });

// ---------- imported blocks ----------

const importedTexture = (path) => `hbm_imp_${path.replace(/^textures\/imported\//, "").replace(/[^a-z0-9_]/gi, "_")}`;
const TOOL_TAG = { pickaxe: "minecraft:is_pickaxe_item_destructible", axe: "minecraft:is_axe_item_destructible", shovel: "minecraft:is_shovel_item_destructible" };
const SOUND_OF_TOOL = { pickaxe: "stone", axe: "wood", shovel: "gravel" };
const importedBlocks = catalog.blocks.filter((b) => !defined.has(`hbm:${b.id}`));
for (const b of importedBlocks) {
  name(`tile.hbm.${b.id}.name`, b.en, b.ru);
  blockSounds[`hbm:${b.id}`] = { sound: SOUND_OF_TOOL[b.tool] ?? "stone" };
  const face = (path) => {
    terrain[importedTexture(path)] = { textures: path };
    return { texture: importedTexture(path), render_method: "alpha_test" };
  };
  const side = face(b.faces.side);
  const components = {
    "minecraft:display_name": `tile.hbm.${b.id}.name`,
    "minecraft:destructible_by_mining": b.hardness < 0 ? false : { seconds_to_destroy: b.hardness },
    "minecraft:destructible_by_explosion": { explosion_resistance: b.resistance },
    "minecraft:geometry": "geometry.hbm.machine",
    "minecraft:material_instances": { "*": side, north: side, south: side, east: side, west: side, up: face(b.faces.up), down: face(b.faces.down) },
    "minecraft:map_color": "#808080",
    [`tag:${TOOL_TAG[b.tool] ?? TOOL_TAG.pickaxe}`]: {},
  };
  if (b.light > 0) components["minecraft:light_emission"] = b.light;
  write(join(BP, `blocks/imported/${b.id}.json`), {
    format_version: "1.21.60",
    "minecraft:block": { description: { identifier: `hbm:${b.id}`, menu_category: { category: b.category } }, components },
  });
}

write(join(RP, "blocks.json"), { format_version: [1, 1, 0], ...blockSounds });

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
  defined.add(`hbm:${id}`);
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
item("nugget_pu239", { en: "Plutonium-239 Nugget", ru: "Самородок плутония-239" });
item("ingot_pu239", { en: "Plutonium-239 Ingot", ru: "Слиток плутония-239" });
item("rod_empty", { en: "Empty Rod", ru: "Пустой стержень" });
item("rod_uranium", { en: "Uranium Fuel Rod", ru: "Урановый топливный стержень", components: { "minecraft:max_stack_size": 8 } });
item("rod_uranium_depleted", { en: "Depleted Uranium Fuel Rod", ru: "Отработанный топливный стержень", components: { "minecraft:max_stack_size": 8 } });
// The cable's block model shows only its core in the inventory, so the cable item gets HBM's flat icon.
item("red_cable", {
  en: "Red Copper Cable", ru: "Красный медный провод",
  components: { "minecraft:block_placer": { block: "hbm:red_cable", replace_block_item: true } },
});
item("hazmat_cloth", { en: "Hazmat Cloth", ru: "Ткань химзащиты" });

for (const [metal, en, ru] of [
  ["iron", "Iron", "Железная пластина"],
  ["steel", "Steel", "Стальная пластина"],
  ["copper", "Copper", "Медная пластина"],
  ["gold", "Gold", "Золотая пластина"],
  ["titanium", "Titanium", "Титановая пластина"],
  ["lead", "Lead", "Свинцовая пластина"],
  ["aluminium", "Aluminium", "Алюминиевая пластина"],
]) {
  item(`plate_${metal}`, { en: `${en} Plate`, ru });
}
item("ingot_graphite", { en: "Graphite Ingot", ru: "Графитовый слиток" });
item("circuit", { en: "Basic Circuit", ru: "Микросхема" });
item("coil_copper", { en: "Copper Coil", ru: "Медная катушка" });
item("motor", { en: "Motor", ru: "Электромотор" });
item("rbmk_fuel_ueu", { en: "RBMK Fuel Assembly (Natural Uranium)", ru: "ТВС РБМК (природный уран)", components: { "minecraft:max_stack_size": 1 } });
item("rbmk_fuel_depleted", { en: "Spent RBMK Fuel Assembly", ru: "Отработанная ТВС РБМК", components: { "minecraft:max_stack_size": 1 } });
item("fluid_duct", {
  en: "Fluid Duct", ru: "Трубопровод",
  components: { "minecraft:block_placer": { block: "hbm:fluid_duct", replace_block_item: true } },
});
for (const [id, en, ru] of [
  ["missile_generic", "High Explosive Missile", "Фугасная ракета"],
  ["missile_incendiary", "Incendiary Missile", "Зажигательная ракета"],
  ["missile_nuclear", "Nuclear Missile", "Ядерная ракета"],
]) {
  item(id, { en, ru, category: "equipment", components: { "minecraft:max_stack_size": 1 } });
}
const tool = { "minecraft:max_stack_size": 1, "minecraft:hand_equipped": true };
item("designator", { en: "Target Designator", ru: "Целеуказатель", category: "equipment", components: tool });
item("oil_detector", { en: "Oil Detector", ru: "Нефтеискатель", category: "equipment", components: tool });
item("gun_b92", { en: "B92 Energy Pistol", ru: "Энергопистолет B92", category: "equipment", components: tool });
item("gun_rifle", { en: "Rifle", ru: "Винтовка", texture: "gun_darter", category: "equipment", components: tool });
item("ammo_45", { en: ".45 Ammo", ru: "Патроны .45" });
item("grenade_he", { en: "Grenade", ru: "Граната", category: "equipment", components: { "minecraft:max_stack_size": 16 } });
item("grenade_nuclear", { en: "Mini-Nuke Grenade", ru: "Ядерная граната", category: "equipment", components: { "minecraft:max_stack_size": 16 } });
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

// ---------- imported items ----------

const importedItems = catalog.items.filter((i) => !defined.has(`hbm:${i.id}`));
for (const i of importedItems) {
  name(`item.hbm.${i.id}.name`, i.en, i.ru);
  itemTextures[importedTexture(i.texture)] = { textures: i.texture };
  write(join(BP, `items/imported/${i.id}.json`), {
    format_version: "1.21.60",
    "minecraft:item": {
      description: { identifier: `hbm:${i.id}`, menu_category: { category: i.category } },
      components: {
        "minecraft:icon": { textures: { default: importedTexture(i.texture) } },
        "minecraft:display_name": { value: `item.hbm.${i.id}.name` },
        "minecraft:max_stack_size": Math.max(1, Math.min(64, i.stack)),
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

/** Inputs that already have a furnace recipe; the imported recipes skip them. */
const handSmelted = new Set();
function furnace(id, input, output) {
  handSmelted.add(input);
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
shaped("rod_empty", ["S", "S", "S"], { S: "hbm:ingot_steel" }, "hbm:rod_empty", 2);
shapeless("rod_uranium", ["hbm:rod_empty", "hbm:ingot_uranium", "hbm:ingot_uranium", "hbm:ingot_uranium"], "hbm:rod_uranium");
shaped("ingot_pu239", ["###", "###", "###"], { "#": "hbm:nugget_pu239" }, "hbm:ingot_pu239");
shapeless("nugget_pu239", ["hbm:ingot_pu239"], "hbm:nugget_pu239", 9);
shaped("machine_reactor", ["SLS", "LRL", "SCS"], { S: "hbm:ingot_steel", L: "hbm:block_lead", R: "minecraft:redstone_block", C: "minecraft:copper_ingot" }, "hbm:machine_reactor");
shaped("charge_semtex", ["NSN", "STS", "NSN"], { N: "hbm:niter", S: "hbm:sulfur", T: "minecraft:tnt" }, "hbm:charge_semtex", 2);
shaped("det_charge", ["GTG", "TRT", "GTG"], { G: "minecraft:gunpowder", T: "minecraft:tnt", R: "minecraft:redstone" }, "hbm:det_charge");
shaped("det_nuke", ["PDP", "DSD", "PDP"], { P: "hbm:ingot_pu239", D: "hbm:det_charge", S: "hbm:ingot_steel" }, "hbm:det_nuke");
// Plates come from the electric press and parts from the assembly machine (tables in recipes.js).
furnace("smelt_ingot_graphite", "minecraft:coal", "hbm:ingot_graphite");
shaped("machine_press", ["SPS", "SRS", "SCS"], { S: "hbm:ingot_steel", P: "minecraft:piston", R: "minecraft:redstone_block", C: "minecraft:copper_ingot" }, "hbm:machine_press");
shaped("machine_assembler", ["SPS", "CRC", "SFS"], { S: "hbm:ingot_steel", P: "minecraft:piston", C: "minecraft:copper_ingot", R: "minecraft:redstone_block", F: "minecraft:crafting_table" }, "hbm:machine_assembler");
shaped("coil_copper", ["CCC", "CIC", "CCC"], { C: "minecraft:copper_ingot", I: "minecraft:iron_ingot" }, "hbm:coil_copper", 2);
shaped("fluid_duct", [" P ", "PGP", " P "], { P: "hbm:plate_iron", G: "minecraft:glass" }, "hbm:fluid_duct", 8);
shaped("machine_pump", ["PMP", "PDP", "PCP"], { P: "hbm:plate_iron", M: "hbm:motor", D: "hbm:fluid_duct", C: "hbm:circuit" }, "hbm:machine_pump");
shaped("machine_fluidtank", ["PDP", "P P", "PDP"], { P: "hbm:plate_steel", D: "hbm:fluid_duct" }, "hbm:machine_fluidtank");
shaped("machine_derrick", ["S S", "SMS", "PCP"], { S: "hbm:ingot_steel", M: "hbm:motor", P: "hbm:plate_steel", C: "hbm:circuit" }, "hbm:machine_derrick");
shaped("machine_refinery", ["PDP", "PFP", "MCM"], { P: "hbm:plate_steel", D: "hbm:fluid_duct", F: "minecraft:furnace", M: "hbm:motor", C: "hbm:circuit" }, "hbm:machine_refinery");
shaped("machine_diesel", ["PPP", "DMD", "PCP"], { P: "hbm:plate_steel", D: "hbm:fluid_duct", M: "hbm:motor", C: "hbm:circuit" }, "hbm:machine_diesel");
shaped("machine_turbine", ["PTP", "MCM", "PTP"], { P: "hbm:plate_steel", T: "hbm:plate_titanium", M: "hbm:motor", C: "hbm:circuit" }, "hbm:machine_turbine");
shaped("rbmk_blank", ["SPS", "PGP", "SPS"], { S: "hbm:ingot_steel", P: "hbm:plate_steel", G: "hbm:ingot_graphite" }, "hbm:rbmk_blank", 4);
shapeless("rbmk_fuel", ["hbm:rbmk_blank", "hbm:rod_empty", "hbm:plate_lead"], "hbm:rbmk_fuel");
shapeless("rbmk_control", ["hbm:rbmk_blank", "hbm:rod_empty", "hbm:ingot_tungsten", "hbm:circuit"], "hbm:rbmk_control");
shapeless("rbmk_boiler", ["hbm:rbmk_blank", "hbm:fluid_duct", "hbm:fluid_duct"], "hbm:rbmk_boiler");
shapeless("rbmk_moderator", ["hbm:rbmk_blank", "hbm:ingot_graphite", "hbm:ingot_graphite", "hbm:ingot_graphite", "hbm:ingot_graphite"], "hbm:rbmk_moderator");
shaped("launch_pad", ["PPP", "SCS", "SSS"], { P: "hbm:plate_steel", S: "hbm:ingot_steel", C: "hbm:circuit" }, "hbm:launch_pad");
shaped("designator", ["TG", "PC"], { T: "minecraft:redstone_torch", G: "minecraft:glass_pane", P: "hbm:plate_iron", C: "hbm:circuit" }, "hbm:designator");
shaped("oil_detector", ["CP", "RG"], { C: "hbm:circuit", P: "hbm:plate_steel", R: "minecraft:redstone", G: "minecraft:glass_pane" }, "hbm:oil_detector");
shapeless("ammo_45", ["hbm:plate_copper", "minecraft:gunpowder", "hbm:ingot_lead"], "hbm:ammo_45", 8);
shapeless("grenade_he", ["hbm:plate_iron", "minecraft:gunpowder", "minecraft:gunpowder", "minecraft:string"], "hbm:grenade_he", 2);
shaped("machine_battery", ["LAL", "CRC", "LAL"], { L: "hbm:ingot_lead", A: "hbm:ingot_aluminium", C: "minecraft:copper_ingot", R: "minecraft:redstone_block" }, "hbm:machine_battery");

// ---------- imported recipes and radiation ----------

const known = new Set([...defined, ...importedBlocks.map((b) => `hbm:${b.id}`), ...importedItems.map((i) => `hbm:${i.id}`)]);
const exists = (id) => id.startsWith("minecraft:") || known.has(id);
const smelted = new Set(handSmelted); // one furnace recipe per input; hand-made ones win
let importedRecipes = 0;
for (const r of catalog.recipes) {
  const ids = [r.output, r.input, ...(r.ingredients ?? []), ...Object.values(r.key ?? {})].filter(Boolean);
  if (!ids.every(exists)) continue;
  const id = `imp_${importedRecipes++}`;
  if (r.type === "furnace") {
    if (smelted.has(r.input)) continue;
    smelted.add(r.input);
    write(join(BP, `recipes/imported/${id}.json`), {
      format_version: "1.12",
      "minecraft:recipe_furnace": { description: { identifier: `hbm:${id}` }, tags: ["furnace"], input: r.input, output: r.output },
    });
  } else if (r.type === "shaped") {
    write(join(BP, `recipes/imported/${id}.json`), {
      format_version: "1.12",
      "minecraft:recipe_shaped": {
        description: { identifier: `hbm:${id}` },
        tags: ["crafting_table"],
        pattern: r.pattern,
        key: Object.fromEntries(Object.entries(r.key).map(([k, v]) => [k, { item: v }])),
        result: { item: r.output, count: r.count },
      },
    });
  } else {
    write(join(BP, `recipes/imported/${id}.json`), {
      format_version: "1.12",
      "minecraft:recipe_shapeless": {
        description: { identifier: `hbm:${id}` },
        tags: ["crafting_table"],
        ingredients: r.ingredients.map((v) => ({ item: v })),
        result: { item: r.output, count: r.count },
      },
    });
  }
}
const rads = Object.fromEntries(Object.entries(catalog.rads).filter(([id]) => known.has(id)));
write(
  join(BP, "scripts/imported_rads.js"),
  `// Generated by scripts/generate.mjs from HBM's hazard tables: RAD per second for one item.\nexport const IMPORTED_RADS = ${JSON.stringify(rads, null, 2)};\n`
);

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
name("hbm.reactor.heat", "Core temperature: %s °C (meltdown at 1000)", "Температура активной зоны: %s °C (расплав при 1000)");
name("hbm.reactor.rods", "Fuel rods: %s, depleted: %s, rod burnup: %s", "Топливных стержней: %s, отработанных: %s, выгорание стержня: %s");
name("hbm.reactor.control", "Control rods inserted: %s", "Управляющие стержни опущены на: %s");
name("hbm.reactor.cooling", "Water around the reactor: %s of 6 sides", "Вода вокруг реактора: %s из 6 сторон");
name("hbm.reactor.output", "Output: %s HE/s", "Мощность: %s HE/с");
name("hbm.reactor.insert", "Lower control rods (+25%)", "Опустить управляющие стержни (+25%)");
name("hbm.reactor.withdraw", "Raise control rods (-25%)", "Поднять управляющие стержни (−25%)");
name("hbm.reactor.scram", "§cSCRAM: shut the reactor down", "§cАЗ-5: заглушить реактор");
name("hbm.reactor.take_depleted", "Take depleted rods", "Забрать отработанные стержни");
name("hbm.reactor.take_fuel", "Take fuel rods", "Забрать топливные стержни");
name("hbm.reactor.overheat", "§cREACTOR OVERHEATING: %s °C", "§cПЕРЕГРЕВ РЕАКТОРА: %s °C");
name("hbm.reactor.meltdown", "§4Reactor meltdown!", "§4Расплавление реактора!");
name("hbm.bomb.armed", "§cCharge armed: %s s", "§cЗаряд взведён: %s с");
name("hbm.bomb.countdown", "§c§lDETONATION IN %s", "§c§lВЗРЫВ ЧЕРЕЗ %s");
name("hbm.bomb.defused", "§aCharge defused", "§aЗаряд обезврежен");
name("hbm.machine.pipes", "Machines on the pipes: %s", "Машин в трубопроводе: %s");
name("hbm.fluid.water", "Water", "Вода");
name("hbm.fluid.steam", "Steam", "Пар");
name("hbm.fluid.oil", "Crude oil", "Нефть");
name("hbm.fluid.diesel", "Diesel", "Дизтопливо");
name("hbm.fluid.empty_tank", "Empty, holds %s mB of any fluid", "Пусто, вмещает %s mB любой жидкости");
name("hbm.assembler.recipe", "Recipe: ", "Рецепт: ");
name("hbm.assembler.needs", "  needs ", "  нужно ");
name("hbm.assembler.loaded", "    loaded: %s", "    загружено: %s");
name("hbm.assembler.no_recipe", "No recipe chosen", "Рецепт не выбран");
name("hbm.assembler.choose", "Choose recipe", "Выбрать рецепт");
name("hbm.assembler.take_stock", "Take loaded ingredients back", "Забрать загруженные детали");
name("hbm.derrick.oil", "Oil found %s blocks below", "Нефть найдена на глубине %s");
name("hbm.derrick.no_oil", "No oil straight below the derrick", "Прямо под вышкой нефти нет");
name("hbm.detector.below", "§aOil right below you, %s blocks down", "§aНефть прямо под вами, глубина %s");
name("hbm.detector.near", "§eOil %s blocks away, %s blocks down", "§eНефть в %s блоках от вас, глубина %s");
name("hbm.detector.none", "§cNo oil nearby", "§cНефти поблизости нет");
name("hbm.rbmk.heat", "Channel temperature: %s °C (explodes at 1500)", "Температура канала: %s °C (взрыв при 1500)");
name("hbm.rbmk.flux", "Neutron flux: %s", "Нейтронный поток: %s");
name("hbm.rbmk.rod", "Assembly: ", "Сборка: ");
name("hbm.rbmk.burnup", "Burnup: %s", "Выгорание: %s");
name("hbm.rbmk.insertion", "Control rod inserted: %s", "Стержень СУЗ опущен на: %s");
name("hbm.rbmk.az5", "§cAZ-5: drop every control rod of the reactor", "§cАЗ-5: опустить все стержни СУЗ реактора");
name("hbm.rbmk.take_rod", "Pull the assembly out", "Извлечь сборку");
name("hbm.rbmk.take_spent", "Take spent assemblies", "Забрать отработанные сборки");
name("hbm.rbmk.overheat", "§cRBMK channel overheating: %s °C", "§cПерегрев канала РБМК: %s °C");
name("hbm.rbmk.meltdown", "§4The RBMK reactor has exploded!", "§4Реактор РБМК взорвался!");
name("hbm.missile.loaded", "Missile: ", "Ракета: ");
name("hbm.missile.target", "Target: %s", "Цель: %s");
name("hbm.missile.no_target", "No target: aim the target designator at a block and use it", "Цель не задана: наведите целеуказатель на блок и нажмите");
name("hbm.missile.launch", "§cLaunch", "§cПуск");
name("hbm.missile.take", "Take the missile back", "Забрать ракету");
name("hbm.missile.launched", "§6Missile launched at %s, impact in %s s", "§6Ракета запущена по %s, попадание через %s с");
name("hbm.missile.incoming", "§c§lINCOMING MISSILE", "§c§lРАКЕТА НА ПОДЛЁТЕ");
name("hbm.missile.lost", "§7The missile was lost: its target area could not be loaded", "§7Ракета потеряна: место цели не загрузилось");
name("hbm.designator.set", "§aTarget set: %s", "§aЦель задана: %s");
name("hbm.designator.miss", "§cNo block in sight (256 blocks max)", "§cНет блока в прицеле (до 256 блоков)");
name("hbm.gun.no_ammo", "§cNo ammo", "§cНет боеприпасов");
name("hbm.machine.hint", "§7Tap with an item to load it. Sneak to place blocks against the machine.", "§7Нажмите предметом, чтобы загрузить его. Присядьте, чтобы ставить блоки рядом.");

for (const [code, entries] of Object.entries(lang)) {
  write(join(RP, `texts/${code}.lang`), Object.entries(entries).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}
write(join(RP, "texts/languages.json"), Object.keys(lang));

console.log(`generated: ${Object.keys(terrain).length} block textures, ${Object.keys(itemTextures).length} items, ${Object.keys(lang.en_US).length} strings`);
console.log(`imported: ${importedBlocks.length} blocks, ${importedItems.length} items, ${importedRecipes} recipes, ${Object.keys(rads).length} radiation values`);
