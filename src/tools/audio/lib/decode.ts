/** Decoding and resampling with the Web Audio API (shared by the audio tools). */
import { UserError } from '../../../utils/errors';
import { t } from '../../../i18n/i18n';

type AC = typeof AudioContext;
export const AudioCtx = (): AC | undefined => (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext);

export async function decode(file: File): Promise<AudioBuffer> {
  const Ctor = AudioCtx();
  if (!Ctor) throw new UserError(t('Your browser does not support the Web Audio API.'));
  const ac = new Ctor();
  try {
    const data = await file.arrayBuffer();
    return await new Promise<AudioBuffer>((resolve, reject) => {
      // Callback form for older Safari; promise form elsewhere.
      const p = ac.decodeAudioData(data, resolve, () => reject(new UserError(t('This audio file could not be decoded.'), 'The format or codec may not be supported by your browser (e.g. some browsers cannot decode OGG/Opus or AAC), or the file is damaged.')));
      p?.catch?.(() => undefined);
    });
  } finally {
    void ac.close?.();
  }
}

export async function resample(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (rate === buf.sampleRate) return buf;
  const length = Math.ceil(buf.duration * rate);
  const off = new OfflineAudioContext(buf.numberOfChannels, length, rate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

/** Mono Float32 samples at `rate` Hz (the format speech models expect). */
export async function monoSamples(buf: AudioBuffer, rate: number): Promise<Float32Array> {
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination); // a 1-channel context downmixes stereo
  src.start();
  return (await off.startRendering()).getChannelData(0);
}
