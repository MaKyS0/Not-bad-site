/**
 * Audio to text: speech recognition with Whisper, entirely on the device.
 * The audio is decoded and resampled here, cut into ≤28 s windows at pauses,
 * and each window is transcribed in a worker; text appears as it is ready.
 */
import { h, render } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { dropzone } from '../../components/dropzone';
import { button, checkbox, errorPanel, field, notice, progress, segmented, select } from '../../components/ui';
import { icon } from '../../components/icons';
import { WorkerPool } from '../../workers/rpc';
import { assetUrl } from '../../utils/base';
import { baseName, formatBytes, formatDuration } from '../../utils/format';
import { copyText, downloadBlob } from '../../services/download';
import { isAbort, UserError } from '../../utils/errors';
import { toast } from '../../components/toast';
import { t } from '../../i18n/i18n';
import { decode, monoSamples } from './lib/decode';
import { ASR_RATE, dropRepeats, isSilent, shortStamp, splitAtPauses, toSrt, toTxt, toVtt, type Segment } from './lib/transcript';

const MODELS = {
  tiny: { id: 'onnx-community/whisper-tiny', size: 41, bytes: 43_610_000 },
  base: { id: 'onnx-community/whisper-base', size: 77, bytes: 79_690_000 },
} as const;
type ModelKey = keyof typeof MODELS;

