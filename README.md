# Universal File Toolbox

**Free browser-based tools for your files.** Convert, compress, edit and analyze files — privately, directly in your browser.

> Your files are processed locally in your browser and are not uploaded to our server.

Universal File Toolbox is a static web app (no backend, no database, no sign-up) that runs entirely on GitHub Pages. Every operation that can be done in a browser is done on the user's device with JavaScript, Web Workers and WebAssembly. A strict Content-Security-Policy (`connect-src 'self' blob: data:`) makes it technically impossible for the page to send file data to another server.

- 56 tools (incl. one-click presets like “PNG to WebP”) in 8 categories, each with its own crawlable page (`/tools/<tool>/`)
- Drag & drop, file picker, paste from clipboard, folder drop (ZIP)
- Batch processing with per-file progress and **Download All** as ZIP
- Installable PWA, works offline after the first visit
- **English & Russian** — separate indexable pages (`/…` and `/ru/…`) with `hreflang`, a language switch in the header, and automatic Russian for Russian-language browsers on the first visit
- Drop files **anywhere on the page**, paste with `Ctrl+V`, sticky action bar, “Done!” notifications
- Dark / Light / System theme, global search in both languages (`/` or `Ctrl+K`), local history
- Works on Windows, macOS, Linux, Android, iOS — desktop and mobile browsers

- **Bonus:** a small website with an interactive 3D black hole (WebGL, no dependencies, Russian) at `/black-hole/` — files in `public/black-hole/` (`index.html`, `style.css`, `site.js`, `engine.js`); open it directly or via the built site

---

## Contents

