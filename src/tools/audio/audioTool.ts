import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, errorPanel, field, kvTable, notice, numberInput, progress, segmented, select, slider, statGrid } from '../../components/ui';
import { WorkerPool } from '../../workers/rpc';
import { peaks } from './lib/wav';
import { readId3 } from './lib/id3';
import { baseName, formatBytes, formatDuration } from '../../utils/format';
import { downloadBlob } from '../../services/download';
import { UserError } from '../../utils/errors';

type Mode = 'info' | 'convert' | 'trim';

let pool: WorkerPool | null = null;
const audioWorker = () => (pool ??= new WorkerPool(() => new Worker(new URL('../../workers/audio.worker.ts', import.meta.url), { type: 'module' }), 1));

type AC = typeof AudioContext;
const AudioCtx = (): AC | undefined => (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext);

async function decode(file: File): Promise<AudioBuffer> {
  const Ctor = AudioCtx();
  if (!Ctor) throw new UserError('Your browser does not support the Web Audio API.');
  const ac = new Ctor();
  try {
    const data = await file.arrayBuffer();
    return await new Promise<AudioBuffer>((resolve, reject) => {
      // Callback form for older Safari; promise form elsewhere.
      const p = ac.decodeAudioData(data, resolve, () => reject(new UserError('This audio file could not be decoded.', 'The format or codec may not be supported by your browser (e.g. some browsers cannot decode OGG/Opus or AAC), or the file is damaged.')));
      p?.catch?.(() => undefined);
    });
  } finally {
    void ac.close?.();
  }
}

