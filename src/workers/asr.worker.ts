/// <reference lib="webworker" />
/**
 * Speech recognition worker: OpenAI Whisper (ONNX, int8) through
 * transformers.js on the WebAssembly backend. Models are loaded from this
 * site's own /models/ folder; remote model hubs are disabled.
 */
import { env, pipeline, Tensor, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { exposeHandlers } from './rpc';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = true; // Cache API: the model is downloaded once, then works offline
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1; // GitHub Pages can't enable cross-origin isolation

let current: { id: string; asr: Promise<AutomaticSpeechRecognitionPipeline> } | null = null;

function load(id: string, base: string, bytes: number, progress: (v: number) => void): Promise<AutomaticSpeechRecognitionPipeline> {
  if (current?.id === id) return current.asr;
  env.localModelPath = base;
  // GitHub Pages serves the files gzip-compressed without Content-Length, so the
  // total comes from the caller (the known model size), not from the responses.
  const loadedByFile = new Map<string, number>();
  const asr = pipeline('automatic-speech-recognition', id, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file) return;
      loadedByFile.set(p.file, p.loaded ?? 0);
      let loaded = 0;
      loadedByFile.forEach((v) => (loaded += v));
      progress(Math.min(0.99, loaded / bytes));
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
  current = { id, asr };
  asr.catch(() => (current = null));
  return asr;
}

interface Chunk {
  timestamp: [number, number | null];
  text: string;
}

/**
 * Spoken-language identification. Without a language, transformers.js
 * silently assumes English; Whisper itself predicts the language as the first
 * token after <|startoftranscript|>, so run one decoder step and pick the most
 * likely language token.
 */
async function detectLanguage(asr: AutomaticSpeechRecognitionPipeline, audio: Float32Array): Promise<string> {
  const gen = (asr.model as unknown as { generation_config: { lang_to_id: Record<string, number>; decoder_start_token_id: number } }).generation_config;
  const { input_features } = await asr.processor(audio);
  const decoder_input_ids = new Tensor('int64', BigInt64Array.from([BigInt(gen.decoder_start_token_id)]), [1, 1]);
  const out = (await (asr.model as unknown as (inputs: object) => Promise<{ logits: Tensor }>)({ input_features, decoder_input_ids })) as { logits: Tensor };
  const logits = out.logits.data as Float32Array;
  let best = 'en';
  let bestScore = -Infinity;
  for (const [token, id] of Object.entries(gen.lang_to_id)) {
    if (logits[id] > bestScore) {
      bestScore = logits[id];
      best = token.slice(2, -2); // "<|ru|>" → "ru"
    }
  }
  return best;
}

exposeHandlers({
  async detect(p: { model: string; base: string; bytes: number; audio: Float32Array }, progress) {
    const asr = await load(p.model, p.base, p.bytes, progress);
    return { value: await detectLanguage(asr, p.audio) };
  },
  async load(p: { model: string; base: string; bytes: number }, progress) {
    await load(p.model, p.base, p.bytes, progress);
    return { value: true };
  },
  async transcribe(p: { model: string; base: string; bytes: number; audio: Float32Array; language: string }, progress) {
    const asr = await load(p.model, p.base, p.bytes, progress);
    const out = (await asr(p.audio, {
      task: 'transcribe',
      return_timestamps: true,
      ...(p.language === 'auto' ? {} : { language: p.language }),
    })) as { text: string; chunks?: Chunk[] };
    const segments = (out.chunks ?? [{ timestamp: [0, p.audio.length / 16000], text: out.text }]).map((c) => ({ start: c.timestamp[0] ?? 0, end: c.timestamp[1] ?? c.timestamp[0] ?? 0, text: c.text }));
    return { value: segments };
  },
});
