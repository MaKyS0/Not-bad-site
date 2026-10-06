import { h, render, debounce, append } from '../../utils/dom';
import type { ToolContext, ToolModule } from '../types';
import { textEditor, loadIntoEditor } from '../../components/textEditor';
import { outputPanel } from '../../components/output';
import { checkbox, field, select, notice, segmented } from '../../components/ui';
import { parseJson, jsonToRows } from './lib/json';
import { describeError } from '../../utils/errors';
import { baseName } from '../../utils/format';
import { routeHref } from '../../services/router';

type Mode = 'view' | 'csv2json' | 'json2csv';
const DELIMS = [
  { value: 'auto', label: 'Auto-detect' },
  { value: ',', label: 'Comma ( , )' },
  { value: ';', label: 'Semicolon ( ; )' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe ( | )' },
];
const DELIM_NAMES: Record<string, string> = { ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' };
const SAMPLE_CSV = 'name,age,city,active\nAnn,31,"Berlin, DE",true\nBob,27,Paris,false\n"Zoë ""Z"" Li",45,Tokyo,true';
const SAMPLE_JSON = '[{"name":"Ann","age":31,"address":{"city":"Berlin","zip":"10115"},"tags":["admin","dev"]},{"name":"Bob","age":27,"address":{"city":"Paris"}}]';
const VIEW_LIMIT = 1000;

export const mount: ToolModule['mount'] = async (root: HTMLElement, ctx: ToolContext) => {
  const mode = ((ctx.preset as { mode?: Mode }).mode ?? 'view') as Mode;
  const s = await ctx.loadSettings({ delimiter: 'auto', header: true, dynamicTyping: true, skipEmpty: true, outDelimiter: ',', bom: false, flatten: true, quoteAll: false, jsonShape: 'objects' as 'objects' | 'arrays' });
  const Papa = (await import('papaparse')).default;
  let used = false;
  const save = () => ctx.saveSettings(s);
  const mark = () => {
    if (!used) {
      used = true;
      ctx.recordUse();
    }
  };

  const status = h('p', { class: 'status-line', role: 'status' });
  const isCsvInput = mode !== 'json2csv';
  const input = textEditor({
    label: isCsvInput ? 'CSV input' : 'JSON input',
    accept: ctx.meta.supportedFormats,
    encoding: isCsvInput,
    rows: 14,
    sample: isCsvInput ? SAMPLE_CSV : SAMPLE_JSON,
    placeholder: isCsvInput ? 'Paste CSV here or open a .csv file…' : 'Paste a JSON array of objects…',
    onInput: debounce(() => run(), 200),
    maxBytes: 100 * 1024 * 1024,
  });
  const name = () => (input.fileName ? baseName(input.fileName) : 'data');
  const output = outputPanel({ label: mode === 'json2csv' ? 'CSV output' : 'JSON output', rows: 14, fileName: () => `${name()}.${mode === 'json2csv' ? 'csv' : 'json'}`, mime: mode === 'json2csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const tableBox = h('div', { class: 'stack-sm' });

  function parseCsv(text: string) {
    const res = Papa.parse<unknown[]>(text, {
      delimiter: s.delimiter === 'auto' ? '' : s.delimiter,
      header: false,
      dynamicTyping: false,
      skipEmptyLines: s.skipEmpty ? 'greedy' : false,
    });
    return res;
  }

  function typed(v: string): unknown {
    if (!s.dynamicTyping) return v;
    if (v === '') return '';
    if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v) && v.length < 16) return Number(v);
    if (/^null$/i.test(v)) return null;
    return v;
  }

  function run() {
    const text = input.value;
    render(tableBox);
    if (!text.trim()) {
      output.set('');
      status.textContent = '';
      return;
    }
    try {
      if (mode === 'json2csv') {
        const { fields, rows } = jsonToRows(parseJson(text), s.flatten);
        const csv = Papa.unparse({ fields, data: rows as unknown[][] }, { delimiter: s.outDelimiter, quotes: s.quoteAll, newline: '\r\n' });
        output.set(s.bom ? `﻿${csv}` : csv);
        status.className = 'status-line status-ok';
        status.textContent = `✓ ${rows.length.toLocaleString()} rows × ${fields.length} columns`;
        mark();
        return;
      }
      const res = parseCsv(text);
      const rows = res.data as string[][];
      const delim = res.meta.delimiter;
      const errs = res.errors.slice(0, 3).map((e) => `Row ${(e.row ?? 0) + 1}: ${e.message}`);
      status.className = `status-line ${errs.length ? 'status-err' : 'status-ok'}`;
      status.textContent = `${errs.length ? '⚠' : '✓'} ${rows.length.toLocaleString()} rows · delimiter: ${DELIM_NAMES[delim] ?? JSON.stringify(delim)}${errs.length ? ` · ${res.errors.length} issue(s): ${errs.join('; ')}` : ''}`;
      if (mode === 'view') {
        renderTable(rows);
      } else {
        let json: unknown;
        if (s.jsonShape === 'objects' && s.header && rows.length) {
          const [head, ...body] = rows;
          const keys = head.map((k, i) => String(k).trim() || `column${i + 1}`);
          json = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, typed(r[i] ?? '')])));
        } else json = rows.map((r) => r.map(typed));
        output.set(JSON.stringify(json, null, 2));
      }
      mark();
    } catch (e) {
      const f = describeError(e);
      output.set('');
      status.className = 'status-line status-err';
      status.textContent = `✗ ${f.title} ${f.message}`;
    }
  }

  function renderTable(rows: string[][]) {
    if (!rows.length) return;
    const head = s.header ? rows[0] : rows[0].map((_, i) => `Column ${i + 1}`);
    const body = s.header ? rows.slice(1) : rows;
    const cols = Math.max(head.length, ...body.slice(0, VIEW_LIMIT).map((r) => r.length));
    render(
      tableBox,
      body.length > VIEW_LIMIT ? notice('info', `Showing the first ${VIEW_LIMIT.toLocaleString()} of ${body.length.toLocaleString()} rows. Convert to JSON to get all data.`) : null,
      h('div', { class: 'table-wrap', style: 'max-height:70vh' },
        h('table', { class: 'data-table' },
          h('thead', null, h('tr', null, h('th', { class: 'rownum', scope: 'col' }, '#'), ...Array.from({ length: cols }, (_, i) => h('th', { scope: 'col' }, head[i] ?? '')))),
          h('tbody', null, ...body.slice(0, VIEW_LIMIT).map((r, i) => h('tr', null, h('td', { class: 'rownum' }, String(i + 1)), ...Array.from({ length: cols }, (_, c) => h('td', { title: r[c] ?? '' }, r[c] ?? ''))))),
        ),
      ),
      h('p', { class: 'hint' }, 'Need JSON? ', h('a', { href: routeHref.tool('csv-to-json') }, 'Convert this CSV to JSON'), '.'),
    );
  }

  const opt = (label: string, key: 'header' | 'dynamicTyping' | 'skipEmpty' | 'bom' | 'flatten' | 'quoteAll') => checkbox(label, s[key], (v) => { s[key] = v; save(); run(); }).el;
  const options = h('div', { class: 'panel stack' });
  if (isCsvInput) {
    append(options, [
      h('div', { class: 'options-grid' }, field('Delimiter', select(DELIMS, s.delimiter, (v) => { s.delimiter = v; save(); run(); }))),
      h('div', { class: 'stack-sm' }, opt('First row is a header', 'header'), mode === 'csv2json' ? opt('Convert numbers & booleans', 'dynamicTyping') : null, opt('Skip empty lines', 'skipEmpty')),
      mode === 'csv2json' ? segmented<'objects' | 'arrays'>('JSON shape', [{ value: 'objects', label: 'Array of objects' }, { value: 'arrays', label: 'Array of arrays' }], s.jsonShape, (v) => { s.jsonShape = v; save(); run(); }).el : null,
      h('p', { class: 'hint' }, 'Wrong characters (Ã©, Ð¿…)? Choose the file’s encoding in the selector next to “Open file”.'),
    ]);
  } else {
    options.append(
      h('div', { class: 'options-grid' }, field('Output delimiter', select(DELIMS.filter((d) => d.value !== 'auto'), s.outDelimiter, (v) => { s.outDelimiter = v; save(); run(); }))),
      h('div', { class: 'stack-sm' }, opt('Flatten nested objects (address.city)', 'flatten'), opt('Quote all fields', 'quoteAll'), opt('Add UTF-8 BOM (helps Excel open non-English text)', 'bom')),
    );
  }
  options.append(status);

  root.append(options, mode === 'view' ? h('div', { class: 'stack' }, input.el, tableBox) : h('div', { class: 'editor-grid' }, input.el, output.el));
  run();
  if (ctx.initialFiles[0]) await loadIntoEditor(input, ctx.initialFiles[0]);
};