async function resample(buf: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (rate === buf.sampleRate) return buf;
  const length = Math.ceil(buf.duration * rate);
  const off = new OfflineAudioContext(buf.numberOfChannels, length, rate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  return off.startRendering();
}

function drawWave(canvas: HTMLCanvasElement, buf: AudioBuffer): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(300, Math.floor(canvas.clientWidth * dpr));
  const hh = Math.floor(140 * dpr);
  canvas.width = w;
  canvas.height = hh;
  const ctx = canvas.getContext('2d')!;
  const style = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, w, hh);
  ctx.fillStyle = style.getPropertyValue('--accent').trim() || '#4f46e5';
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const p0 = peaks(ch0, w);
  const p1 = ch1 ? peaks(ch1, w) : null;
  const mid = hh / 2;
  for (let x = 0; x < w; x++) {
    const lo = Math.min(p0.min[x], p1 ? p1.min[x] : 1);
    const hi = Math.max(p0.max[x], p1 ? p1.max[x] : -1);
    const y1 = mid - hi * mid * 0.95;
    const y2 = mid - lo * mid * 0.95;
    ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const mode = ((ctx.preset as { mode?: Mode }).mode ?? 'info') as Mode;
  const s = await ctx.loadSettings({ channels: 'keep' as 'keep' | 'mono', rate: 'keep', bitDepth: '16' as '16' | '24', fadeIn: 0, fadeOut: 0 });
  const area = h('div', { class: 'stack' });
  const zone = dropzone({ accept: ctx.meta.supportedFormats, multiple: false, onFiles: (f) => void load(f[0]), paste: true, title: 'Drop an audio file here' });
  root.append(zone, area);
  let playCtx: AudioContext | null = null;
  ctx.onCleanup(() => void playCtx?.close?.());

  async function load(file: File) {
    render(area, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Decoding audio…'));
    try {
      if (file.size > 400 * 1024 * 1024) throw new UserError('This file is too large to decode in the browser.', 'Decoded audio needs a lot of memory (about 10× the MP3 size). Try a file under 400 MB.');
      const buf = await decode(file);
      const head = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
      const tail = new Uint8Array(await file.slice(Math.max(0, file.size - 128)).arrayBuffer());
      const id3 = readId3(head, tail);
      show(file, buf, id3.tags, id3.hasCover);
      ctx.recordUse();
    } catch (e) {
      render(area, errorPanel(e));
    }
  }

  function show(file: File, buf: AudioBuffer, tags: [string, string][], hasCover: boolean) {
    let peak = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) peak = a;
      }
    }
    const url = ctx.objectUrl(file);
    const audio = h('audio', { controls: true, src: url, preload: 'metadata' });
    const canvas = h('canvas', { 'aria-label': 'Waveform', role: 'img' });
    const sel = h('div', { class: 'wave-sel', hidden: mode !== 'trim' });
    const playhead = h('div', { class: 'wave-playhead' });
    const wave = h('div', { class: 'waveform-wrap' }, canvas, sel, playhead);
    const dur = buf.duration;
    let start = 0;
    let end = dur;
    const result = h('div', { 'aria-live': 'polite' });
    const prog = progress('Encoding WAV…');

    const startIn = numberInput(0, { min: 0, max: dur, step: 0.01, ariaLabel: 'Start (seconds)', onInput: (v) => { start = Math.max(0, Math.min(v, end - 0.01)); drawSel(); } });
    const endIn = numberInput(Number(dur.toFixed(2)), { min: 0, max: dur, step: 0.01, ariaLabel: 'End (seconds)', onInput: (v) => { end = Math.min(dur, Math.max(v, start + 0.01)); drawSel(); } });
    const selInfo = h('p', { class: 'hint', 'aria-live': 'polite' });
    function drawSel() {
      sel.style.left = `${(start / dur) * 100}%`;
      sel.style.width = `${((end - start) / dur) * 100}%`;
      selInfo.textContent = `Selection: ${formatDuration(start)} → ${formatDuration(end)} (${formatDuration(end - start)})`;
      if (document.activeElement !== startIn) startIn.value = start.toFixed(2);
      if (document.activeElement !== endIn) endIn.value = end.toFixed(2);
    }

    // Pointer selection on the waveform (trim) or seeking (other modes).
    let dragFrom: number | null = null;
    const tAt = (e: PointerEvent) => {
      const r = wave.getBoundingClientRect();
      return Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur));
    };
    wave.addEventListener('pointerdown', (e) => {
      if (mode !== 'trim') {
        audio.currentTime = tAt(e);
        return;
      }
      dragFrom = tAt(e);
      wave.setPointerCapture(e.pointerId);
    });
    wave.addEventListener('pointermove', (e) => {
      if (dragFrom === null) return;
      const t = tAt(e);
      start = Math.min(dragFrom, t);
      end = Math.max(dragFrom, t, start + 0.01);
      drawSel();
    });
    wave.addEventListener('pointerup', () => (dragFrom = null));
    const tick = () => {
      playhead.style.left = `${(audio.currentTime / dur) * 100}%`;
      if (!audio.paused) requestAnimationFrame(tick);
    };
    audio.addEventListener('play', tick);
    audio.addEventListener('seeked', tick);

    let selSource: AudioBufferSourceNode | null = null;
    const playSel = () => {
      const Ctor = AudioCtx();
      if (!Ctor) return;
      playCtx ??= new Ctor();
      selSource?.stop();
      selSource = playCtx.createBufferSource();
      selSource.buffer = buf;
      selSource.connect(playCtx.destination);
      selSource.start(0, start, end - start);
    };

    async function exportWav(trim: boolean) {
      prog.indeterminate('Preparing audio…');
      render(result);
      try {
        let src = buf;
        if (s.rate !== 'keep') src = await resample(buf, Number(s.rate));
        const k = src.sampleRate;
        const from = trim ? Math.floor(start * k) : 0;
        const to = trim ? Math.min(src.length, Math.ceil(end * k)) : src.length;
        let channels: Float32Array[] = [];
        for (let c = 0; c < src.numberOfChannels; c++) channels.push(src.getChannelData(c).slice(from, to));
        if (s.channels === 'mono' && channels.length > 1) {
          const mono = new Float32Array(to - from);
          for (const ch of channels) for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / channels.length;
          channels = [mono];
        }
        prog.indeterminate('Encoding WAV…');
        const bytes = await audioWorker().call<Uint8Array>('encodeWav', { channels, sampleRate: k, bitDepth: Number(s.bitDepth), fadeIn: trim ? s.fadeIn : 0, fadeOut: trim ? s.fadeOut : 0 }, { transfer: channels.map((c) => c.buffer as ArrayBuffer), signal: ctx.signal });
        const blob = new Blob([bytes as BlobPart], { type: 'audio/wav' });
        const name = `${baseName(file.name)}${trim ? '-trimmed' : ''}.wav`;
        const outUrl = ctx.objectUrl(blob);
        render(result,
          h('div', { class: 'batch-summary' }, h('span', null, `${name} · ${formatBytes(blob.size)} · ${formatDuration((to - from) / k)}`), button('Download WAV', { variant: 'primary', icon: 'download', onClick: () => void downloadBlob(blob, name) })),
          h('audio', { controls: true, src: outUrl, style: 'margin-top:8px' }),
        );
        ctx.recordUse(s);
      } catch (e) {
        render(result, errorPanel(e));
      } finally {
        prog.hide();
      }
    }

    const bitrate = (file.size * 8) / dur / 1000;
    const stats = statGrid([
      ['Duration', formatDuration(dur)],
      ['Sample rate', `${buf.sampleRate.toLocaleString()} Hz`],
      ['Channels', buf.numberOfChannels === 1 ? 'Mono' : buf.numberOfChannels === 2 ? 'Stereo' : String(buf.numberOfChannels)],
      ['Peak', peak > 0 ? `${(20 * Math.log10(peak)).toFixed(1)} dBFS` : '−∞ dBFS'],
      ['File size', formatBytes(file.size)],
      ['Avg. bitrate', `${Math.round(bitrate)} kbps`],
    ]);

    const convertOpts = h('div', { class: 'options-grid' },
      segmented<'keep' | 'mono'>('Channels', [{ value: 'keep', label: 'Keep' }, { value: 'mono', label: 'Mono' }], s.channels, (v) => { s.channels = v; ctx.saveSettings(s); }).el,
      field('Sample rate', select([{ value: 'keep', label: `Keep (${buf.sampleRate} Hz)` }, { value: '48000', label: '48,000 Hz' }, { value: '44100', label: '44,100 Hz' }, { value: '22050', label: '22,050 Hz' }, { value: '16000', label: '16,000 Hz (speech)' }], s.rate, (v) => { s.rate = v; ctx.saveSettings(s); })),
      segmented<'16' | '24'>('Bit depth', [{ value: '16', label: '16-bit' }, { value: '24', label: '24-bit' }], s.bitDepth, (v) => { s.bitDepth = v; ctx.saveSettings(s); }).el,
    );

    render(
      area,
      h('div', { class: 'toolbar', style: 'justify-content:space-between' }, h('p', { style: 'margin:0' }, h('strong', { class: 'break' }, file.name)), button('Open another file', { variant: 'ghost', icon: 'upload', onClick: () => zone.querySelector('input')?.click() })),
      stats,
      wave,
      audio,
      mode === 'trim'
        ? h('div', { class: 'panel stack' },
            h('p', { class: 'hint' }, 'Drag across the waveform to select, or type exact times.'),
            h('div', { class: 'two-col' }, field('Start (s)', startIn), field('End (s)', endIn)),
            selInfo,
            h('div', { class: 'two-col' },
              slider('Fade in', s.fadeIn, { min: 0, max: 5, step: 0.1, format: (v) => `${v.toFixed(1)} s`, onInput: (v) => { s.fadeIn = v; ctx.saveSettings(s); } }).el,
              slider('Fade out', s.fadeOut, { min: 0, max: 5, step: 0.1, format: (v) => `${v.toFixed(1)} s`, onInput: (v) => { s.fadeOut = v; ctx.saveSettings(s); } }).el,
            ),
            convertOpts,
            h('div', { class: 'toolbar' }, button('Play selection', { icon: 'play', onClick: playSel }), button('Stop', { variant: 'ghost', icon: 'pause', onClick: () => selSource?.stop() }), button('Download trimmed WAV', { variant: 'primary', icon: 'scissors', onClick: () => void exportWav(true) })),
            prog.el,
          )
        : mode === 'convert'
          ? h('div', { class: 'panel stack' }, convertOpts, notice('info', 'Output is uncompressed PCM WAV. Browsers do not include MP3/OGG encoders, so other output formats are not offered.'), h('div', { class: 'toolbar' }, button('Convert to WAV', { variant: 'primary', icon: 'convert', onClick: () => void exportWav(false) })), prog.el)
          : null,
      result,
      tags.length || hasCover ? kvTable([...tags, ...(hasCover ? ([['Cover art', 'Embedded picture present']] as [string, string][]) : [])], 'Tags (ID3)') : mode === 'info' ? notice('info', 'No ID3 tags found.') : null,
    );
    requestAnimationFrame(() => drawWave(canvas, buf));
    const ro = new ResizeObserver(() => drawWave(canvas, buf));
    ro.observe(wave);
    ctx.onCleanup(() => ro.disconnect());
    drawSel();
  }

  if (ctx.initialFiles[0]) void load(ctx.initialFiles[0]);
};
