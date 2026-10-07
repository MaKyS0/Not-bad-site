/**
 * Small, safe Markdown → HTML converter (CommonMark-ish + GFM tables, task
 * lists, strikethrough). ALL text is HTML-escaped; raw HTML in the source is
 * shown as text. Only http(s)/mailto/relative/anchor links are allowed and
 * remote images are not loaded (they are replaced by links) for privacy.
 */

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const unesc = (s: string): string => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function safeUrl(raw: string): string | null {
  // Browsers ignore control characters and whitespace inside a URL scheme
  // ("\u0001java\tscript:" is javascript:), so drop them before checking.
  const url = unesc(raw).replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^[^/?#]*:/.test(url)) return null; // javascript:, data:, vbscript: …
  return url; // relative or #anchor
}

const isExternal = (u: string): boolean => /^(https?:|mailto:|\/\/)/i.test(u);

const emphasis = (s: string): string =>
  s
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>')
    .replace(/(?<![\w*])\*(?=\S)([\s\S]*?\S)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<![\w_])_(?=\S)([\s\S]*?\S)_(?![\w_])/g, '<em>$1</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

const slug = (s: string): string =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

/**
 * Code spans: a run of N backticks up to the next run of exactly N. Linear-time
 * scanner (the equivalent regex backtracks cubically on long backtick runs).
 */
function codeSpans(src: string, codes: string[]): string {
  let out = '';
  let i = 0;
  const runAt = (p: number) => {
    let e = p;
    while (src.charCodeAt(e) === 96) e++;
    return e - p;
  };
  // Positions of backtick runs by length, so each lookup is O(1) amortised.
  const runs = new Map<number, number[]>();
  for (let p = 0; p < src.length; ) {
    if (src.charCodeAt(p) !== 96) {
      p++;
      continue;
    }
    const n = runAt(p);
    (runs.get(n) ?? runs.set(n, []).get(n)!).push(p);
    p += n;
  }
  const cursor = new Map<number, number>();
  while (i < src.length) {
    const p = src.indexOf('`', i);
    if (p < 0) break;
    const n = runAt(p);
    const list = runs.get(n)!;
    let k = cursor.get(n) ?? 0;
    while (k < list.length && list[k] <= p) k++;
    cursor.set(n, k);
    if (k < list.length) {
      const end = list[k];
      out += src.slice(i, p);
      codes.push(`<code>${esc(src.slice(p + n, end).trim())}</code>`);
      out += `\u0000${codes.length - 1}\u0000`;
      i = end + n;
      cursor.set(n, k + 1);
    } else {
      out += src.slice(i, p + n);
      i = p + n;
    }
  }
  return out + src.slice(i);
}

/** Longer paragraphs skip the link/emphasis passes (their regexes are quadratic). */
const MAX_INLINE = 20_000;

export function inline(src: string): string {
  const codes: string[] = [];
  // Placeholder markers below use U+0000–U+0002; they must not come from the input.
  let s = codeSpans(src.replace(/[\u0000-\u0002]/g, ''), codes);
  s = esc(s);
  if (s.length > MAX_INLINE) return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
  // backslash escapes
  const escapes: string[] = [];
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_m, c: string) => {
    escapes.push(c);
    return `\u0001${escapes.length - 1}\u0001`;
  });
  // Generated tags are parked in placeholders so that the emphasis pass below
  // can never rewrite their attributes.
  const tags: string[] = [];
  const park = (html: string) => {
    tags.push(html);
    return `\u0002${tags.length - 1}\u0002`;
  };
  // images (remote images are not fetched)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt: string, url: string) => {
    const u = safeUrl(url);
    if (!u) return alt;
    return park(`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="md-img">🖼 ${emphasis(alt) || 'image'}</a>`);
  });
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, text: string, url: string, title?: string) => {
    const u = safeUrl(url);
    if (!u) return text;
    return park(`<a href="${esc(u)}"${title ? ` title="${title}"` : ''}${isExternal(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${emphasis(text)}</a>`);
  });
  // autolinks
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, u: string) => park(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`));
  s = emphasis(s).replace(/( {2,}|\\)\n/g, '<br>\n');
  s = s.replace(/\u0002(\d+)\u0002/g, (_m, i: string) => tags[Number(i)]);
  s = s.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => esc(escapes[Number(i)]));
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

const LIST_RE = /^( {0,3})([-*+]|\d{1,9}[.)])\s+(.*)$/;

export function markdownToHtml(md: string): string {
  return blocks(md.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), 0);
}

/** "---", "* * *", "___" … (no regex: nested quantifiers backtrack on long lines). */
function isHr(line: string): boolean {
  if (/^ {4}/.test(line)) return false;
  const t = line.replace(/[ \t]/g, '');
  return t.length >= 3 && /^[-*_]$/.test(t[0]) && t.split('').every((c) => c === t[0]);
}

/** ATX heading: "## Title ##" → [level, text]. */
function heading(line: string): [number, string] | null {
  const m = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/.exec(line);
  if (!m) return null;
  let text = (m[2] ?? '').trimEnd();
  let e = text.length;
  while (e > 0 && text[e - 1] === '#') e--;
  if (e === 0) text = '';
  else if (e < text.length && (text[e - 1] === ' ' || text[e - 1] === '\t')) text = text.slice(0, e).trimEnd();
  return [m[1].length, text];
}

/** Deeper nesting (e.g. 20 000 ">" levels) is rendered as plain paragraphs. */
const MAX_DEPTH = 40;

function blocks(lines: string[], depth: number): string {
  const out: string[] = [];
  let i = 0;
  const isBlank = (l: string | undefined) => l === undefined || !l.trim();
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    // fenced code
    const fence = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${fence[2] ? ` class="language-${esc(fence[2])}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    // heading
    const hm = heading(line);
    if (hm) {
      const content = inline(hm[1]);
      out.push(`<h${hm[0]} id="${slug(content)}">${content}</h${hm[0]}>`);
      i++;
      continue;
    }
    // horizontal rule
    if (isHr(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    // blockquote
    if (/^ {0,3}>/.test(line) && depth < MAX_DEPTH) {
      const body: string[] = [];
      while (i < lines.length && !isBlank(lines[i]) && (/^ {0,3}>/.test(lines[i]) || body.length)) {
        if (!/^ {0,3}>/.test(lines[i]) && (LIST_RE.test(lines[i]) || /^#/.test(lines[i]))) break;
        body.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      out.push(`<blockquote>${blocks(body, depth + 1)}</blockquote>`);
      continue;
    }
    // table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) rows.push(cells(lines[i++]));
      const td = (tag: string, c: string, k: number) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c)}</${tag}>`;
      out.push(`<table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => td('td', r[k] ?? '', k)).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    // list
    const lm = LIST_RE.exec(line);
    if (lm && depth < MAX_DEPTH) {
      const ordered = /\d/.test(lm[2]);
      const start = ordered ? parseInt(lm[2], 10) : 1;
      const items: string[][] = [];
      const baseIndent = lm[1].length;
      while (i < lines.length) {
        const m = LIST_RE.exec(lines[i]);
        if (m && m[1].length <= baseIndent + 1 && /\d/.test(m[2]) === ordered) {
          items.push([m[3]]);
          i++;
          continue;
        }
        if (isBlank(lines[i])) {
          // blank line inside list: continue only if next line is indented or another item
          const next = lines[i + 1];
          if (next !== undefined && (/^\s{2,}\S/.test(next) || (LIST_RE.exec(next) && /\d/.test(LIST_RE.exec(next)![2]) === ordered))) {
            items[items.length - 1].push('');
            i++;
            continue;
          }
          break;
        }
        if (/^\s{2,}\S/.test(lines[i]) || (!LIST_RE.test(lines[i]) && items.length && !/^ {0,3}(#|>|```|~~~)/.test(lines[i]))) {
          items[items.length - 1].push(lines[i].replace(/^ {2,4}/, ''));
          i++;
          continue;
        }
        break;
      }
      const li = items.map((it) => {
        let first = it[0];
        let task = '';
        const tm = /^\[([ xX])\]\s+(.*)$/.exec(first);
        if (tm) {
          task = `<input type="checkbox" disabled${tm[1] !== ' ' ? ' checked' : ''}> `;
          first = tm[2];
        }
        const rest = it.slice(1);
        const hasBlocks = rest.some((l) => l.trim());
        const content = hasBlocks ? blocks([first, ...rest], depth + 1) : inline(first);
        return `<li${task ? ' class="task"' : ''}>${task}${hasBlocks ? content.replace(/^<p>([\s\S]*?)<\/p>/, '$1') : content}</li>`;
      });
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${li.join('')}</ol>` : `<ul>${li.join('')}</ul>`);
      continue;
    }
    // paragraph (with setext headings)
    const para: string[] = [];
    // The first line is always taken, so the loop always makes progress.
    while (i < lines.length && !isBlank(lines[i]) && !(para.length && (/^ {0,3}(#{1,6}\s|>|```|~~~)/.test(lines[i]) || LIST_RE.test(lines[i])))) {
      if (para.length && /^ {0,3}(=+|-+)\s*$/.test(lines[i])) {
        const level = lines[i].trim()[0] === '=' ? 1 : 2;
        const content = inline(para.join('\n'));
        out.push(`<h${level} id="${slug(content)}">${content}</h${level}>`);
        para.length = 0;
        i++;
        break;
      }
      if (para.length && isHr(lines[i])) break;
      para.push(lines[i++]);
    }
    if (para.length) out.push(`<p>${inline(para.join('\n'))}</p>`);
  }
  return out.join('\n');
}
