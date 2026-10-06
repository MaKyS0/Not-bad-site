/**
 * Lightweight XML pretty-printer / minifier. It tokenizes the markup (tags,
 * text, comments, CDATA, PIs, doctype) and re-indents it without changing
 * content. Well-formedness is checked separately with DOMParser in the UI.
 */

export type XmlToken =
  | { t: 'open'; raw: string; name: string }
  | { t: 'close'; raw: string; name: string }
  | { t: 'self'; raw: string }
  | { t: 'text'; raw: string }
  | { t: 'comment' | 'cdata' | 'pi' | 'doctype'; raw: string };

export function tokenizeXml(xml: string): XmlToken[] {
  const out: XmlToken[] = [];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    if (xml[i] !== '<') {
      const j = xml.indexOf('<', i);
      const end = j === -1 ? n : j;
      out.push({ t: 'text', raw: xml.slice(i, end) });
      i = end;
      continue;
    }
    const take = (endMarker: string, t: 'comment' | 'cdata' | 'pi') => {
      const j = xml.indexOf(endMarker, i);
      const end = j === -1 ? n : j + endMarker.length;
      out.push({ t, raw: xml.slice(i, end) });
      i = end;
    };
    if (xml.startsWith('<!--', i)) take('-->', 'comment');
    else if (xml.startsWith('<![CDATA[', i)) take(']]>', 'cdata');
    else if (xml.startsWith('<?', i)) take('?>', 'pi');
    else if (xml.startsWith('<!', i)) {
      // DOCTYPE may contain an internal subset in [...]
      let j = i + 2;
      let depth = 0;
      while (j < n) {
        const c = xml[j];
        if (c === '[') depth++;
        else if (c === ']') depth--;
        else if (c === '>' && depth <= 0) break;
        j++;
      }
      out.push({ t: 'doctype', raw: xml.slice(i, j + 1) });
      i = j + 1;
    } else {
      // element tag; respect quoted attribute values containing ">"
      let j = i + 1;
      let quote: string | null = null;
      while (j < n) {
        const c = xml[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === '"' || c === "'") quote = c;
        else if (c === '>') break;
        j++;
      }
      const raw = xml.slice(i, j + 1);
      i = j + 1;
      if (raw.startsWith('</')) out.push({ t: 'close', raw, name: raw.slice(2, -1).trim() });
      else if (raw.endsWith('/>')) out.push({ t: 'self', raw });
      else out.push({ t: 'open', raw, name: /^<([^\s/>]+)/.exec(raw)?.[1] ?? '' });
    }
  }
  return out;
}

export function formatXml(xml: string, indent = '  '): string {
  const tokens = tokenizeXml(xml.replace(/^﻿/, '').trim());
  const lines: string[] = [];
  let level = 0;
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    const pad = indent.repeat(Math.max(0, level));
    switch (tok.t) {
      case 'text': {
        const txt = tok.raw.trim();
        if (txt) lines.push(pad + txt);
        break;
      }
      case 'open': {
        // <a>text</a> stays on one line
        const next = tokens[k + 1];
        const after = tokens[k + 2];
        if (next?.t === 'text' && after?.t === 'close' && !next.raw.includes('\n')) {
          lines.push(pad + tok.raw + next.raw.trim() + after.raw);
          k += 2;
        } else if (next?.t === 'close') {
          lines.push(pad + tok.raw + next.raw);
          k += 1;
        } else {
          lines.push(pad + tok.raw);
          level++;
        }
        break;
      }
      case 'close':
        level--;
        lines.push(indent.repeat(Math.max(0, level)) + tok.raw);
        break;
      default:
        lines.push(pad + tok.raw);
    }
  }
  return lines.join('\n');
}

export function minifyXml(xml: string, removeComments = false): string {
  return tokenizeXml(xml.replace(/^﻿/, '').trim())
    .filter((t) => !(removeComments && t.t === 'comment'))
    .map((t) => (t.t === 'text' ? (t.raw.trim() ? t.raw.replace(/\s+/g, ' ').trim() : '') : t.raw))
    .join('');
}
