// Imports the content of HBM's Nuclear Tech Mod (1.7.10) and NTM Extended (1.12.2) from their
// sources: every item and block that has a texture, its English and Russian name, the crafting
// and smelting recipes whose ingredients can all be resolved, and radiation values.
// Both mods are LGPL-3.0; their LICENSE files and authors are credited in the README.
//
//   node scripts/import-hbm.mjs <HBM repo> [<NTM Extended repo>]
//
// Writes imported/catalog.json and copies textures into resource_pack/textures/imported.
// `npm run generate` then turns the catalog into Bedrock files.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import UPNG from "upng-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEXTURE_OUT = join(root, "resource_pack/textures/imported");
const AUTOGEN_TMP = join(root, "imported/.autogen");

/** Ids of the pack's own, hand-made blocks and items: recipes may use them, the import never replaces them. */
const HANDMADE = new Set();
for (const dir of ["blocks", "items"]) {
  const base = join(root, "behavior_pack", dir);
  if (!existsSync(base)) continue;
  for (const f of readdirSync(base)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(readFileSync(join(base, f), "utf8"));
    HANDMADE.add((doc["minecraft:block"] ?? doc["minecraft:item"]).description.identifier);
  }
}

// ---------- Java source helpers ----------

/** Drops comments while keeping string and char literals intact. */
function stripComments(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i) - 1;
      if (i < 0) break;
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
      if (i <= 0) break;
    } else {
      out += c;
    }
  }
  return out;
}

/** Index of the bracket closing the one opened just before `start`, or of the `;` ending a statement. */
function scanTo(text, start, stopAtSemicolon) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      i = j;
    } else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) {
      if (depth === 0) return i;
      depth--;
    } else if (c === ";" && depth === 0 && stopAtSemicolon) return i;
  }
  return text.length;
}

/** Splits an argument list at its top-level commas. */
function splitArgs(text) {
  const args = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      i = j;
    } else if ("([{<".includes(c) && !(c === "<" && /[\s=]/.test(text[i - 1] ?? ""))) depth += c === "<" ? 0 : 1;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) {
      args.push(text.slice(last, i).trim());
      last = i + 1;
    }
  }
  const tail = text.slice(last).trim();
  if (tail) args.push(tail);
  return args;
}

function javaFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => String(f).endsWith(".java"))
    .map((f) => join(dir, String(f)));
}

/** Every `x = new Cls(...)...;` statement, with the field name and the full statement text. */
function* assignments(text) {
  const re = /\b(\w+)\s*=\s*new\s+([\w.]+)\s*(?:<[^>;]*>)?\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const end = scanTo(text, m.index + m[0].length - 1, true);
    yield { field: m[1], cls: m[2], text: text.slice(m.index, end) };
    re.lastIndex = Math.max(re.lastIndex, end);
  }
}

/** Every call of one of `names`, with its arguments split. */
function* calls(text, names) {
  const re = new RegExp(`\\b(${names.join("|")})\\s*\\(`, "g");
  let m;
  while ((m = re.exec(text))) {
    const start = m.index + m[0].length;
    const end = scanTo(text, start, false);
    yield { name: m[1], args: splitArgs(text.slice(start, end)) };
    re.lastIndex = end;
  }
}

const sanitize = (name) => name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
const num = (s) => Number(String(s).replace(/[_fFdDlL]/g, ""));

