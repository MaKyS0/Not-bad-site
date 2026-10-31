// Packs both packs into dist/hbm-bedrock.mcaddon; opening that file imports them into Minecraft.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {};

for (const pack of ["behavior_pack", "resource_pack"]) {
  const dir = join(root, pack);
  for (const f of readdirSync(dir, { recursive: true })) {
    const path = join(dir, f);
    if (statSync(path).isFile()) files[`hbm_${pack}/${relative(dir, path).replaceAll("\\", "/")}`] = readFileSync(path);
  }
}

mkdirSync(join(root, "dist"), { recursive: true });
const out = join(root, "dist/hbm-bedrock.mcaddon");
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`${relative(root, out)}: ${Object.keys(files).length} files`);
