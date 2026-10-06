/// <reference lib="webworker" />
/** Audio worker: WAV encoding (and fades) off the main thread. */
import { exposeHandlers } from './rpc';
import { applyFades, encodeWav } from '../tools/audio/lib/wav';

exposeHandlers({
  async encodeWav(p: { channels: Float32Array[]; sampleRate: number; bitDepth: 16 | 24; fadeIn: number; fadeOut: number }) {
    if (p.fadeIn || p.fadeOut) applyFades(p.channels, p.sampleRate, p.fadeIn, p.fadeOut);
    const bytes = encodeWav(p.channels, p.sampleRate, p.bitDepth);
    return { value: bytes, transfer: [bytes.buffer as ArrayBuffer] };
  },
});
