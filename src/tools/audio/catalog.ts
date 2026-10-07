import type { ToolMeta } from '../types.ts';

const AUDIO = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'webm'];

export const audioTools: ToolMeta[] = [
  {
    id: 'audio-to-text',
    name: 'Audio to Text',
    category: 'audio',
    description: 'Transcribe speech from audio or video with Whisper. Export TXT, SRT or VTT subtitles.',
    about: 'Turn recordings, voice messages, lectures, interviews and videos into text. Speech is recognised by OpenAI’s Whisper model (int8 ONNX) running in your browser through WebAssembly — the file never leaves your device. The model is downloaded from this site once (41 MB fast or 77 MB accurate) and cached for offline use. Long recordings are split at pauses and the text appears as it is recognised; you can correct it before saving as plain text or as SRT / WebVTT subtitles with timestamps. About 100 languages are supported, including Russian, Ukrainian and English.',
    supportedFormats: [...AUDIO, 'mp4', 'm4v', 'mov'],
    icon: 'transcribe',
    component: 'audio/transcriber',
    keywords: ['speech to text', 'transcribe', 'transcription', 'audio to text', 'voice to text', 'whisper', 'subtitles', 'srt', 'vtt', 'captions', 'dictation', 'mp3 to text', 'video to text'],
    popular: true,
    title: 'Audio to Text Online — Private Speech Recognition, No Upload',
    faq: [
      { q: 'How accurate is it?', a: 'For clear speech the accurate model makes few mistakes; the fast one is quicker but weaker with accents, noise and rare words. Choosing the language instead of auto-detection helps. You can edit the text before downloading.' },
      { q: 'How long does it take?', a: 'It depends on the device. On a modern laptop the fast model handles roughly a minute of audio in 10–30 seconds, the accurate model takes about twice as long. Phones are slower. The text appears piece by piece, and you can stop at any time.' },
      { q: 'Why does the first run download a model?', a: 'Speech recognition needs a neural network. It is served from this site (not from a third party) and stored in your browser cache, so later runs start immediately and work offline.' },
      { q: 'Which files can I use?', a: 'Anything your browser can play: MP3, WAV, M4A/AAC, OGG/Opus, FLAC, WebM and the sound track of MP4/MOV videos. Recordings up to 3 hours.' },
    ],
  },
  {
    id: 'audio-info',
    name: 'Audio Info & Waveform',
    category: 'audio',
    description: 'Duration, sample rate, channels, ID3 tags and a waveform of MP3/WAV/OGG.',
    about: 'Decode an audio file with the Web Audio API to show its exact duration, sample rate, channel count, peak level and waveform. MP3 ID3 tags (title, artist, album) are read when present.',
    supportedFormats: AUDIO,
    icon: 'audio',
    component: 'audio/audioTool',
    preset: { mode: 'info' },
    keywords: ['audio', 'mp3', 'wav', 'ogg', 'duration', 'sample rate', 'waveform', 'id3', 'tags'],
  },
  {
    id: 'audio-converter',
    name: 'Audio to WAV',
    category: 'audio',
    description: 'Convert MP3, OGG and other audio your browser can play to WAV.',
    about: 'Decode MP3, OGG, M4A/AAC, FLAC or Opus (depending on browser support) and save it as uncompressed 16-bit PCM WAV. Optionally downmix to mono or change the sample rate.',
    supportedFormats: AUDIO,
    icon: 'audio',
    component: 'audio/audioTool',
    preset: { mode: 'convert' },
    keywords: ['mp3 to wav', 'ogg to wav', 'convert audio', 'wav', 'pcm'],
    faq: [
      { q: 'Why only WAV output?', a: 'Browsers can decode many formats but do not ship MP3/OGG encoders. WAV is produced with a small built-in encoder; we do not fake other formats.' },
    ],
  },
  {
    id: 'audio-trimmer',
    name: 'Audio Trimmer',
    category: 'audio',
    description: 'Cut a section of an audio file with fade in/out and save as WAV.',
    about: 'Select start and end on the waveform, preview the selection, add optional fades and download the cut as a WAV file. Everything is decoded and encoded locally.',
    supportedFormats: AUDIO,
    icon: 'scissors',
    component: 'audio/audioTool',
    preset: { mode: 'trim' },
    keywords: ['trim', 'cut', 'audio', 'mp3 cutter', 'ringtone', 'clip'],
  },
];
