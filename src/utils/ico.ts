/**
 * ICO encoder: packs PNG images into a Windows ICON container.
 * PNG-in-ICO is supported by Windows Vista+ and every modern browser.
 */
export interface IcoImage {
  size: number; // width = height, 1..256
  png: Uint8Array;
}

export function encodeIco(images: IcoImage[]): Uint8Array {
  const count = images.length;
  const headerSize = 6 + 16 * count;
  const total = headerSize + images.reduce((s, i) => s + i.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, count, true);
  let offset = headerSize;
  images.forEach((img, i) => {
    const e = 6 + 16 * i;
    const dim = img.size >= 256 ? 0 : img.size; // 0 means 256
    view.setUint8(e, dim);
    view.setUint8(e + 1, dim);
    view.setUint8(e + 2, 0); // palette colours
    view.setUint8(e + 3, 0); // reserved
    view.setUint16(e + 4, 1, true); // colour planes
    view.setUint16(e + 6, 32, true); // bits per pixel
    view.setUint32(e + 8, img.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(img.png, offset);
    offset += img.png.length;
  });
  return out;
}

/** Parse an ICO directory (used by tests and the file inspector). */
export function readIcoDirectory(buf: Uint8Array): { width: number; height: number; bytes: number; offset: number }[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) throw new Error('Not an ICO file');
  const n = view.getUint16(4, true);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + 16 * i;
    entries.push({
      width: view.getUint8(e) || 256,
      height: view.getUint8(e + 1) || 256,
      bytes: view.getUint32(e + 8, true),
      offset: view.getUint32(e + 12, true),
    });
  }
  return entries;
}
