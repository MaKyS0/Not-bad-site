/**
 * Small, safe Markdown → HTML converter (CommonMark-ish + GFM tables, task
 * lists, strikethrough). ALL text is HTML-escaped; raw HTML in the source is
 * shown as text. Only http(s)/mailto/relative/anchor links are allowed and
 * remote images are not loaded (they are replaced by links) for privacy.
 */

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const unesc = (s: string): string => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function safeUrl(raw: string): string | null {
  const url = unesc(raw).trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // javascript:, data:, vbscript: …
  return url; // relative or #anchor
}

const slug = (s: string): string =>
  s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

export function inline(src: string): string {
  const codes: string[] = [];
  let s = src.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_m, _t, code: string) => {
    codes.push(`<code>${esc(code.trim())}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  // backslash escapes
  const escapes: string[] = [];
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, (_m, c: string) => {
    escapes.push(c);
    return `\u0001${escapes.length - 1}\u0001`;
  });
  // images (remote images are not fetched)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt: string, url: string) => {
    const u = safeUrl(url);
    if (!u) return alt;
    return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="md-img">🖼 ${alt || 'image'}</a>`;
  });
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, text: string, url: string, title?: string) => {
    const u = safeUrl(url);
    if (!u) return text;
    const ext = /^(https?:|mailto:)/i.test(u);
    return `<a href="${esc(u)}"${title ? ` title="${title}"` : ''}${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
  });
  // autolinks
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_m, u: string) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  s = s
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<strong>$2</strong>')
    .replace(/(?<![\w*])\*(?=\S)([\s\S]*?\S)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<![\w_])_(?=\S)([\s\S]*?\S)_(?![\w_])/g, '<em>$1</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/( {2,}|\\)\n/g, '<br>\n');
  s = s.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => esc(escapes[Number(i)]));
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

const LIST_RE = /^( {0,3})([-*+]|\d{1,9}[.)])\s+(.*)$/;

export function markdownToHtml(md: string): string {
  return blocks(md.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}

function blocks(lines: string[]): string {
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
    const hm = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (hm) {
      const content = inline(hm[2]);
      out.push(`<h${hm[1].length} id="${slug(content)}">${content}</h${hm[1].length}>`);
      i++;
      continue;
    }
    // horizontal rule
    if (/^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    // blockquote
    if (/^ {0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && !isBlank(lines[i]) && (/^ {0,3}>/.test(lines[i]) || body.length)) {
        if (!/^ {0,3}>/.test(lines[i]) && (LIST_RE.test(lines[i]) || /^#/.test(lines[i]))) break;
        body.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      out.push(`<blockquote>${blocks(body)}</blockquote>`);
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
    if (lm) {
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
        const content = hasBlocks ? blocks([first, ...rest]) : inline(first);
        return `<li${task ? ' class="task"' : ''}>${task}${hasBlocks ? content.replace(/^<p>([\s\S]*?)<\/p>/, '$1') : content}</li>`;
      });
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${li.join('')}</ol>` : `<ul>${li.join('')}</ul>`);
      continue;
    }
    // paragraph (with setext headings)
    const para: string[] = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^ {0,3}(#{1,6}\s|>|```|~~~)/.test(lines[i]) && !(para.length && LIST_RE.test(lines[i]))) {
      if (para.length && /^ {0,3}(=+|-+)\s*$/.test(lines[i])) {
        const level = lines[i].trim()[0] === '=' ? 1 : 2;
        const content = inline(para.join('\n'));
        out.push(`<h${level} id="${slug(content)}">${content}</h${level}>`);
        para.length = 0;
        i++;
        break;
      }
      if (para.length && /^ {0,3}([-*_])(\s*\1){2,}\s*$/.test(lines[i])) break;
      para.push(lines[i++]);
    }
    if (para.length) out.push(`<p>${inline(para.join('\n'))}</p>`);
  }
  return out.join('\n');
}
