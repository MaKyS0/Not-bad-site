// Static checks the game would otherwise only report at load time:
// every JSON parses, and every id, texture and sound a file points to exists.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BP = join(root, "behavior_pack");
const RP = join(root, "resource_pack");
const errors = [];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${path}: ${e.message}`);
    return {};
  }
}

function jsonFiles(dir) {
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f));
}

const docs = new Map([...jsonFiles(BP), ...jsonFiles(RP)].map((p) => [p, readJson(p)]));
const inDir = (dir) => [...docs].filter(([p]) => p.startsWith(join(BP, dir)) || p.startsWith(join(RP, dir)));

const ids = new Set();
for (const [, doc] of [...inDir("blocks"), ...inDir("items")]) {
  ids.add((doc["minecraft:block"] ?? doc["minecraft:item"]).description.identifier);
}

const terrain = docs.get(join(RP, "textures/terrain_texture.json")).texture_data;
const itemTex = docs.get(join(RP, "textures/item_texture.json")).texture_data;
for (const atlas of [terrain, itemTex]) {
  for (const [key, { textures }] of Object.entries(atlas)) {
    if (!existsSync(join(RP, `${textures}.png`))) errors.push(`texture ${key}: missing ${textures}.png`);
  }
}

const langs = Object.fromEntries(
  ["en_US", "ru_RU"].map((l) => [
    l,
    new Set(
      readFileSync(join(RP, `texts/${l}.lang`), "utf8")
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => line.split("=")[0])
    ),
  ])
);
const needLang = (key, where) => {
  for (const [l, keys] of Object.entries(langs)) if (!keys.has(key)) errors.push(`${where}: ${key} missing in ${l}`);
};

for (const [path, doc] of inDir("blocks")) {
  const c = doc["minecraft:block"].components;
  for (const { texture } of Object.values(c["minecraft:material_instances"])) {
    if (!terrain[texture]) errors.push(`${path}: unknown terrain texture ${texture}`);
  }
  needLang(c["minecraft:display_name"], path);
}

for (const [path, doc] of inDir("items")) {
  const c = doc["minecraft:item"].components;
  const icon = c["minecraft:icon"].textures.default;
  if (!itemTex[icon]) errors.push(`${path}: unknown item texture ${icon}`);
  needLang(c["minecraft:display_name"].value, path);
  const converts = c["minecraft:food"]?.using_converts_to;
  if (converts && !ids.has(converts)) errors.push(`${path}: converts to unknown ${converts}`);
}

const known = (id) => id.startsWith("minecraft:") || ids.has(id);
for (const [path, doc] of inDir("recipes")) {
  const r = doc["minecraft:recipe_shaped"] ?? doc["minecraft:recipe_shapeless"] ?? doc["minecraft:recipe_furnace"];
  const used = [
    ...Object.values(r.key ?? {}).map((k) => k.item),
    ...(r.ingredients ?? []).map((i) => i.item),
    r.input,
    r.output,
    r.result?.item,
  ].filter(Boolean);
  for (const id of used) if (!known(id)) errors.push(`${path}: unknown item ${id}`);
  if (r.pattern) {
    for (const ch of r.pattern.join("").replaceAll(" ", "")) {
      if (!r.key[ch]) errors.push(`${path}: pattern symbol ${ch} has no key`);
    }
  }
}

const features = new Set(inDir("features").map(([, d]) => d["minecraft:ore_feature"].description.identifier));
for (const [path, doc] of inDir("features")) {
  for (const rule of doc["minecraft:ore_feature"].replace_rules) {
    if (!ids.has(rule.places_block)) errors.push(`${path}: places unknown block ${rule.places_block}`);
  }
}
for (const [path, doc] of inDir("feature_rules")) {
  const f = doc["minecraft:feature_rules"].description.places_feature;
  if (!features.has(f)) errors.push(`${path}: unknown feature ${f}`);
}

for (const [path, doc] of inDir("attachables")) {
  const d = doc["minecraft:attachable"].description;
  if (!ids.has(d.identifier)) errors.push(`${path}: attachable for unknown item ${d.identifier}`);
  if (!existsSync(join(RP, `${d.textures.default}.png`))) errors.push(`${path}: missing ${d.textures.default}.png`);
}

const sounds = docs.get(join(RP, "sounds/sound_definitions.json")).sound_definitions;
for (const [name, def] of Object.entries(sounds)) {
  for (const file of def.sounds) if (!existsSync(join(RP, `${file}.ogg`))) errors.push(`sound ${name}: missing ${file}.ogg`);
}

// Ids, sounds and lang keys the script refers to by string.
const script = readFileSync(join(BP, "scripts/main.js"), "utf8");
for (const [, id] of script.matchAll(/"(hbm:[a-z_]+)"/g)) {
  if (!ids.has(id) && !id.startsWith("hbm:rad") && id !== "hbm:setrads") errors.push(`main.js: unknown id ${id}`);
}
for (const [, key] of script.matchAll(/translate: "([^"]+)"/g)) needLang(key, "main.js");
for (const n of [1, 2, 3, 4, 5, 6]) if (!sounds[`hbm.geiger${n}`]) errors.push(`main.js: sound hbm.geiger${n} undefined`);

const bp = docs.get(join(BP, "manifest.json"));
const rp = docs.get(join(RP, "manifest.json"));
if (!bp.dependencies.some((d) => d.uuid === rp.header.uuid)) errors.push("BP manifest does not depend on the RP");
if (!rp.dependencies.some((d) => d.uuid === bp.header.uuid)) errors.push("RP manifest does not depend on the BP");
const uuids = [bp.header, ...bp.modules, rp.header, ...rp.modules].map((m) => m.uuid);
if (new Set(uuids).size !== uuids.length) errors.push("manifest UUIDs are not unique");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${docs.size} JSON files, ${ids.size} blocks/items, ${inDir("recipes").length} recipes`);