/** Evaluates a numeric Java expression whose identifiers are known constants. */
function evaluate(expr, constants) {
  const js = expr
    .replace(/HazardRegistry\./g, "")
    .replace(/\(float\)|\(double\)/g, "")
    .replace(/(\d)[fFdDlL]\b/g, "$1")
    .replace(/(\d)_(?=\d)/g, "$1")
    .replace(/[A-Za-z_]\w*/g, (id) => (id in constants ? `(${constants[id]})` : `@${id}`));
  if (!/^[\d\s.+\-*/()eE]+$/.test(js)) return undefined;
  try {
    const value = Function(`"use strict"; return (${js});`)();
    return Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function readLang(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) map.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  return map;
}

const humanize = (id) => id.replace(/[_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ---------- vanilla 1.7.10 → Bedrock ----------

const SAME_ITEMS = `iron_ingot gold_ingot diamond emerald coal redstone glowstone_dust gunpowder string stick paper book
  leather feather flint bone slime_ball ender_pearl ender_eye blaze_rod blaze_powder magma_cream ghast_tear nether_star
  quartz clay_ball brick netherbrick sugar wheat apple bread carrot potato egg arrow bow bucket water_bucket lava_bucket
  milk_bucket glass_bottle compass clock shears flint_and_steel fire_charge gold_nugget rotten_flesh spider_eye
  fermented_spider_eye pumpkin_seeds melon_seeds nether_wart beef cooked_beef porkchop cooked_porkchop chicken
  cooked_chicken baked_potato poisonous_potato golden_apple golden_carrot mushroom_stew pumpkin_pie cookie name_tag
  saddle lead iron_door minecart chest_minecart hopper_minecart tnt_minecart experience_bottle enchanted_book diamond_sword
  iron_sword golden_sword stone_sword wooden_sword diamond_pickaxe iron_pickaxe golden_pickaxe stone_pickaxe wooden_pickaxe
  diamond_axe iron_axe diamond_shovel iron_shovel diamond_hoe iron_hoe iron_helmet iron_chestplate iron_leggings iron_boots
  diamond_helmet diamond_chestplate diamond_leggings diamond_boots golden_helmet golden_chestplate golden_leggings
  golden_boots leather_helmet leather_chestplate leather_leggings leather_boots chainmail_helmet chainmail_chestplate
  chainmail_leggings chainmail_boots map writable_book written_book carrot_on_a_stick melon cauldron brewing_stand
  comparator repeater cake bed snowball bowl wheat_seeds beetroot beetroot_seeds beetroot_soup`.split(/\s+/);
const VANILLA_ITEMS = {
  ...Object.fromEntries(SAME_ITEMS.map((n) => [n, `minecraft:${n}`])),
  reeds: "minecraft:sugar_cane",
  boat: "minecraft:oak_boat",
  wooden_door: "minecraft:wooden_door",
  sign: "minecraft:oak_sign",
  fish: "minecraft:cod",
  cooked_fished: "minecraft:cooked_cod",
  fireworks: "minecraft:firework_rocket",
  firework_charge: "minecraft:firework_star",
  potionitem: "minecraft:potion",
  speckled_melon: "minecraft:glistering_melon_slice",
  melon: "minecraft:melon_slice",
  golden_axe: "minecraft:golden_axe",
  stone_axe: "minecraft:stone_axe",
  wooden_axe: "minecraft:wooden_axe",
  stone_shovel: "minecraft:stone_shovel",
  wooden_shovel: "minecraft:wooden_shovel",
  golden_shovel: "minecraft:golden_shovel",
};
const SAME_BLOCKS = `stone cobblestone dirt sand gravel glass glass_pane iron_block gold_block diamond_block emerald_block
  redstone_block coal_block lapis_block quartz_block obsidian tnt piston sticky_piston chest trapped_chest furnace
  crafting_table anvil hopper dispenser dropper lever stone_button wooden_button redstone_torch torch ladder iron_bars
  brick_block nether_brick netherrack soul_sand glowstone end_stone clay hardened_clay sandstone mossy_cobblestone ice
  packed_ice snow cactus pumpkin sponge web rail golden_rail detector_rail activator_rail daylight_detector beacon
  enchanting_table ender_chest bookshelf jukebox noteblock redstone_lamp trapdoor cobblestone_wall
  stone_pressure_plate wooden_pressure_plate heavy_weighted_pressure_plate light_weighted_pressure_plate tripwire_hook
  vine waterlily mycelium bedrock gravel lit_pumpkin melon_block redstone_ore iron_ore gold_ore diamond_ore coal_ore
  lapis_ore emerald_ore quartz_ore brown_mushroom red_mushroom`.split(/\s+/);
const VANILLA_BLOCKS = {
  ...Object.fromEntries(SAME_BLOCKS.map((n) => [n, `minecraft:${n}`])),
  grass: "minecraft:grass_block",
  planks: "minecraft:oak_planks",
  log: "minecraft:oak_log",
  log2: "minecraft:acacia_log",
  wool: "minecraft:white_wool",
  stone_slab: "minecraft:smooth_stone_slab",
  wooden_slab: "minecraft:oak_slab",
  stonebrick: "minecraft:stone_bricks",
  red_flower: "minecraft:poppy",
  yellow_flower: "minecraft:dandelion",
  sapling: "minecraft:oak_sapling",
  leaves: "minecraft:oak_leaves",
  fence: "minecraft:oak_fence",
  fence_gate: "minecraft:fence_gate",
  stained_glass: "minecraft:white_stained_glass",
  stained_glass_pane: "minecraft:white_stained_glass_pane",
  stained_hardened_clay: "minecraft:white_terracotta",
  carpet: "minecraft:white_carpet",
  tallgrass: "minecraft:short_grass",
  deadbush: "minecraft:deadbush",
  wooden_door: "minecraft:wooden_door",
  iron_door: "minecraft:iron_door",
};
const DYES = ["ink_sac", "red_dye", "green_dye", "cocoa_beans", "lapis_lazuli", "purple_dye", "cyan_dye", "light_gray_dye", "gray_dye", "pink_dye", "lime_dye", "yellow_dye", "light_blue_dye", "magenta_dye", "orange_dye", "bone_meal"];
const WOOL_COLORS = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];
const VANILLA_KEYS = {
  ingotIron: "minecraft:iron_ingot",
  ingotGold: "minecraft:gold_ingot",
  ingotCopper: "minecraft:copper_ingot",
  nuggetGold: "minecraft:gold_nugget",
  gemDiamond: "minecraft:diamond",
  gemEmerald: "minecraft:emerald",
  gemLapis: "minecraft:lapis_lazuli",
  gemQuartz: "minecraft:quartz",
  gemCoal: "minecraft:coal",
  dustRedstone: "minecraft:redstone",
  dustGlowstone: "minecraft:glowstone_dust",
  stickWood: "minecraft:stick",
  plankWood: "minecraft:oak_planks",
  logWood: "minecraft:oak_log",
  slabWood: "minecraft:oak_slab",
  slimeball: "minecraft:slime_ball",
  blockGlass: "minecraft:glass",
  blockGlassColorless: "minecraft:glass",
  paneGlass: "minecraft:glass_pane",
  paneGlassColorless: "minecraft:glass_pane",
  ingotBrick: "minecraft:brick",
  ingotBrickNether: "minecraft:netherbrick",
  treeLeaves: "minecraft:oak_leaves",
  treeSapling: "minecraft:oak_sapling",
  sand: "minecraft:sand",
  stone: "minecraft:stone",
  cobblestone: "minecraft:cobblestone",
  blockIron: "minecraft:iron_block",
  blockGold: "minecraft:gold_block",
  blockDiamond: "minecraft:diamond_block",
  blockRedstone: "minecraft:redstone_block",
  blockCoal: "minecraft:coal_block",
  blockLapis: "minecraft:lapis_block",
  blockEmerald: "minecraft:emerald_block",
  string: "minecraft:string",
  gunpowder: "minecraft:gunpowder",
  enderpearl: "minecraft:ender_pearl",
  dyeBlack: "minecraft:black_dye",
  dyeRed: "minecraft:red_dye",
  dyeGreen: "minecraft:green_dye",
  dyeBrown: "minecraft:brown_dye",
  dyeBlue: "minecraft:blue_dye",
  dyePurple: "minecraft:purple_dye",
  dyeCyan: "minecraft:cyan_dye",
  dyeLightGray: "minecraft:light_gray_dye",
  dyeGray: "minecraft:gray_dye",
  dyePink: "minecraft:pink_dye",
  dyeLime: "minecraft:lime_dye",
  dyeYellow: "minecraft:yellow_dye",
  dyeLightBlue: "minecraft:light_blue_dye",
  dyeMagenta: "minecraft:magenta_dye",
  dyeOrange: "minecraft:orange_dye",
  dyeWhite: "minecraft:white_dye",
};
/** HBM items that are the same thing as a vanilla item on Bedrock. */
const ALIASES = { "hbm:ingot_copper": "minecraft:copper_ingot", "hbm:nugget_copper": undefined };

// Creative tab → Bedrock creative category.
function category(tab) {
  if (!tab) return "items";
  if (/blockTab|resourceTab/.test(tab)) return /blockTab/.test(tab) ? "construction" : "nature";
  if (/nukeTab|missileTab|weaponTab|tabCombat|tabTools/.test(tab)) return "equipment";
  return "items";
}

// ---------- textures ----------

/** Copies a texture; animated strips keep their first frame. Returns the atlas path. */
function copyTexture(src, outName) {
  const dest = join(TEXTURE_OUT, `${outName}.png`);
  mkdirSync(dirname(dest), { recursive: true });
  const png = UPNG.decode(readFileSync(src));
  let data = readFileSync(src);
  if (png.height > png.width && png.height % png.width === 0) {
    const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
    const frame = rgba.slice(0, png.width * png.width * 4);
    data = Buffer.from(UPNG.encode([frame.buffer], png.width, png.width, 0));
  }
  writeFileSync(dest, data);
  return `textures/imported/${outName}`;
}

/** HBM's autogen colouring: grey 0x505050..0xFFFFFF maps onto the material's dark..light colour. */
function tint(src, dest, light, dark) {
  const png = UPNG.decode(readFileSync(src));
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const shift = 16 - c * 8;
      const lo = (dark >> shift) & 255;
      const hi = (light >> shift) & 255;
      const t = Math.min(1, Math.max(0, (rgba[i + c] - 0x50) / (0xff - 0x50)));
      rgba[i + c] = Math.round(lo + (hi - lo) * t);
    }
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(UPNG.encode([rgba.buffer], png.width, png.height, 0)));
}

