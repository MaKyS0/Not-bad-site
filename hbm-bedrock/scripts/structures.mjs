// Turns HBM's structures (read by import-hbm.mjs from its NBT files) into Bedrock .mcstructure files
// and world generation rules. Java 1.7.10 blocks and their metadata map onto Bedrock names and
// states; HBM blocks onto this pack's blocks; anything without a counterpart is left out, so the
// world's own block stays there.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const WOODS = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
const STONE_SLABS = ["smooth_stone_slab", "sandstone_slab", "oak_slab", "cobblestone_slab", "brick_slab", "stone_brick_slab", "nether_brick_slab", "quartz_slab"];
const DOUBLE_SLABS = ["smooth_stone", "sandstone", "oak_planks", "cobblestone", "brick_block", "stone_bricks", "nether_brick", "quartz_block"];
const SKIP = new Set(["bed", "skull", "wall_sign", "standing_sign", "piston_head", "fire", "portal"]);
const RENAME = { grass: "grass_block", fence: "oak_fence", brick_block: "brick_block", tallgrass: "short_grass" };

/** Java 1.7.10 block + meta → [Bedrock name, states], or undefined to leave the spot alone. */
function vanilla(name, meta) {
  const n = name.replace(/^minecraft:/, "");
  if (SKIP.has(n)) return undefined;
  const top = (meta & 8) !== 0;
  switch (n) {
    case "wool": return [`${COLORS[meta & 15]}_wool`, {}];
    case "carpet": return [`${COLORS[meta & 15]}_carpet`, {}];
    case "stained_glass": return [`${COLORS[meta & 15]}_stained_glass`, {}];
    case "stained_glass_pane": return [`${COLORS[meta & 15]}_stained_glass_pane`, {}];
    case "stained_hardened_clay": return [`${COLORS[meta & 15]}_terracotta`, {}];
    case "planks": case "double_wooden_slab": return [`${WOODS[meta % 6]}_planks`, {}];
    case "log": return [`${WOODS[meta & 3]}_log`, {}];
    case "log2": return [`${WOODS[4 + (meta & 1)]}_log`, {}];
    case "leaves": return [`${WOODS[meta & 3]}_leaves`, {}];
    case "stone_slab": return [STONE_SLABS[meta & 7], { "minecraft:vertical_half": top ? "top" : "bottom" }];
    case "wooden_slab": return [`${WOODS[(meta & 7) % 6]}_slab`, { "minecraft:vertical_half": top ? "top" : "bottom" }];
    case "double_stone_slab": return [DOUBLE_SLABS[meta & 7], {}];
    case "stonebrick": return [["stone_bricks", "mossy_stone_bricks", "cracked_stone_bricks", "chiseled_stone_bricks"][meta & 3], {}];
    case "sandstone": return [["sandstone", "chiseled_sandstone", "cut_sandstone"][Math.min(meta, 2)], {}];
    case "tallgrass": return [meta === 2 ? "fern" : "short_grass", {}];
    case "double_plant": return ["tall_grass", { upper_block_bit: top }];
    case "wooden_door": return ["wooden_door", { upper_block_bit: top, direction: top ? 0 : meta & 3 }];
  }
  if (n.endsWith("_stairs")) return [n, { weirdo_direction: meta & 3, upside_down_bit: (meta & 4) !== 0 }];
  return [RENAME[n] ?? n, {}];
}

/** HBM block → an id this pack has: the block itself, or the base of a stair, slab or "_off" machine. */
function hbmBlock(name, known) {
  const base = name.replace(/^hbm:(tile\.)?/, "").toLowerCase();
  for (const candidate of [base, base.replace(/_off$/, ""), base.replace(/_(stairs|double_slab|slab)$/, ""), base.replace(/_slab$/, "").replace(/_brick$/, "")]) {
    if (known.has(`hbm:${candidate}`)) return `hbm:${candidate}`;
  }
  return undefined;
}

// ---------- little-endian NBT writer (Bedrock) ----------

