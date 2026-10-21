/**
 * A minimal ZIP writer (store only, no compression) so a share's files can be
 * saved as one archive through Hub's SAVE_FILE without a library. Attachments
 * are mostly already-compressed media, so storing them costs nothing in size.
 * Filenames are written as UTF-8 (general-purpose flag bit 11), duplicates
 * get a numeric suffix, and sizes are limited to the classic 32-bit format.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Unix ms; defaults to now. */
  modified?: number;
}

/** Above this the classic format would need ZIP64; the app keeps well below it anyway. */
export const ZIP_MAX_TOTAL_BYTES = 0xffffffff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time words as the ZIP format wants them (local time, 2-second steps). */
export function dosDateTime(ms: number): { date: number; time: number } {
  const d = new Date(ms);
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  const date = ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

/** Makes names unique and safe: no leading slashes or `..` segments, and "a.txt", "a (2).txt", … */
export function uniqueZipNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((raw) => {
    const clean =
      raw
        .replace(/\\/g, "/")
        .split("/")
        .filter((part) => part && part !== "." && part !== "..")
        .join("/") || "file";
    const lower = clean.toLowerCase();
    const count = seen.get(lower) ?? 0;
    seen.set(lower, count + 1);
    if (count === 0) return clean;
    const dot = clean.lastIndexOf(".");
    const stem = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    return `${stem} (${count + 1})${ext}`;
  });
}

function u16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}
function u32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

/** Builds the archive bytes. Throws if the total would not fit the classic format. */
export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const names = uniqueZipNames(entries.map((e) => e.name)).map((n) => encoder.encode(n));
  const total = entries.reduce((sum, e) => sum + e.data.length, 0);
  if (total > ZIP_MAX_TOTAL_BYTES || entries.length > 0xffff) throw new Error("Too much data for a zip file");

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  entries.forEach((entry, i) => {
    const name = names[i];
    const crc = crc32(entry.data);
    const { date, time } = dosDateTime(entry.modified ?? Date.now());
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    u32(lv, 0, 0x04034b50);
    u16(lv, 4, 20); // version needed: 2.0
    u16(lv, 6, 0x0800); // UTF-8 names
    u16(lv, 8, 0); // stored
    u16(lv, 10, time);
    u16(lv, 12, date);
    u32(lv, 14, crc);
    u32(lv, 18, entry.data.length);
    u32(lv, 22, entry.data.length);
    u16(lv, 26, name.length);
    u16(lv, 28, 0);
    local.set(name, 30);
    locals.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    u32(cv, 0, 0x02014b50);
    u16(cv, 4, 20); // made by
    u16(cv, 6, 20); // needed
    u16(cv, 8, 0x0800);
    u16(cv, 10, 0);
    u16(cv, 12, time);
    u16(cv, 14, date);
    u32(cv, 16, crc);
    u32(cv, 20, entry.data.length);
    u32(cv, 24, entry.data.length);
    u16(cv, 28, name.length);
    u16(cv, 30, 0); // extra
    u16(cv, 32, 0); // comment
    u16(cv, 34, 0); // disk
    u16(cv, 36, 0); // internal attrs
    u32(cv, 38, 0); // external attrs
    u32(cv, 42, offset);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + entry.data.length;
  });

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  u32(ev, 0, 0x06054b50);
  u16(ev, 4, 0);
  u16(ev, 6, 0);
  u16(ev, 8, entries.length);
  u16(ev, 10, entries.length);
  u32(ev, 12, centralSize);
  u32(ev, 16, offset);
  u16(ev, 20, 0);

  const out = new Uint8Array(new ArrayBuffer(offset + centralSize + 22));
  let pos = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}
