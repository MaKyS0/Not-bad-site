/**
 * Downloads the Whisper speech-recognition models (ONNX, int8) into
 * public/models/ so they are served from this site like any other asset —
 * the browser never contacts a third-party server. Runs before every build;
 * files that already exist with the right size are skipped.
 *
 *   node scripts/fetch-models.mjs
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = fileURLToPath(new URL('../public/models/', import.meta.url));

/** Pinned revisions so a rebuild never silently changes the model. */
const MODELS = {
  'onnx-community/whisper-tiny': 'ff4177021cc41f7db950912b73ea4fdf7d01d8e7',
  'onnx-community/whisper-base': '1846881b6b3a3024392c1eea3ad983695bc23925',
};
const FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx',
];

/** Size and (for large files) SHA-256 of every file, from the Hub's tree API. */
async function manifest(id, rev) {
  const res = await fetch(`https://huggingface.co/api/models/${id}/tree/${rev}?recursive=1`);
  if (!res.ok) throw new Error(`${res.status} listing ${id}`);
  const list = await res.json();
  return new Map(list.map((f) => [f.path, { size: f.size, sha256: f.lfs?.oid }]));
}

async function sha256(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

for (const [id, rev] of Object.entries(MODELS)) {
  const files = await manifest(id, rev);
  for (const file of FILES) {
    const info = files.get(file);
    if (!info) throw new Error(`${id} has no ${file}`);
    const url = `https://huggingface.co/${id}/resolve/${rev}/${file}`;
    const dest = join(root, id, file);
    if (existsSync(dest) && statSync(dest).size === info.size) continue;
    mkdirSync(dirname(dest), { recursive: true });
    process.stdout.write(`↓ ${id}/${file} (${(info.size / 1e6).toFixed(1)} MB)\n`);
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok || !res.body) throw new Error(`${res.status} for ${url}`);
    const part = `${dest}.part`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(part));
    if (statSync(part).size !== info.size) throw new Error(`Incomplete download: ${url}`);
    if (info.sha256 && (await sha256(part)) !== info.sha256) throw new Error(`Checksum mismatch: ${url}`);
    renameSync(part, dest);
  }
}
console.log('Whisper models ready in public/models/');