class Nbt {
  constructor() {
    this.parts = [];
  }
  byte(v) { const b = Buffer.alloc(1); b.writeInt8(v); this.parts.push(b); }
  short(v) { const b = Buffer.alloc(2); b.writeInt16LE(v); this.parts.push(b); }
  int(v) { const b = Buffer.alloc(4); b.writeInt32LE(v); this.parts.push(b); }
  str(v) { const s = Buffer.from(v, "utf8"); this.short(s.length); this.parts.push(s); }
  tag(type, name) { this.byte(type); this.str(name); }
  buffer() { return Buffer.concat(this.parts); }
}
const TAG = { END: 0, BYTE: 1, INT: 3, STRING: 8, LIST: 9, COMPOUND: 10 };

/** Writes a value with the tag type it implies; booleans become bytes. */
function writeNamed(nbt, name, value) {
  if (typeof value === "boolean") { nbt.tag(TAG.BYTE, name); nbt.byte(value ? 1 : 0); }
  else if (typeof value === "number") { nbt.tag(TAG.INT, name); nbt.int(value); }
  else if (typeof value === "string") { nbt.tag(TAG.STRING, name); nbt.str(value); }
  else { nbt.tag(TAG.COMPOUND, name); writeCompoundBody(nbt, value); }
}
function writeCompoundBody(nbt, obj) {
  for (const [k, v] of Object.entries(obj)) writeNamed(nbt, k, v);
  nbt.byte(TAG.END);
}

function mcstructure(size, layer, palette, positionData) {
  const nbt = new Nbt();
  nbt.tag(TAG.COMPOUND, "");
  nbt.tag(TAG.INT, "format_version"); nbt.int(1);
  nbt.tag(TAG.LIST, "size"); nbt.byte(TAG.INT); nbt.int(3); size.forEach((v) => nbt.int(v));
  nbt.tag(TAG.COMPOUND, "structure");
  nbt.tag(TAG.LIST, "block_indices"); nbt.byte(TAG.LIST); nbt.int(2);
  nbt.byte(TAG.INT); nbt.int(layer.length); for (const v of layer) nbt.int(v);
  nbt.byte(TAG.INT); nbt.int(layer.length); for (let i = 0; i < layer.length; i++) nbt.int(-1);
  nbt.tag(TAG.LIST, "entities"); nbt.byte(TAG.COMPOUND); nbt.int(0);
  nbt.tag(TAG.COMPOUND, "palette");
  nbt.tag(TAG.COMPOUND, "default");
  nbt.tag(TAG.LIST, "block_palette"); nbt.byte(TAG.COMPOUND); nbt.int(palette.length);
  for (const p of palette) {
    writeNamed(nbt, "name", p.name);
    writeNamed(nbt, "states", p.states);
    writeNamed(nbt, "version", 18_100_737);
    nbt.byte(TAG.END);
  }
  writeNamed(nbt, "block_position_data", positionData);
  nbt.byte(TAG.END); // default
  nbt.byte(TAG.END); // palette
  nbt.byte(TAG.END); // structure
  nbt.tag(TAG.LIST, "structure_world_origin"); nbt.byte(TAG.INT); nbt.int(3); [0, 0, 0].forEach((v) => nbt.int(v));
  nbt.byte(TAG.END);
  return nbt.buffer();
}

// ---------- world generation ----------

/** Where each structure shows up: biome tags, one in `chance` chunks, and on the sea surface or the ground. */
const PLACEMENT = [
  [/^desert_shack/, ["desert"], 250],
  [/^(crashed_plane|crashed_vertibird|vertibird)/, ["plains", "desert", "savanna"], 500],
  [/^(radio_house|repeater_radio|dish|dead_dish_small|water_pump)$/, ["plains", "forest", "savanna"], 500],
  [/^(falloutshelter_house|forest_post|forest_chem|laboratory)$/, ["forest", "taiga"], 400],
  [/^abandoned_arcticstation$/, ["frozen"], 300],
  [/^(factory|tower_base|spire|crane|crane_mod|military_base)$/, ["plains", "savanna"], 700],
  [/^ntmruins/, ["plains", "forest", "desert", "taiga", "savanna"], 900],
  [/^lighthouse$/, ["beach"], 250],
  [/^beached_patrol$/, ["beach"], 400],
  [/^(submarine|oil_rig)$/, ["ocean"], 400, "sea"],
];
/** Larger footprints do not fit in world generation; those load with /structure. */
const MAX_FOOTPRINT = 48;