// ---------- one mod ----------

/**
 * @param {string} repo
 * @param {"hbm" | "ext"} source
 */
function readMod(repo, source) {
  const javaRoot = join(repo, "src/main/java/com/hbm");
  const assets = join(repo, "src/main/resources/assets/hbm");
  const itemTex = join(assets, "textures/items");
  const blockTex = join(assets, "textures/blocks");
  const legacy = source === "hbm";
  const en = readLang(join(assets, legacy ? "lang/en_US.lang" : "lang/en_us.lang"));
  const ru = readLang(join(assets, legacy ? "lang/ru_RU.lang" : "lang/ru_ru.lang"));
  const files = javaFiles(javaRoot).map((path) => ({ path, text: stripComments(readFileSync(path, "utf8")) }));

  /** @type {Map<string, any>} */
  const items = new Map();
  /** @type {Map<string, any>} */
  const blocks = new Map();
  /** Java field name → Bedrock id, for items and blocks. */
  const fields = new Map();
  /** Item field → enum-variant ids, keyed by the lower-case enum constant. */
  const variants = new Map();

  const names = (key, fallback) => ({ en: en.get(key) ?? humanize(fallback), ru: ru.get(key) ?? en.get(key) ?? humanize(fallback) });
  const tab = (text) => /setCreativeTab\(([\w.]+)\)/.exec(text)?.[1];

  // Extended (1.12.2) keeps textures behind JSON models.
  const model = (kind, name, depth = 0) => {
    const path = join(assets, `models/${kind}/${name}.json`);
    if (!existsSync(path) || depth > 4) return undefined;
    try {
      const json = JSON.parse(readFileSync(path, "utf8"));
      const textures = { ...json.textures };
      const parent = typeof json.parent === "string" && json.parent.startsWith("hbm:") ? model(kind, json.parent.replace(/^hbm:(item|block)\//, ""), depth + 1) : undefined;
      return { ...parent, ...textures };
    } catch {
      return undefined;
    }
  };
  const texFile = (dir, ref) => {
    const rel = String(ref).replace(/^hbm:/, "").replace(/^(items|blocks)\//, "");
    const path = join(dir, `${rel}.png`);
    return existsSync(path) ? path : undefined;
  };

  for (const { text } of files) {
    for (const stmt of assignments(text)) {
      if (legacy && stmt.text.includes(".setUnlocalizedName(")) {
        const unloc = /setUnlocalizedName\("([^"]+)"\)/.exec(stmt.text)?.[1];
        const t = /setTextureName\(RefStrings\.MODID\s*\+\s*":([^"]+)"\)/.exec(stmt.text)?.[1] ?? unloc;
        const creativeTab = tab(stmt.text);
        if (!unloc || !creativeTab || creativeTab === "null") continue;
        const stack = Number(/setMaxStackSize\((\d+)\)/.exec(stmt.text)?.[1] ?? 64);
        const prefix = `${t}.`;
        const variantFiles = t ? readdirSync(itemTex).filter((f) => f.startsWith(prefix) && f.endsWith(".png") && !f.includes("overlay")) : [];
        const named = variantFiles.filter((f) => en.has(`item.${unloc}.${f.slice(prefix.length, -4)}.name`));
        if ((/EnumMulti|\.class\b/.test(stmt.text) && variantFiles.length) || named.length) {
          const found = named.length ? named : variantFiles;
          const map = new Map();
          for (const f of found) {
            const variant = f.slice(prefix.length, -4);
            const id = sanitize(`${unloc}_${variant}`);
            items.set(id, { id, file: join(itemTex, f), stack, category: category(creativeTab), ...names(`item.${unloc}.${variant}.name`, `${unloc}_${variant}`) });
            map.set(variant.toLowerCase(), id);
          }
          if (map.size) variants.set(stmt.field, map);
          continue;
        }
        const file = texFile(itemTex, t);
        if (!file) continue;
        const id = sanitize(unloc);
        items.set(id, { id, file, stack, category: category(creativeTab), ...names(`item.${unloc}.name`, unloc) });
        fields.set(stmt.field, `hbm:${id}`);
      } else if (legacy && stmt.text.includes(".setBlockName(")) {
        const name = /setBlockName\("([^"]+)"\)/.exec(stmt.text)?.[1];
        const creativeTab = tab(stmt.text);
        if (!name || !creativeTab || creativeTab === "null") continue;
        if (/Stairs|Slab|Fence|Door|Pane|Ladder|Fluid|Fire|Flame|Dummy|Portal|Rail|Torch|Sign|Button|Lever|Pressure|Vine|Crop|Sapling|Flower|Plant|Liquid|Grass|Leaves|Bush/.test(stmt.cls)) continue;
        const t = /setBlockTextureName\(RefStrings\.MODID\s*\+\s*":([^"]+)"\)/.exec(stmt.text)?.[1] ?? name;
        const faces = blockFaces((f) => texFile(blockTex, f), t);
        if (!faces) continue;
        const id = sanitize(name);
        blocks.set(id, { id, faces, ...blockStats(stmt.text, creativeTab), ...names(`tile.${name}.name`, name) });
        fields.set(stmt.field, `hbm:${id}`);
      }
    }
  }

  if (!legacy) {
    for (const file of ["items/ModItems.java", "blocks/ModBlocks.java"]) {
      const path = join(javaRoot, file);
      if (!existsSync(path)) continue;
      const text = stripComments(readFileSync(path, "utf8"));
      const isBlock = file.includes("Blocks");
      const re = /static\s+final\s+(?:Item|Block)\s+(\w+)\s*=\s*new\s+([\w.]+)\s*\(\s*"([^"]+)"/g;
      let m;
      while ((m = re.exec(text))) {
        const end = scanTo(text, m.index + m[0].length - 1, true);
        const stmtText = text.slice(m.index, end);
        const [, field, cls, name] = m;
        const creativeTab = tab(stmtText);
        if (creativeTab === "null") continue;
        const id = sanitize(name);
        if (isBlock) {
          if (/Stairs|Slab|Fence|Door|Pane|Ladder|Fluid|Fire|Flame|Dummy|Portal|Rail|Torch|Sign|Button|Lever|Pressure|Vine|Crop|Sapling|Flower|Plant|Liquid|Grass|Leaves|Bush/.test(cls)) continue;
          const tex = model("block", name) ?? {};
          const pick = (...keys) => keys.map((k) => tex[k]).find((v) => typeof v === "string" && !v.startsWith("#"));
          const side = texFile(blockTex, pick("all", "side", "texture", "particle", "front") ?? name);
          if (!side) continue;
          const up = texFile(blockTex, pick("top", "end", "up") ?? "") ?? side;
          const down = texFile(blockTex, pick("bottom", "end", "down") ?? "") ?? up;
          blocks.set(id, { id, faces: { side, up, down }, ...blockStats(stmtText, creativeTab ?? "blockTab"), ...names(`tile.${name}.name`, name) });
        } else {
          const tex = model("item", name);
          const file = texFile(itemTex, (tex?.layer0 ?? name).toString());
          if (!file) continue;
          const stack = Number(/setMaxStackSize\((\d+)\)/.exec(stmtText)?.[1] ?? 64);
          items.set(id, { id, file, stack, category: category(creativeTab), ...names(`item.${name}.name`, name) });
        }
        fields.set(field, `hbm:${id}`);
      }
    }
  }

  // ---------- ore dictionary ----------
  const frames = new Map(); // var -> { name, forms: Map<method, id>, rad }
  const groups = new Map(); // var -> member vars
  const oreKeys = new Map(); // "ingotSteel" -> id
  const hazardConstants = {};
  const rads = new Map();

  const hazardFile = files.find((f) => f.path.endsWith("hazard/HazardRegistry.java"));
  if (hazardFile) {
    const re = /static\s+final\s+(?:float|double|int)\s+(\w+)\s*=\s*([^;]+);/g;
    let m;
    while ((m = re.exec(hazardFile.text))) {
      const value = evaluate(m[2], hazardConstants);
      if (value !== undefined) hazardConstants[m[1]] = value;
    }
  }
  const FORM_MULT = { nugget: "nugget", ingot: "ingot", dustSmall: "powder_tiny", dust: "powder", gem: "gem", crystal: "gem", plate: "plate", plateCast: "plateCast", billet: "billet", block: "block", ore: "ore" };
  const PREFIX = { nugget: "nugget", ingot: "ingot", dustSmall: "dustTiny", dust: "dust", gem: "gem", crystal: "crystal", plate: "plate", billet: "billet", block: "block", ore: "ore", wireFine: "wireFine" };

  const oreFile = files.find((f) => f.path.endsWith("inventory/OreDictManager.java"));
  /** Resolves a bare identifier or ModItems/ModBlocks field to an id. */
  const fieldId = (expr) => {
    const name = expr.trim().replace(/^(ModItems|ModBlocks)\./, "");
    const vanilla = VANILLA_ITEMS[name.toLowerCase()] ?? VANILLA_BLOCKS[name.toLowerCase()];
    // Unknown fields are guessed by name (the other mod may have them); generate.mjs drops
    // every recipe that still points at an id that does not exist.
    const id = fields.get(name) ?? (vanilla && !/^\w+_\w/.test(name) ? undefined : `hbm:${sanitize(name)}`);
    if (!id) return vanilla;
    return id in ALIASES ? ALIASES[id] : id;
  };
  if (oreFile) {
    for (const m of oreFile.text.matchAll(/(?:DictFrame|DictGroup)\s+(\w+)\s*=\s*new\s+(DictFrame|DictGroup)\s*\(([^)]*)\)/g)) {
      const args = splitArgs(m[3]);
      if (m[2] === "DictFrame") frames.set(m[1], { name: args[0]?.replace(/"/g, ""), forms: new Map(), rad: undefined });
      else groups.set(m[1], { name: args[0]?.replace(/"/g, ""), members: args.slice(1) });
    }
    for (const m of oreFile.text.matchAll(/(?<![\w.])([A-Z][A-Z0-9_]*)\s*((?:\.\s*\w+\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s*)+);/g)) {
      const frame = frames.get(m[1]);
      if (!frame) continue;
      for (const call of m[2].matchAll(/\.\s*(\w+)\s*\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g)) {
        const [, method, argText] = call;
        if (method === "rad") {
          frame.rad = evaluate(argText, hazardConstants);
          continue;
        }
        if (!PREFIX[method] && !FORM_MULT[method]) continue;
        const ids = splitArgs(argText).map(fieldId).filter(Boolean);
        if (!ids.length) continue;
        if (!frame.forms.has(method)) frame.forms.set(method, ids[0]);
        const mult = hazardConstants[FORM_MULT[method]];
        if (frame.rad && mult) for (const id of ids) if (!rads.has(id)) rads.set(id, frame.rad * mult);
      }
    }
    for (const frame of frames.values()) {
      for (const [method, id] of frame.forms) if (PREFIX[method] && frame.name) oreKeys.set(PREFIX[method] + frame.name, id);
    }
    for (const group of groups.values()) {
      for (const [method, prefix] of Object.entries(PREFIX)) {
        const id = group.members.map((v) => frames.get(v.trim())?.forms.get(method)).find(Boolean);
        if (id && group.name) oreKeys.set(prefix + group.name, id);
      }
    }
  }
  for (const { text } of files) {
    for (const m of text.matchAll(/OreDictionary\.registerOre\(\s*"(\w+)"\s*,\s*([^;]+?)\)\s*;/g)) {
      const id = fieldId(m[2].replace(/^new ItemStack\(([^,)]+).*$/, "$1"));
      if (id && !oreKeys.has(m[1])) oreKeys.set(m[1], id);
    }
  }
  // Material parts HBM tints from one grey texture per shape (wires, bolts, pipes...).
  const matsFile = files.find((f) => f.path.endsWith("inventory/material/Mats.java"));
  const SHAPES = {
    WIRE: { item: "wire_fine", method: "wireFine" },
    BOLT: { item: "bolt", method: "bolt" },
    DENSEWIRE: { item: "wire_dense", method: "wireDense" },
    SHELL: { item: "shell", method: "shell" },
    PIPE: { item: "pipe", method: "pipe" },
    CASTPLATE: { item: "plate_cast", method: "plateCast" },
    WELDEDPLATE: { item: "plate_welded", method: "plateWelded" },
  };
  if (legacy && matsFile) {
    const re = /(MAT_\w+)\s*=\s*make\w*\(\s*[^,]+,\s*(\w+)\s*,\s*(0x[0-9A-Fa-f]+)\s*,\s*(0x[0-9A-Fa-f]+)[^)]*\)((?:\s*\.\s*\w+\([^()]*\))*)/g;
    for (const m of matsFile.text.matchAll(re)) {
      const [, , frameVar, light, dark, chain] = m;
      const frame = frames.get(frameVar);
      const shapes = /setAutogen\(([^)]*)\)/.exec(chain)?.[1]?.split(",").map((x) => x.trim()) ?? [];
      if (!frame?.name || light === dark) continue;
      const matKey = `hbmmat.${frame.name.toLowerCase()}`;
      for (const shape of shapes) {
        const spec = SHAPES[shape];
        const base = spec && join(itemTex, `${spec.item}.png`);
        if (!spec || !existsSync(base) || frame.forms.has(spec.method)) continue;
        const id = sanitize(`${spec.item}_${frame.name}`);
        const file = join(AUTOGEN_TMP, `${id}.png`);
        tint(base, file, Number(light), Number(dark));
        const pattern = (lang) => lang.get(`item.${spec.item}.name`) ?? "%s";
        items.set(id, {
          id,
          file,
          stack: 64,
          category: "items",
          en: pattern(en).replace("%s", en.get(matKey) ?? frame.name),
          ru: pattern(ru).replace("%s", ru.get(matKey) ?? en.get(matKey) ?? frame.name),
        });
        frame.forms.set(spec.method, `hbm:${id}`);
      }
    }
  }

  const keyConstants = {};
  if (oreFile) for (const m of oreFile.text.matchAll(/static\s+final\s+String\s+(KEY_\w+)\s*=\s*"([^"]+)"/g)) keyConstants[m[1]] = m[2];
  const oreKey = (key) => VANILLA_KEYS[key] ?? oreKeys.get(key);

  /** Resolves an ingredient or output expression to [id, count]. */
  function resolve(expr) {
    expr = expr.trim();
    let m;
    if ((m = /^new\s+ItemStack\s*\(([\s\S]*)\)$/.exec(expr))) {
      const [ref, n, meta] = splitArgs(m[1]);
      const count = n && /^\d+$/.test(n) ? Number(n) : 1;
      const metaValue = meta === undefined || /WILDCARD/.test(meta) ? 0 : /^\d+$/.test(meta.trim()) ? Number(meta) : NaN;
      if (/^Items\.dye$/i.test(ref.trim())) return Number.isNaN(metaValue) ? undefined : [`minecraft:${DYES[metaValue]}`, count];
      if (/^Items\.coal$/i.test(ref.trim()) && metaValue === 1) return ["minecraft:charcoal", count];
      if (/^Blocks\.wool$/i.test(ref.trim())) return Number.isNaN(metaValue) ? undefined : [`minecraft:${WOOL_COLORS[metaValue]}_wool`, count];
      // Extended addresses material parts as new ItemStack(ModItems.wire, 1, MAT_GOLD.id).
      const mat = /^MAT_(\w+)\.id$/.exec((meta ?? "").trim())?.[1];
      if (mat) {
        const shape = { wire: "wire_fine", wire_fine: "wire_fine", bolt: "bolt", wire_dense: "wire_dense", shell: "shell", pipe: "pipe", plate_cast: "plate_cast" }[ref.trim().replace(/^ModItems\./, "")];
        return shape ? [`hbm:${sanitize(`${shape}_${mat}`)}`, count] : undefined;
      }
      if (metaValue !== 0) return undefined;
      const inner = resolve(ref);
      return inner && [inner[0], count];
    }
    if ((m = /^new\s+(ComparableStack|OreDictStack)\s*\(([\s\S]*)\)$/.exec(expr))) {
      const [ref, n, meta] = splitArgs(m[2]);
      if (meta !== undefined && m[1] === "ComparableStack") return resolve(`new ItemStack(${ref}, ${n}, ${meta})`);
      const inner = resolve(ref);
      return inner && [inner[0], n && /^\d+$/.test(n.trim()) ? Number(n) : 1];
    }
    if ((m = /^DictFrame\.fromOne\s*\(([\s\S]*)\)$/.exec(expr))) {
      const [ref, en, n] = splitArgs(m[1]);
      const field = ref.trim().replace(/^(ModItems|ModBlocks)\./, "");
      const constant = en.trim().split(".").pop()?.toLowerCase() ?? "";
      const variant = variants.get(field)?.get(constant) ?? sanitize(`${field}_${constant}`);
      return variant ? [`hbm:${variant}`, n && /^\d+$/.test(n) ? Number(n) : 1] : undefined;
    }
    if ((m = /^Item\.getItemFromBlock\s*\(([\s\S]*)\)$/.exec(expr))) return resolve(m[1]);
    if ((m = /^Items\.(\w+)$/.exec(expr))) return VANILLA_ITEMS[m[1].toLowerCase()] ? [VANILLA_ITEMS[m[1].toLowerCase()], 1] : undefined;
    if ((m = /^Blocks\.(\w+)$/.exec(expr))) return VANILLA_BLOCKS[m[1].toLowerCase()] ? [VANILLA_BLOCKS[m[1].toLowerCase()], 1] : undefined;
    if ((m = /^"(\w+)"$/.exec(expr))) return oreKey(m[1]) ? [/** @type {string} */ (oreKey(m[1])), 1] : undefined;
    if ((m = /^(KEY_\w+)$/.exec(expr))) return keyConstants[m[1]] && oreKey(keyConstants[m[1]]) ? [/** @type {string} */ (oreKey(keyConstants[m[1]])), 1] : undefined;
    if ((m = /^(?:OreDictManager\.)?([A-Z][A-Z0-9_]*)\s*\.\s*(\w+)\s*\(\s*\)$/.exec(expr))) {
      const method = m[2] === "dustTiny" ? "dustSmall" : m[2];
      const frame = frames.get(m[1]);
      const id = frame?.forms.get(method) ?? groups.get(m[1])?.members.map((v) => frames.get(v.trim())?.forms.get(method)).find(Boolean);
      const vanilla = frame?.name && PREFIX[method] ? VANILLA_KEYS[PREFIX[method] + frame.name] : undefined;
      return vanilla ? [vanilla, 1] : id ? [id, 1] : undefined;
    }
    if ((m = /^(?:ModItems\.|ModBlocks\.)?(\w+)$/.exec(expr))) {
      const id = fieldId(m[1]);
      return id ? [id, 1] : undefined;
    }
    return undefined;
  }

  // ---------- recipes ----------
  const recipes = [];
  let seen = 0;
  /** Expressions that kept recipes out, for HBM_IMPORT_REPORT=1. */
  const misses = new Map();
  const miss = (expr) => misses.set(expr, (misses.get(expr) ?? 0) + 1);
  for (const { text } of files) {
    for (const call of calls(text, ["addRecipeAuto", "addShapelessAuto", "addRecipe", "addShapelessRecipe", "addShapedRecipe"])) {
      if (call.args.length < 2) continue;
      seen++;
      const shapeless = /Shapeless/.test(call.name);
      const output = resolve(call.args[0]);
      let rest = call.args.slice(1);
      const arr = /^new\s+Object\s*\[\s*\]\s*\{([\s\S]*)\}$/.exec(rest[0] ?? "");
      if (arr && rest.length === 1) rest = splitArgs(arr[1]);
      if (!output) {
        miss(`output: ${call.args[0]}`);
        continue;
      }
      if (shapeless) {
        const ingredients = rest.map(resolve);
        rest.forEach((r, n) => ingredients[n] || miss(r));
        if (ingredients.some((i) => !i) || !ingredients.length || ingredients.length > 9) continue;
        recipes.push({ type: "shapeless", ingredients: ingredients.map((i) => i?.[0]), output: output[0], count: output[1] });
      } else {
        const pattern = [];
        let i = 0;
        while (i < rest.length && /^"[^"]*"$/.test(rest[i])) pattern.push(rest[i++].slice(1, -1));
        const key = {};
        let ok = pattern.length > 0 && pattern.length <= 3 && pattern.every((row) => row.length <= 3);
        for (; ok && i + 1 < rest.length; i += 2) {
          const ch = /^'(.)'$/.exec(rest[i])?.[1];
          const ingredient = resolve(rest[i + 1]);
          if (!ch || !ingredient) {
            ok = false;
            miss(rest[i + 1] ?? rest[i]);
          }
          else key[ch] = ingredient[0];
        }
        const used = new Set(pattern.join("").replace(/ /g, ""));
        if (!ok || [...used].some((ch) => !key[ch])) continue;
        const width = Math.max(...pattern.map((r) => r.length));
        recipes.push({ type: "shaped", pattern: pattern.map((r) => r.padEnd(width, " ")), key: Object.fromEntries(Object.entries(key).filter(([ch]) => used.has(ch))), output: output[0], count: output[1] });
      }
    }
    for (const call of calls(text, ["addSmelting"])) {
      if (call.args.length < 2) continue;
      seen++;
      const input = resolve(call.args[0]);
      const output = resolve(call.args[1]);
      if (input && output) recipes.push({ type: "furnace", input: input[0], output: output[0], count: 1 });
    }
  }

  // ---------- machine recipes ----------
  /** machine -> [{ inputs: [{ id?, stamp?, n, keep? }], outputs: [[id, n]], ticks, power }] */
  const machineRecipes = {};
  const addMachineRecipe = (machine, recipe) => (machineRecipes[machine] ??= []).push(recipe);
  const stacks = (args) => args.map(resolve);
  const recipeFile = (name) => files.find((f) => f.path.endsWith(`inventory/recipes/${name}.java`));
  if (legacy) {
    const GENERIC = { AssemblyMachineRecipes: "assembly", ChemicalPlantRecipes: "chemical", PrecAssRecipes: "precass", RockMillRecipes: "rockmill", SuperComputerRecipes: "supercomputer" };
    for (const [file, machine] of Object.entries(GENERIC)) {
      const f = recipeFile(file);
      if (!f) continue;
      for (const call of calls(f.text, ["register", "registerPair"])) {
        const chain = call.args[0] ?? "";
        if (!chain.startsWith("new GenericRecipe") || /Fluids?\(/.test(chain)) continue;
        const part = (method) => [...chain.matchAll(new RegExp(`\\.${method}\\s*\\(`, "g"))].map((mm) => splitArgs(chain.slice(mm.index + mm[0].length, scanTo(chain, mm.index + mm[0].length, false))));
        const setup = part("setupNamed")[0] ?? part("setup")[0] ?? [];
        const ins = stacks(part("inputItems")[0] ?? []);
        const outs = stacks(part("outputItems")[0] ?? []);
        if (!ins.length || !outs.length || ins.some((x) => !x) || outs.some((x) => !x)) continue;
        addMachineRecipe(machine, {
          inputs: ins.map((x) => ({ id: x?.[0], n: x?.[1] })),
          outputs: outs.map((x) => [x?.[0], x?.[1]]),
          ticks: num(setup[0] ?? 100),
          power: num(setup[1] ?? 100),
        });
      }
    }
    const centrifuge = recipeFile("CentrifugeRecipes");
    if (centrifuge) {
      for (const call of calls(centrifuge.text, ["recipes\\.put"])) {
        const input = resolve(call.args[0] ?? "");
        const arr = /^new\s+ItemStack\s*\[\s*\]\s*\{([\s\S]*)\}$/.exec(call.args[1] ?? "");
        const outs = arr ? stacks(splitArgs(arr[1])) : [];
        if (!input || !outs.length || outs.some((x) => !x)) continue;
        addMachineRecipe("centrifuge", { inputs: [{ id: input[0], n: input[1] }], outputs: outs.map((x) => [x?.[0], x?.[1]]), ticks: 200, power: 200 });
      }
    }
    const STAMPS = { FLAT: "flat", PLATE: "plate", WIRE: "wire", CIRCUIT: "circuit", C357: "357", THREEFIFESEVEN: "357", C44: "44", FORTYFOUR: "44", C9: "9", NINE: "9", C50: "50", FIFTY: "50" };
    const press = recipeFile("PressRecipes");
    if (press) {
      for (const call of calls(press.text, ["makeRecipe"])) {
        const stamp = STAMPS[/StampType\.(\w+)/.exec(call.args[0] ?? "")?.[1] ?? ""];
        const input = resolve(call.args[1] ?? "");
        const output = resolve(call.args[2] ?? "");
        if (!stamp || !input || !output) continue;
        addMachineRecipe("press", { inputs: [{ id: input[0], n: input[1] }, { stamp, n: 1, keep: true }], outputs: [output], ticks: 40, power: 20 });
      }
    }
    const blast = recipeFile("BlastFurnaceRecipes");
    if (blast) {
      // Frames stand for their ingot, gem or dust, whichever the material has.
      const frameItem = (expr) => {
        const frame = frames.get(expr.trim());
        const id = frame && ["ingot", "gem", "dust", "crystal"].map((f) => frame.forms.get(f)).find(Boolean);
        return id ? [id, 1] : frame?.name && VANILLA_KEYS[`ingot${frame.name}`] ? [VANILLA_KEYS[`ingot${frame.name}`], 1] : frame?.name === "Coal" ? ["minecraft:coal", 1] : resolve(expr);
      };
      for (const call of calls(blast.text, ["addRecipe"])) {
        if (call.args.length !== 3) continue;
        const a = frameItem(call.args[0]);
        const b = frameItem(call.args[1]);
        const out = resolve(call.args[2]);
        if (!a || !b || !out) continue;
        addMachineRecipe("blast", { inputs: [{ id: a[0], n: a[1] }, { id: b[0], n: b[1] }], outputs: [out], ticks: 200, power: 0 });
      }
    }
    for (const f of [recipeFile("ShredderRecipes")].filter(Boolean)) {
      for (const call of calls(/** @type {{text: string}} */ (f).text, ["setRecipe"])) {
        const input = resolve(call.args[0] ?? "");
        const output = resolve(call.args[1] ?? "");
        if (input && output) addMachineRecipe("shredder", { inputs: [{ id: input[0], n: 1 }], outputs: [output], ticks: 60, power: 5 });
      }
    }
  }

  // ---------- explicit radiation entries ----------
  if (hazardFile) {
    for (const call of calls(hazardFile.text, ["HazardSystem\\.register"])) {
      const [ref, data] = call.args;
      const rad = /RADIATION\s*,\s*([^,)]+(?:\([^)]*\)[^,)]*)*)/.exec(data ?? "")?.[1];
      if (!ref || !rad) continue;
      const value = evaluate(rad, hazardConstants);
      const target = resolve(ref);
      if (value && target) rads.set(target[0], value);
    }
  }

  if (process.env.HBM_IMPORT_REPORT) {
    const top = [...misses].sort((a, b) => b[1] - a[1]).slice(0, 40);
    console.log(`--- ${source}: most common unresolved expressions`);
    for (const [expr, n] of top) console.log(String(n).padStart(4), expr.replace(/\s+/g, " ").slice(0, 110));
  }
  return { items, blocks, recipes, rads, seen, machineRecipes };
}