- [Features & tools](#features--tools)
- [Quick start](#quick-start)
- [Production build](#production-build)
- [Deploy to GitHub Pages](#deploy-to-github-pages)
- [Architecture](#architecture)
- [Adding a new tool](#adding-a-new-tool)
- [Adding a new file format](#adding-a-new-file-format)
- [Languages (i18n)](#languages-i18n)
- [Testing](#testing)
- [Libraries & licenses](#libraries--licenses)
- [Known limitations](#known-limitations)

---

## Features & tools

| Category | Tools |
|---|---|
| **Image** | Image Compressor (JPG/PNG/WebP, quality slider, before/after slider, size saving, batch) · Image Converter (PNG ↔ JPG ↔ WebP; reads BMP, GIF, SVG, ICO, AVIF) · presets: PNG→JPG, JPG→PNG, JPG→WebP, PNG→WebP, WebP→PNG, WebP→JPG, BMP→PNG, SVG→PNG, GIF→PNG, ICO→PNG · Image Resizer (px / %, aspect lock, batch) · Image Cropper (free, 1:1, 4:3, 3:2, 16:9, 9:16, custom) · Rotate & Flip (90/180/270°, H/V flip, batch) · Image Metadata (dimensions, MIME, size, EXIF/IPTC/XMP/GPS) · Favicon Generator (favicon.ico 16/32/48, PNG 16–512, Apple touch icon, manifest, HTML snippet) |
| **PDF** | Merge · Split (every page, every N pages, custom ranges) · Extract / delete pages (thumbnails) · Rotate pages · PDF → PNG/JPG (72–300 dpi) · Images → PDF (A4/Letter/fit, orientation, margins) · PDF Info (pages, sizes, version, metadata) |
| **Files** | Virus Check (local malware red-flag scan + one-click VirusTotal hash lookup) · File Inspector (name, extension, declared vs. detected MIME via magic bytes, size, dates, dimensions, PDF pages, audio duration, SHA-256) · File Hash (SHA-1/256/384/512, compare with expected, streaming SHA-256 for huge files) |
| **Data** | JSON Formatter (format, minify, validate with line/column, highlighting, copy) · CSV Viewer · CSV → JSON · JSON → CSV (delimiter & encoding selection, flattening, Excel BOM) · XML Formatter (format, minify, well-formedness check) · Markdown Preview (safe renderer, HTML export) |
| **Text** | Word / Character / Line counter · Remove duplicate lines · Sort lines (A-Z, Z-A, natural, length, shuffle, reverse) · Reverse text/words · Case converter (12 cases) · Trim spaces · Base64 encode/decode (text & files) · URL encode/decode · HTML entities encode/decode |
| **Archive** | ZIP Creator (files & folders, remove entries, open an existing ZIP to add/remove files, compression level) · ZIP Extractor (browse, preview, download single files, extract all to a folder where supported) |
| **Audio** | Audio to Text (Whisper speech recognition on the device, ~100 languages with auto-detection, TXT / SRT / VTT export) · Audio Info & waveform (duration, sample rate, channels, peak, ID3 tags) · Audio → WAV (mono/stereo, resample, 16/24-bit) · Audio Trimmer (waveform selection, fades, preview, WAV export) |
| **Developer** | UUID v4/v7 generator · Text hash (SHA-1/256/384/512) · JWT decoder (expiry check, signature *not* verified — stated clearly) · File → Data URI |

### Cross-cutting features

- **Batch processing** – choose many files, apply one operation to all of them (resize all / convert all to WebP / compress all), then download each file or **Download All** as one ZIP built in the browser.
- **Smart suggestions** – drop files on the home page; the type is detected (extension + magic bytes) and matching tools are suggested. The files are handed to the chosen tool without re-selecting.
- **Search** – fuzzy, offline search over names, formats and keywords. Typing `webp` lists *JPG to WebP*, *PNG to WebP*, *Compress WebP*, *Resize WebP*, …
- **History** – recently used tools and their last settings are stored in IndexedDB (never files or file names). Can be disabled/cleared in Settings.
- **Save dialog** – optional File System Access API "Save as…" (Chromium desktop); regular downloads everywhere else.
- **Accessibility** – keyboard navigation, visible focus, skip link, ARIA labels/live regions, `<dialog>` modals, ≥ 44 px touch targets, reduced-motion support, contrast-checked palette for both themes.
- **Error handling** – every operation shows a friendly error panel (“Something went wrong. The selected file may be corrupted, unsupported, or too large. [Try another file]”) with technical details; global handlers prevent white screens.

## Quick start

Requirements: **Node.js 20+** (22 recommended).

```bash
git clone https://github.com/MaKyS0/Not-bad-site.git
cd Not-bad-site
npm install --ignore-scripts   # skips onnxruntime-node's native download (unused)
npm run models       # downloads the Whisper models (~120 MB) into public/models/ (git-ignored)
npm run dev          # http://localhost:5173
```

`npm run build` fetches missing models automatically (`prebuild`) and fails if they are absent.

## Production build

```bash
npm run build        # type-check + build into ./dist
npm run preview      # serve ./dist locally
```

The build:

1. bundles the app with Vite (one lazily loaded chunk per tool, separate Web Workers, WASM),
2. generates a **static HTML page for every route** (home, `/tools/`, `/category/<id>/`, `/tools/<id>/`) with `<title>`, meta description, canonical, Open Graph, H1, description, how-to, FAQ and JSON-LD (`WebApplication`, `FAQPage`, `HowTo`, `BreadcrumbList`),
3. writes `404.html`, `manifest.webmanifest`, `sw.js` (offline cache with a content-hash version), `robots.txt`, `sitemap.xml` (when `SITE_URL` is set) and `.nojekyll`,
4. copies the pdf.js fonts / CMaps / WASM decoders to `dist/pdfjs/`.

| Variable | Default | Meaning |
|---|---|---|
| `BASE_PATH` | `./` | URL prefix. `./` (relative) makes one build work at any path. Set `/<repo>/` for absolute URLs on project pages (the workflow does this automatically). |
| `SITE_URL` | – | Public URL ending in `/`, e.g. `https://user.github.io/repo/`. Enables canonical/OG URLs and `sitemap.xml`. |

No absolute `/assets/...` paths are emitted, so the site works at `https://username.github.io/repository/`.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: “GitHub Actions”.**
3. Push to `main` (or run the workflow manually). `.github/workflows/deploy.yml` installs dependencies, runs unit tests, builds with the correct `BASE_PATH`/`SITE_URL` taken from `actions/configure-pages` (works for project pages, user pages and custom domains) and publishes `dist/`.

`.github/workflows/ci.yml` runs unit tests, the production build and the full browser E2E suite on pull requests and feature branches.

Manual alternative: `BASE_PATH=/<repo>/ npm run build` and publish the `dist/` folder to a `gh-pages` branch.

## Architecture

```
index.html                  HTML template (filled at build time)
vite.config.ts              Vite config + static page / SW / manifest / sitemap generator
public/                     icons, favicon.ico
scripts/
  e2e.mjs                   Playwright end-to-end test of the production build
  serve.mjs                 GitHub-Pages-like static server (sub-path + 404.html)
  generate-icons.mjs        renders PWA icons / favicon / OG image from icon.svg
src/
  main.ts, app.ts           bootstrap, global error handling, page switching
  config.ts                 app name, GitHub URL, texts
  components/               UI primitives (buttons, fields, progress, dialogs, toast),
                            dropzone, batch runner, compare slider, text editor, icons
  pages/                    home, all tools, category, tool page
  services/                 router, search, suggestions, history (IndexedDB), settings,
                            theme, download/save, image & hash services, service worker
  tools/
    types.ts                ToolMeta / ToolModule / ToolContext
    catalog.ts              aggregates category catalogs (pure data, also used at build)
    registry.ts             binds metadata to lazily imported modules (import.meta.glob)
    image/ pdf/ data/ text/ archive/ files/ audio/ developer/
                            catalog.ts + one module per tool (+ lib/ for pure logic)
  workers/                  image (OffscreenCanvas), pdfops (pdf-lib), hash, data, audio
                            workers, tiny RPC/pool, service-worker template
  utils/                    DOM helpers, formatting, file-type sniffing, image pipeline,
                            ZIP, PDF ops, page ranges, ICO encoder, SHA-256, errors
  seo/                      shared SEO text + static HTML renderer
  styles/                   fonts, design tokens (light/dark), layout, components, tools
tests/                      Vitest unit tests (pure logic, PDF/ZIP ops, registry)
```

### Tool Registry

Each tool is described by plain metadata and implemented by a lazily loaded module:

```ts
// src/tools/types.ts
interface ToolMeta {
  id: string;                 // URL slug → /tools/<id>/
  name: string;
  category: CategoryId;       // image | pdf | files | data | text | archive | audio | developer
  description: string;
  supportedFormats: string[]; // extensions, ['*'] = any, [] = no file input
  icon: string;
  component: string;          // module path, e.g. 'image/compressor'
  preset?: object;            // options for preset variants (e.g. PNG → WebP)
  keywords?, popular?, batch?, variantOf?, faq?, about?, title?, metaDescription?
}
interface ToolModule {
  mount(root: HTMLElement, ctx: ToolContext): void | (() => void) | Promise<…>;
}
```

`ToolContext` gives each tool: its preset, files handed over from the home page, auto-revoked object URLs, an `AbortSignal` for unmount, cleanup hooks, settings persistence and history recording. Pure processing functions (`ProcessFn`) are plugged into the shared **batch runner** (`components/batch.ts`), which handles queueing, concurrency, progress, errors, per-file download and ZIP export.

### Interface design

The UI is meant to feel like a tool, not a landing page:

- **Palette** – warm paper neutrals with one pine-green brand colour for actions; a burnt-orange "signal" colour is reserved for focus rings and drag-over. Every text/background pair passes WCAG AA in both themes. Tokens live in `src/styles/base.css`.
- **Type** – IBM Plex Sans for the interface and Plex Mono for data: format tags (`PNG`, `JPG → WEBP`), sizes, counts, hashes.
- **Radii by purpose** – 3 px tags, 6 px controls, 8 px cards, 10 px panels; page-level sections are square and separated by rules rather than boxed.
- **Different components for different jobs** – the home page pairs a short intro with the drop zone, lists *common tasks* as rows with format tags, and shows every tool in a dense category index (`components/toolCard.ts`: `toolList`, `directory`). On phones the index collapses into disclosures and the header becomes a menu.
- **Motion** – animations use [Motion](https://motion.dev) (`src/utils/motion.ts`, the WAAPI "mini" build plus `spring`/`stagger`/`inView`). They mark changes the user caused: page content rises in, the home counter counts up, directory groups reveal on scroll, results and toasts pop in with a spring, finished savings get a nudge, the drop-zone icon hops on drag-over, the mobile menu and `<details>` expand smoothly. Elements are never hidden in advance, so nothing depends on an animation finishing; `prefers-reduced-motion` turns every one off.

### Performance & memory

- **Code splitting** – each tool, pdf.js, pdf-lib, exifr, UPNG and the WebP WASM encoder are separate chunks loaded on demand. Initial JS ≈ 25 KB gzip.
- **Web Workers** – image decoding/encoding (OffscreenCanvas), PNG quantisation, PDF manipulation, hashing, large JSON, WAV encoding and ZIP compression (fflate workers) run off the main thread. Idle workers are terminated.
- **Streaming** – ZIP creation streams file chunks; hashing reads 8 MB slices; very large files use an incremental SHA-256.
- **Memory hygiene** – object URLs are tracked per tool and revoked on unmount; canvases are shrunk to 1×1 after use; `ImageBitmap`s are closed; pdf.js documents are destroyed.
- **Canvas limits** – sizes are checked against browser limits (iOS: 16.7 MP) and a clear message is shown instead of a crash.

### Security

- Strict CSP via `<meta>`: `default-src 'self'`, no inline scripts except a hashed theme bootstrap, `connect-src 'self' blob: data:`, `object-src 'none'`, `form-action 'none'`, `wasm-unsafe-eval` only for the WebAssembly codecs.
- No `eval`, no user JavaScript execution. User text is always inserted as text nodes. Markdown is rendered by a sanitising converter that escapes all HTML and allows only `http(s)`/`mailto`/relative links (control characters that browsers strip from URL schemes are removed before the check).
- **User SVG/HTML never becomes a same-origin page.** A `blob:` URL inherits the site's origin, so "Open image in new tab" on an SVG preview would run its scripts with access to the site's storage and service-worker cache. Object URLs of SVG/HTML/XML are created with a non-renderable type, and SVG previews use `data:` URLs (opaque origin, not openable as a top-level page) — see `src/utils/safeUrl.ts`.
- **Hostile files are refused before they can hurt:** PDF page trees are walked once with loop/shared-node detection and a 10 000-page cap (a 4 KB "page-tree bomb" claims a trillion pages); pdf.js runs without XFA and skips embedded images above 100 MP; image headers are read before decoding (> 268 MP refused); ZIP entries are extracted only after checking encryption, declared size, actual size and CRC-32; opening a ZIP for editing refuses > 1 GB / > 10 000 entries / zip-bomb ratios; names written into archives are normalised (no `..`, absolute paths, drive letters, bidi characters); Markdown parsing is linear-time (no ReDoS) with a nesting cap; extremely deep JSON/XML produces a clear error.
- Download and extracted file names are stripped of path characters, control characters and bidi overrides (U+202E "gpj.exe" tricks). JSON→CSV escapes spreadsheet formulas (`=`, `+`, `-`, `@`) by default.
- File types are validated by extension **and** magic bytes; mismatches are reported.

### Audio to Text

`src/tools/audio/transcriber.ts` + `src/workers/asr.worker.ts`. The file is decoded with the Web Audio API, downmixed to 16 kHz mono and cut into ≤ 28 s windows at the quietest moment near each limit (`lib/transcript.ts`), so words are not split. Each window goes to a worker running Whisper through transformers.js on ONNX Runtime's WebAssembly backend; text appears window by window and the run can be stopped at any time.

- **Models are part of the site.** `scripts/fetch-models.mjs` downloads pinned revisions of `onnx-community/whisper-tiny` (41 MB) and `whisper-base` (77 MB), verifying sizes and SHA-256, into `public/models/`. Remote hubs are disabled in the worker and the CSP only allows this origin, so no request leaves the site. The library stores the model in the Cache API after the first use (offline afterwards); the service worker skips `/models/` and does not precache the 14 MB runtime.
- **Language detection** is done explicitly (one decoder step, most likely language token), because transformers.js otherwise silently assumes English.
- **Repetition loops** ("hallucinations" of small Whisper models) are filtered: segments repeating the previous one and phrases repeated 3+ times are collapsed.
- The ONNX Runtime import is aliased from its WebGPU build to the WebAssembly build (`vite.config.ts`), halving the runtime size.

### Virus Check

`src/tools/files/lib/scan.ts` is a static, on-device analyser (run in a Web Worker). It is **not an antivirus** — there is no signature database — but it recognises the tricks malicious files rely on: executables disguised as documents (magic bytes vs. extension), double extensions and bidi characters in names, Office macros (OOXML `vbaProject.bin`, OLE `_VBA_PROJECT`), XLM macro sheets, remote templates and DDE fields, RTF OLE objects and Equation Editor exploits, PDF JavaScript/OpenAction/Launch/EmbeddedFile (also inside compressed object streams and hex-obfuscated names), dropper command lines (PowerShell, certutil, mshta, `curl | sh` …), HTML smuggling and phishing pages, SVG scripts, Base64-embedded executables, zip bombs, zip-slip paths, password-protected archives with programs, image bombs and the EICAR test file. ZIP entries are inspected one by one. The *Check hash on VirusTotal* button opens `virustotal.com/gui/file/<sha256>` — only the hash leaves the device, and only when the user clicks.

## Adding a new tool

1. Add metadata to the category catalog, e.g. `src/tools/image/catalog.ts`:

   ```ts
   {
     id: 'image-grayscale',
     name: 'Grayscale Image',
     category: 'image',
     description: 'Convert photos to black & white.',
     supportedFormats: ['png', 'jpg', 'jpeg', 'webp'],
     icon: 'image',
     component: 'image/grayscale',
     batch: true,
     keywords: ['black and white', 'monochrome'],
   }
   ```

2. Create `src/tools/image/grayscale.ts`:

   ```ts
   import { h } from '../../utils/dom';
   import type { ToolModule } from '../types';
   import { createBatch } from '../../components/batch';

   export const mount: ToolModule['mount'] = (root, ctx) => {
     const batch = createBatch({
       ctx,
       accept: ctx.meta.supportedFormats,
       actionLabel: 'Convert',
       zipName: 'grayscale.zip',
       process: async (file, onProgress, signal) => {
         /* … produce a Blob … */
         return { name: file.name, blob };
       },
     });
     root.append(h('div', { class: 'tool-main' }, batch.el));
   };
   ```

That's it: routing, the static SEO page, sitemap entry, search, suggestions, history and the offline cache pick it up automatically. Add tool-specific FAQ entries with `faq: [...]`, and a preset variant with `variantOf` + `preset`.

## Adding a new file format

1. Add the type to `TYPES` in `src/utils/fileType.ts` (extension, MIME, kind, label), extension aliases to `EXT_ALIASES`, and a magic-byte rule to `sniffBytes()`.
2. Add the extension to `supportedFormats` of every tool that can handle it (the drop zone, suggestions and search use these lists).
3. If decoding needs new code (e.g. a WASM decoder), put it behind a dynamic `import()` in the relevant service so it is only downloaded when used.

## Languages (i18n)

The site is fully available in **English** (`/tools/…`) and **Russian** (`/ru/tools/…`). Every route is generated as a static page in both languages with `<html lang>`, translated title/description/H1/FAQ, JSON-LD `inLanguage` and `hreflang` alternates; the sitemap lists both versions.

- `src/i18n/i18n.ts` — `t('English text', { param })`, plurals (`plural(3, 'file')` → “3 файла”) and translation of dynamic error messages coming from workers.
- `src/i18n/ru.ts` — the Russian dictionary. **English source strings are the keys**, so untranslated text simply falls back to English.
- `src/i18n/catalog.ru.ts` — Russian names, descriptions, FAQ and search keywords for every tool and category.
- The current language comes from the URL. On the first visit, a Russian-language browser is sent to `/ru/…`; an explicit EN/RU choice is remembered.
- Search matches tool names and keywords in both languages.
- `tests/i18n.test.ts` fails if any `t('…')` string in the code has no Russian translation or if placeholders differ.

To add a language: add it to `LANGS` in `i18n.ts`, create a dictionary like `ru.ts` and a catalog file like `catalog.ru.ts`, and hook them into `tr()` and `loc()`.

## Testing

```bash
npm test             # Vitest: 71 unit tests (incl. translation completeness) (text, codecs, JSON/CSV/XML, Markdown XSS,
                     # SHA-256 vs WebCrypto, ICO, WAV, ID3, PDF ops, ZIP, search, registry)
npm run build
npm run test:e2e     # Playwright + Chromium against ./dist served under /Not-bad-site/:
                     # every page in EN and RU, real operations in every category,
                     # language switch & auto-detection, page-wide drag & drop,
                     # offline mode, service worker, 360 px mobile layout, console errors
```

(`test:e2e` needs Chromium: `npx playwright install chromium`, or set `CHROMIUM_PATH`.)

## Libraries & licenses

| Library | Version | License | Used for |
|---|---|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17 | MIT | merge, split, extract, rotate, images → PDF, PDF info |
| [pdfjs-dist](https://github.com/mozilla/pdf.js) (Mozilla pdf.js) | 6.4 | Apache-2.0 | rendering pages (thumbnails, PDF → images), page count. Bundled fonts: Foxit (BSD-style) & Liberation (OFL) — see `dist/pdfjs/standard_fonts/LICENSE_*`; WASM decoders: OpenJPEG (BSD-2), JBIG2 (Apache-2.0), QCMS (MIT) |
| [fflate](https://github.com/101arrowz/fflate) | 0.8 | MIT | ZIP create / extract |
| [exifr](https://github.com/MikeKovarik/exifr) | 7.1 | MIT | EXIF / IPTC / XMP / GPS |
| [PapaParse](https://github.com/mholt/PapaParse) | 5.7 | MIT | CSV parsing / writing |
| [UPNG.js](https://github.com/photopea/UPNG.js) (+ pako) | 2.1 | MIT (pako: MIT/Zlib) | lossy PNG compression (colour quantisation) |
| [@jsquash/webp](https://github.com/jamsinclair/jSquash) (libwebp WASM from Squoosh) | 1.5 | Apache-2.0 (libwebp: BSD-3) | WebP encoding where the browser cannot (Safari) |
| [transformers.js](https://github.com/huggingface/transformers.js) | 4.3 | Apache-2.0 | running Whisper in a Web Worker (speech to text) |
| [Motion](https://github.com/motiondivision/motion) | 14 | MIT | interface animations |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) | 1.31 | MIT | WebAssembly inference backend (CPU, single thread) |
| [Whisper tiny / base](https://github.com/openai/whisper) (int8 ONNX by onnx-community) | — | MIT | speech-recognition models, served from `/models/` |
| [IBM Plex Sans / Mono](https://github.com/IBM/plex) via @fontsource | 5.3 | OFL-1.1 | interface typefaces, self-hosted (Latin + Cyrillic subsets, ~110 KB total, loaded per script) |

Dev tooling: Vite (MIT), TypeScript (Apache-2.0), Vitest (MIT), Playwright (Apache-2.0).
The project itself is released under the [MIT License](LICENSE).

## Known limitations

These are honest browser limits — the app shows a clear message instead of faking a result:

- **Encrypted / password-protected PDFs** cannot be merged, split or rotated (pdf-lib cannot decrypt). PDFs with only permission restrictions can still be rendered by *PDF to Images*.
- **Audio export is WAV only.** Browsers decode MP3/OGG/AAC but ship no encoders; MP3/OGG output is not offered. Decoding support depends on the browser (e.g. some Safari versions can't decode OGG Vorbis).
- **Animated GIF/WebP** → only the first frame is converted.
- **HEIC/TIFF** are only readable where the browser supports them natively (Safari reads HEIC; others don't).
- **EXIF**: output images from compress/convert/resize contain no EXIF (canvas re-encoding). The *Image Metadata* tool reads EXIF but does not edit it; WebP EXIF is not read by exifr.
- **Very large files** are limited by device memory: canvas size limits (iOS ≈ 16.7 MP), ZIP extraction up to 1 GB, decoded audio ≈ 10× the compressed size. Hashing streams files of any size (SHA-256 only above 512 MB).
- **ZIP**: no encrypted archives, no RAR/7z; only Stored/Deflate entries. “Extract all to a folder” needs the File System Access API (Chrome/Edge desktop); elsewhere files are downloaded individually.
- **Audio to Text** runs on the CPU in a single thread (GitHub Pages cannot enable the cross-origin isolation needed for WebAssembly threads), so it is slower than desktop apps: on a recent laptop the accurate model needs roughly 0.4× the audio duration, the fast one about half that; phones are several times slower. The first use downloads the model (41 or 77 MB). Accuracy is that of Whisper tiny/base — good for clear speech, weaker for noisy audio, strong accents and rare names. Recordings are limited to 3 hours and must be decodable by the browser.
- **Virus Check** is heuristic: it has no database of known malware, does not unpack RAR/7z/nested archives, and cannot see inside encrypted content. A clean result is not a guarantee; use the VirusTotal lookup or an antivirus for a definitive answer.
- **Hosting limits (GitHub Pages)**: no custom HTTP headers, so `frame-ancestors`/`X-Frame-Options` (anti-clickjacking) cannot be set — the CSP is delivered via `<meta>`. The app keeps no accounts or secrets, so framing has little impact. All repositories of the same GitHub user share the `<user>.github.io` origin.
- **XML** is checked for well-formedness only (no XSD/DTD validation). **JWT** signatures are not verified.
- **WebP encoding in Safari** uses the bundled WASM encoder (slower than native).
- Service-worker offline mode requires one online visit; the first visit to a tool after an update downloads its chunk.
