// Packs the add-on into dist/: hbm-bedrock.mcaddon holds both HBM packs, each pack also gets
// its own .mcpack, which some devices import more reliably, and ClearLag ships on its own.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Nested objects make fflate write directory entries, which the game's importer expects. */
function tree(dir) {
  const node = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    node[entry.name] = entry.isDirectory() ? tree(path) : readFileSync(path);
  }
  return node;
}

const bp = tree(join(root, "behavior_pack"));
const rp = tree(join(root, "resource_pack"));
const outputs = {
  "hbm-bedrock.mcaddon": { hbm_behavior_pack: bp, hbm_resource_pack: rp },
  "hbm-bedrock-BP.mcpack": bp,
  "hbm-bedrock-RP.mcpack": rp,
  "clearlag.mcpack": tree(join(root, "clearlag_pack")),
};

mkdirSync(join(root, "dist"), { recursive: true });
for (const [name, files] of Object.entries(outputs)) {
  const out = join(root, "dist", name);
  writeFileSync(out, zipSync(files, { level: 9 }));
  console.log(relative(root, out));
}