/** Top/side/bottom texture files for a block texture name, or undefined if there is none. */
function blockFaces(find, t) {
  const all = find(t);
  if (all) return { side: all, up: find(`${t}_top`) ?? all, down: find(`${t}_bottom`) ?? find(`${t}_top`) ?? all };
  const side = find(`${t}_side`);
  if (side) {
    const up = find(`${t}_top`) ?? side;
    return { side, up, down: find(`${t}_bottom`) ?? up };
  }
  return undefined;
}

function blockStats(text, creativeTab) {
  const hardness = /setBlockUnbreakable\(\)/.test(text) ? -1 : num(/setHardness\(([^)]+)\)/.exec(text)?.[1] ?? 2);
  const resistance = num(/setResistance\(([^)]+)\)/.exec(text)?.[1] ?? hardness * 5) * 0.6;
  const light = Math.round(num(/setLightLevel\(([^)]+)\)/.exec(text)?.[1] ?? 0) * 15);
  const material = /Material\.(\w+)/.exec(text)?.[1] ?? "rock";
  const tool = /wood|plants|leaves/.test(material) ? "axe" : /ground|sand|clay|grass|snow|craftedSnow/.test(material) ? "shovel" : "pickaxe";
  return {
    hardness: Number.isFinite(hardness) ? Math.min(hardness, 50) : 2,
    resistance: Number.isFinite(resistance) ? Math.min(resistance, 3600000) : 6,
    light: Number.isFinite(light) ? Math.max(0, Math.min(15, light)) : 0,
    tool,
    category: category(creativeTab),
  };
}