/** Chests get vanilla dungeon loot; HBM's own loot tables have no Bedrock counterpart. */
const CHESTS = new Set(["minecraft:chest", "minecraft:trapped_chest"]);

/**
 * @param {{ structures?: any[] }} catalog
 * @param {Set<string>} known ids of the pack's blocks
 * @param {string} BP behavior pack folder
 * @param {(path: string, data: any) => void} write
 */
export function writeStructures(catalog, known, BP, write) {
  // States of our own blocks, so a placed machine or cable is a valid permutation.
  const ownStates = {};
  for (const f of readdirSync(join(BP, "blocks"), { recursive: true }).map(String)) {
    if (!f.endsWith(".json")) continue;
    const d = JSON.parse(readFileSync(join(BP, "blocks", f), "utf8"))["minecraft:block"].description;
    const states = Object.fromEntries(Object.entries(d.states ?? {}).map(([k, v]) => [k, v[0]]));
    if (d.traits?.["minecraft:placement_direction"]) states["minecraft:cardinal_direction"] = "north";
    ownStates[d.identifier] = states;
  }

  const placed = [];
  const stats = { structures: 0, worldgen: 0, unmapped: new Set() };
  for (const s of catalog.structures ?? []) {
    const [sx, sy, sz] = s.size;
    const palette = [];
    const paletteIndex = new Map();
    const mapped = s.palette.map(([name, meta]) => {
      let entry;
      if (name.startsWith("hbm:")) {
        const id = hbmBlock(name, known);
        entry = id && { name: id, states: ownStates[id] ?? {} };
      } else {
        const v = vanilla(name, meta);
        entry = v && { name: `minecraft:${v[0]}`, states: v[1] };
      }
      if (!entry) {
        stats.unmapped.add(name);
        return -1;
      }
      const key = JSON.stringify(entry);
      if (!paletteIndex.has(key)) {
        paletteIndex.set(key, palette.length);
        palette.push(entry);
      }
      return /** @type {number} */ (paletteIndex.get(key));
    });
    const layer = new Array(sx * sy * sz).fill(-1);
    const positionData = {};
    for (const [x, y, z, state] of s.blocks) {
      const index = (x * sy + y) * sz + z;
      const p = mapped[state];
      layer[index] = p;
      if (p >= 0 && CHESTS.has(palette[p].name)) {
        positionData[String(index)] = {
          block_entity_data: { id: "Chest", isMovable: true, Findable: false, LootTable: "loot_tables/chests/simple_dungeon.json", LootTableSeed: 0, x, y, z },
        };
      }
    }
    write(join(BP, `structures/hbm/${s.name}.mcstructure`), mcstructure(s.size, layer, palette, positionData));
    stats.structures++;

    const rule = PLACEMENT.find(([re]) => re.test(s.name));
    if (!rule || sx > MAX_FOOTPRINT || sz > MAX_FOOTPRINT) continue;
    const [, biomes, chance, level] = rule;
    write(join(BP, `features/structures/${s.name}_feature.json`), {
      format_version: "1.13.0",
      "minecraft:structure_template_feature": {
        description: { identifier: `hbm:st_${s.name}_feature` },
        structure_name: `hbm:${s.name}`,
        adjustment_radius: 4,
        facing_direction: "random",
        constraints: level === "sea" ? {} : { grounded: {}, unburied: {} },
      },
    });
    write(join(BP, `feature_rules/structures/${s.name}_rule.json`), {
      format_version: "1.13.0",
      "minecraft:feature_rules": {
        description: { identifier: `hbm:st_${s.name}_rule`, places_feature: `hbm:st_${s.name}_feature` },
        conditions: {
          placement_pass: "surface_pass",
          "minecraft:biome_filter": [{ any_of: biomes.map((b) => ({ test: "has_biome_tag", operator: "==", value: b })) }],
        },
        distribution: {
          iterations: 1,
          scatter_chance: { numerator: 1, denominator: chance },
          x: { distribution: "uniform", extent: [0, 15] },
          y: level === "sea" ? 60 : "query.heightmap(variable.worldx, variable.worldz)",
          z: { distribution: "uniform", extent: [0, 15] },
        },
      },
    });
    placed.push(s.name);
    stats.worldgen++;
  }
  return { ...stats, placed };
}
