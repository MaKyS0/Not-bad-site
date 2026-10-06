/**
 * Minimal ID3v2 (v2.3/v2.4) and ID3v1 text-frame reader for MP3 files.
 */
const FRAMES: Record<string, string> = {
  TIT2: 'Title', TPE1: 'Artist', TALB: 'Album', TPE2: 'Album artist', TCON: 'Genre', TRCK: 'Track', TYER: 'Year', TDRC: 'Year',
  TCOM: 'Composer', TPOS: 'Disc', TBPM: 'BPM', TCOP: 'Copyright', TENC: 'Encoded by', TSSE: 'Encoder', TLEN: 'Length (ms)', TPUB: 'Publisher',
};

function decodeText(enc: number, b: Uint8Array): string {
  const label = enc === 0 ? 'iso-8859-1' : enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : 'utf-8';
  return new TextDecoder(label).decode(b).replace(/\u0000+$/g, '').replace(/\u0000/g, ' / ').trim();
}

const syncsafe = (b: Uint8Array, o: number): number => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);

export interface Id3Result {
  version: string | null;
  tags: [string, string][];
  hasCover: boolean;
}

export function readId3(b: Uint8Array, tail?: Uint8Array): Id3Result {
  const tags: [string, string][] = [];
  let version: string | null = null;
  let hasCover = false;
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const major = b[3];
    version = `ID3v2.${major}`;
    const size = syncsafe(b, 6);
    let o = 10;
    if (b[5] & 0x40) o += major === 4 ? syncsafe(b, 10) : ((b[10] << 24) | (b[11] << 16) | (b[12] << 8) | b[13]) + 4; // extended header
    const end = Math.min(b.length, 10 + size);
    while (o + 10 <= end && major >= 3) {
      const id = String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const fsize = major === 4 ? syncsafe(b, o + 4) : ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) >>> 0;
      const body = b.subarray(o + 10, Math.min(end, o + 10 + fsize));
      if (id === 'APIC') hasCover = true;
      else if (FRAMES[id] && body.length > 1) {
        const value = decodeText(body[0], body.subarray(1));
        if (value) tags.push([FRAMES[id], value]);
      } else if (id === 'COMM' && body.length > 4) {
        const text = decodeText(body[0], body.subarray(4));
        const parts = text.split(' / ');
        const value = parts[parts.length - 1];
        if (value) tags.push(['Comment', value]);
      }
      o += 10 + fsize;
    }
  }
  if (!tags.length && tail && tail.length >= 128) {
    const t = tail.subarray(tail.length - 128);
    if (t[0] === 0x54 && t[1] === 0x41 && t[2] === 0x47) {
      version = version ?? 'ID3v1';
      const s = (a: number, l: number) => new TextDecoder('iso-8859-1').decode(t.subarray(a, a + l)).replace(/\u0000.*$/, '').trim();
      const v1: [string, string][] = [['Title', s(3, 30)], ['Artist', s(33, 30)], ['Album', s(63, 30)], ['Year', s(93, 4)]];
      tags.push(...v1.filter(([, v]) => v));
    }
  }
  return { version, tags, hasCover };
}