// ---------- run ----------

const [hbmRepo, extRepo] = process.argv.slice(2);
if (!hbmRepo) {
  console.error("usage: node scripts/import-hbm.mjs <HBM repo> [<NTM Extended repo>]");
  process.exit(1);
}

rmSync(TEXTURE_OUT, { recursive: true, force: true });
const hbm = readMod(hbmRepo, "hbm");
const ext = extRepo ? readMod(extRepo, "ext") : undefined;

const catalog = { items: [], blocks: [], recipes: [], rads: {}, machineRecipes: {} };
const taken = new Set();

/** @param {ReturnType<typeof readMod>} mod */
function add(mod, source) {
  for (const block of mod.blocks.values()) {
    if (taken.has(block.id) || HANDMADE.has(`hbm:${block.id}`)) continue;
    taken.add(block.id);
    const faces = Object.fromEntries(
      Object.entries(block.faces).map(([face, file]) => [face, copyTexture(file, `${source}/blocks/${relative(dirname(file), file).replace(/\.png$/, "")}`)])
    );
    catalog.blocks.push({ ...block, faces, source });
  }
  for (const item of mod.items.values()) {
    if (taken.has(item.id) || HANDMADE.has(`hbm:${item.id}`)) continue;
    taken.add(item.id);
    const { file, ...rest } = item;
    catalog.items.push({ ...rest, texture: copyTexture(file, `${source}/items/${item.id}`), source });
  }
}
add(hbm, "hbm");
if (ext) add(ext, "ext");