/** Whisper language codes offered in the picker (it supports ~100; these cover most users). */
const LANGUAGES: [string, string][] = [
  ['auto', 'Detect automatically'],
  ['ru', 'Russian'],
  ['en', 'English'],
  ['uk', 'Ukrainian'],
  ['be', 'Belarusian'],
  ['kk', 'Kazakh'],
  ['de', 'German'],
  ['fr', 'French'],
  ['es', 'Spanish'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['pl', 'Polish'],
  ['tr', 'Turkish'],
  ['nl', 'Dutch'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['ar', 'Arabic'],
];

const MAX_SECONDS = 3 * 60 * 60;

let pool: WorkerPool | null = null;
// One worker keeps the loaded model in memory between files; it is released after 10 idle minutes.
const asrWorker = () => (pool ??= new WorkerPool(() => new Worker(new URL('../../workers/asr.worker.ts', import.meta.url), { type: 'module' }), 1, 600_000));

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const s = await ctx.loadSettings({ model: 'base' as ModelKey, language: 'auto', timestamps: false });
  const save = () => ctx.saveSettings(s);
  // A path, not a full URL: transformers.js treats absolute URLs as remote hubs (disabled here).
  const base = new URL(assetUrl('models/')).pathname;

  const modelSeg = segmented<ModelKey>(
    t('Model'),
    [
      { value: 'tiny', label: t('Fast · {size} MB', { size: MODELS.tiny.size }) },
      { value: 'base', label: t('Accurate · {size} MB', { size: MODELS.base.size }) },
    ],
    s.model,
    (v) => ((s.model = v), save()),
  );
  const langSel = select(LANGUAGES.map(([value, label]) => ({ value, label: t(label) })), s.language, (v) => ((s.language = v), save()));
  const stampsBox = checkbox(t('Timestamps in the text'), s.timestamps, (v) => {
    s.timestamps = v;
    save();
    showText();
  });

  const fileInfo = h('div');
  const langNote = h('p', { class: 'hint', 'aria-live': 'polite' });
  const languageName = (code: string) => {
    const known = LANGUAGES.find(([c]) => c === code);
    return known ? t(known[1]) : code.toUpperCase();
  };
  const prog = progress(t('Preparing…'));
  const runBtn = button(t('Transcribe'), { variant: 'primary', icon: 'play', size: 'lg', disabled: true, onClick: () => void run() });
  const stopBtn = button(t('Stop'), { variant: 'ghost', icon: 'x', onClick: () => controller?.abort() });
  stopBtn.hidden = true;
  const textArea = h('textarea', { class: 'input transcript', rows: 14, spellcheck: 'true', 'aria-label': t('Transcript'), placeholder: t('The recognised text will appear here as it is ready.') });
  const exportBar = h('div', { class: 'toolbar' });
  const errorBox = h('div');

  let file: File | null = null;
  let segments: Segment[] = [];
  let controller: AbortController | null = null;
  let edited = false;
  textArea.addEventListener('input', () => (edited = true));

  const showText = () => {
    if (edited && !controller) return; // keep the user's corrections
    textArea.value = segments.length ? toTxt(segments, s.timestamps).trimEnd() : '';
  };

  const name = () => (file ? baseName(file.name) : 'transcript');
  const drawExports = () => {
    const ready = segments.length > 0 && !controller;
    render(
      exportBar,
      button(t('Copy'), { icon: 'copy', disabled: !ready, onClick: () => void copyText(textArea.value) }),
      button(t('Download TXT'), { icon: 'download', disabled: !ready, onClick: () => void downloadBlob(new Blob([textArea.value + '\n'], { type: 'text/plain;charset=utf-8' }), `${name()}.txt`) }),
      button(t('Subtitles SRT'), { icon: 'download', disabled: !ready, onClick: () => void downloadBlob(new Blob([toSrt(segments)], { type: 'application/x-subrip;charset=utf-8' }), `${name()}.srt`) }),
      button(t('Subtitles VTT'), { icon: 'download', disabled: !ready, onClick: () => void downloadBlob(new Blob([toVtt(segments)], { type: 'text/vtt;charset=utf-8' }), `${name()}.vtt`) }),
    );
  };

  function choose(f: File) {
    if (controller) return;
    file = f;
    segments = [];
    edited = false;
    render(errorBox);
    render(fileInfo, h('p', { class: 'file-line' }, icon('audio'), h('strong', { class: 'break' }, f.name), h('span', { class: 'muted' }, formatBytes(f.size))));
    runBtn.disabled = false;
    showText();
    drawExports();
  }

  async function run() {
    if (!file || controller) return;
    controller = new AbortController();
    const signal = 'any' in AbortSignal ? AbortSignal.any([controller.signal, ctx.signal]) : controller.signal;
    const model = MODELS[s.model];
    segments = [];
    edited = false;
    render(errorBox);
    render(langNote);
    runBtn.disabled = true;
    stopBtn.hidden = false;
    showText();
    drawExports();
    try {
      prog.indeterminate(t('Decoding audio…'));
      const buf = await decode(file);
      if (buf.duration > MAX_SECONDS) throw new UserError(t('This recording is longer than 3 hours.'), 'Split it into shorter parts and transcribe them one by one.');
      const audio = await monoSamples(buf, ASR_RATE);
      const total = buf.duration;
      prog.set(0, t('Loading the speech model ({size} MB, only the first time)…', { size: model.size }));
      await asrWorker().call('load', { model: model.id, base, bytes: model.bytes }, { signal, onProgress: (f) => prog.set(f, t('Loading the speech model ({size} MB, only the first time)…', { size: model.size })) });
      const windows = splitAtPauses(audio);
      let language = s.language;
      if (language === 'auto') {
        prog.indeterminate(t('Detecting the language…'));
        const sample = windows.map(([a, b]) => audio.slice(a, b)).find((w) => !isSilent(w)) ?? audio.slice(0, ASR_RATE * 28);
        language = await asrWorker().call<string>('detect', { model: model.id, base, bytes: model.bytes, audio: sample }, { signal, transfer: [sample.buffer] });
        render(langNote, t('Detected language: {name}', { name: languageName(language) }));
      }
      for (const [i, [a, b]] of windows.entries()) {
        const at = a / ASR_RATE;
        prog.set(at / total, t('Recognising speech… {done} of {total}', { done: shortStamp(at), total: shortStamp(total) }));
        const part = audio.slice(a, b);
        if (isSilent(part)) continue;
        const res = await asrWorker().call<Segment[]>('transcribe', { model: model.id, base, bytes: model.bytes, audio: part, language }, { signal, transfer: [part.buffer] });
        segments = dropRepeats([...segments, ...res.map((r) => ({ start: r.start + at, end: Math.min(r.end + at, b / ASR_RATE), text: r.text }))]);
        showText();
        textArea.scrollTop = textArea.scrollHeight;
        if (i === windows.length - 1) prog.set(1);
      }
      controller = null;
      if (!segments.some((x) => x.text.trim())) {
        render(errorBox, notice('warn', t('No speech was recognised. Check that the recording contains speech, or pick the language manually.')));
      } else {
        toast(t('Done! {duration} of audio transcribed.', { duration: formatDuration(total) }), 'success');
        ctx.recordUse(s);
      }
    } catch (e) {
      if (!isAbort(e)) render(errorBox, errorPanel(e, () => void run(), t('Try again')));
      else if (segments.length) render(errorBox, notice('info', t('Stopped. The text recognised so far is kept.')));
    } finally {
      controller = null;
      prog.hide();
      runBtn.disabled = !file;
      stopBtn.hidden = true;
      showText();
      drawExports();
    }
  }

  drawExports();
  root.append(
    h(
      'div',
      { class: 'tool-layout' },
      h('div', { class: 'panel tool-options' },
        modelSeg.el,
        field(t('Language'), langSel, t('Choosing the language improves accuracy for short or noisy recordings.')),
        stampsBox.el,
        notice('info', h('p', null, t('Speech is recognised by the Whisper model running in your browser. The model is downloaded from this site once and then works offline. Nothing is uploaded.'))),
      ),
      h('div', { class: 'tool-main' },
        dropzone({ accept: ctx.meta.supportedFormats, multiple: false, onFiles: (f) => choose(f[0]), title: t('Drop an audio or video file'), compact: true }),
        fileInfo,
        h('div', { class: 'toolbar' }, runBtn, stopBtn),
        prog.el,
        langNote,
        errorBox,
        h('div', { class: 'field' }, h('label', null, t('Transcript')), textArea),
        exportBar,
      ),
    ),
  );
  if (ctx.initialFiles[0]) choose(ctx.initialFiles[0]);
};
