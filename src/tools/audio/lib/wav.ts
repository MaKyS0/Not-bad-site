/**
 * PCM WAV encoder (16-bit, interleaved). Pure — works in workers and tests.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number, bitDepth: 16 | 24 = 16): Uint8Array {
  const numCh = channels.length;
  const len = channels[0]?.length ?? 0;
  const bytesPerSample = bitDepth / 8;
  const dataSize = len * numCh * bytesPerSample;
  const out = new Uint8Array(44 + dataSize);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, numCh, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * numCh * bytesPerSample, true);
  v.setUint16(32, numCh * bytesPerSample, true);
  v.setUint16(34, bitDepth, true);
  str(36, 'data');
  v.setUint32(40, dataSize, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const x = Math.max(-1, Math.min(1, channels[c][i]));
      if (bitDepth === 16) {
        v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true);
        o += 2;
      } else {
        const n = Math.round(x < 0 ? x * 0x800000 : x * 0x7fffff);
        v.setUint8(o, n & 0xff);
        v.setUint8(o + 1, (n >> 8) & 0xff);
        v.setUint8(o + 2, (n >> 16) & 0xff);
        o += 3;
      }
    }
  }
  return out;
}

/** Linear fade in/out applied in place. */
export function applyFades(channels: Float32Array[], sampleRate: number, fadeIn: number, fadeOut: number): void {
  const fi = Math.floor(fadeIn * sampleRate);
  const fo = Math.floor(fadeOut * sampleRate);
  for (const ch of channels) {
    const n = ch.length;
    for (let i = 0; i < Math.min(fi, n); i++) ch[i] *= i / fi;
    for (let i = 0; i < Math.min(fo, n); i++) ch[n - 1 - i] *= i / fo;
  }
}

/** Min/max peaks per bucket for drawing a waveform. */
export function peaks(data: Float32Array, buckets: number): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const step = data.length / buckets;
  for (let b = 0; b < buckets; b++) {
    let lo = 1;
    let hi = -1;
    const start = Math.floor(b * step);
    const end = Math.min(data.length, Math.floor((b + 1) * step));
    for (let i = start; i < end; i++) {
      const x = data[i];
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    min[b] = start < end ? lo : 0;
    max[b] = start < end ? hi : 0;
  }
  return { min, max };
}