const hbmIds = new Set([...hbm.items.keys(), ...hbm.blocks.keys()].map((id) => `hbm:${id}`));
catalog.recipes.push(...hbm.recipes.map((r) => ({ ...r, source: "hbm" })));
// From Extended only what makes its own things; HBM's recipes stay authoritative for shared items.
if (ext) catalog.recipes.push(...ext.recipes.filter((r) => !hbmIds.has(r.output)).map((r) => ({ ...r, source: "ext" })));
for (const [id, value] of [...(ext?.rads ?? []), ...hbm.rads]) catalog.rads[id] = Math.round(value * 1000) / 1000;
catalog.machineRecipes = hbm.machineRecipes;

rmSync(AUTOGEN_TMP, { recursive: true, force: true });
mkdirSync(join(root, "imported"), { recursive: true });
writeFileSync(join(root, "imported/catalog.json"), JSON.stringify(catalog, null, 1) + "\n");
const extItems = catalog.items.filter((i) => i.source === "ext").length;
const extBlocks = catalog.blocks.filter((b) => b.source === "ext").length;
console.log(`items: ${catalog.items.length} (${extItems} from Extended), blocks: ${catalog.blocks.length} (${extBlocks} from Extended)`);
console.log(`machine recipes: ${Object.entries(catalog.machineRecipes).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
console.log(`recipes: ${catalog.recipes.length} resolved of ${hbm.seen + (ext?.seen ?? 0)} found, radiation entries: ${Object.keys(catalog.rads).length}`);
