/**
 * The files inside a ZIP archive, from its central directory: the list a
 * ZIP keeps at its end, so the archive is never read whole. Pure: the
 * viewer reads the last bytes (TAIL_BYTES), finds the end record, then
 * reads the directory it points to. ZIP64 archives (over 4 GB or 65,535
 * files) are read when their records are in the bytes read.
 */

/** The end record is at most this far from the end (22 bytes and a comment of up to 65,535). */
export const TAIL_BYTES = 22 + 0xffff;
/** A directory bigger than this is read in part (about 10,000 files). */
export const DIRECTORY_MAX_BYTES = 1024 * 1024;

export interface ZipEntry {
  /** The path inside the archive ("docs/readme.txt"). */
  name: string;
  /** Its size unpacked, in bytes. */
  size: number;
  /** Its size packed in the archive. */
  packedSize: number;
  /** When it was last changed, as the archive records it (local time, 2-second steps). */
  modified: Date | null;
  directory: boolean;
  /** Its content is encrypted (a password-protected ZIP). */
  encrypted: boolean;
}

export interface ZipDirectory {
  /** How many entries the archive says it has. */
  count: number;
  /** Where its central directory starts, from the start of the file. */
  offset: number;
  /** How long the central directory is. */
  size: number;
}

const END = 0x06054b50;
const END64 = 0x06064b50;
const LOCATOR64 = 0x07064b50;
const ENTRY = 0x02014b50;

function u16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}

function u32(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

function u64(bytes: Uint8Array, at: number): number {
  return u32(bytes, at) + u32(bytes, at + 4) * 2 ** 32;
}

/**
 * Where the central directory is, from the archive's last bytes (`tail`,
 * starting at `tailStart` in the file), or null when they hold no end
 * record (not a ZIP, or one cut short).
 */
export function findDirectory(tail: Uint8Array, tailStart: number): ZipDirectory | null {
  for (let at = tail.length - 22; at >= 0; at--) {
    if (u32(tail, at) !== END) continue;
    // A record whose comment doesn't reach exactly to the end is a stray match.
    if (at + 22 + u16(tail, at + 20) !== tail.length) continue;
    let count = u16(tail, at + 10);
    let size = u32(tail, at + 12);
    let offset = u32(tail, at + 16);
    if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
      // ZIP64: the locator just before points to a bigger end record.
      const locator = at - 20;
      if (locator < 0 || u32(tail, locator) !== LOCATOR64) return null;
      const record = u64(tail, locator + 8) - tailStart;
      if (record < 0 || record + 56 > tail.length || u32(tail, record) !== END64) return null;
      count = u64(tail, record + 32);
      size = u64(tail, record + 40);
      offset = u64(tail, record + 48);
    }
    return { count, offset, size };
  }
  return null;
}

/** A DOS date and time (local), or null when it isn't one. */
function dosDate(date: number, time: number): Date | null {
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  if (!day || !month || month > 12) return null;
  return new Date(year, month - 1, day, (time >> 11) & 0x1f, (time >> 5) & 0x3f, (time & 0x1f) * 2);
}

function nameOf(bytes: Uint8Array, utf8: boolean): string {
  if (!utf8) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      // Older archivers wrote names in a DOS code page: Latin-1 is close enough to read.
      return new TextDecoder('latin1').decode(bytes);
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** The entries of a central directory (`bytes` starts at its first entry), at most `max`. */
export function readEntries(bytes: Uint8Array, max: number): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let at = 0;
  while (entries.length < max && at + 46 <= bytes.length && u32(bytes, at) === ENTRY) {
    const flags = u16(bytes, at + 8);
    const nameLength = u16(bytes, at + 28);
    const extraLength = u16(bytes, at + 30);
    const commentLength = u16(bytes, at + 32);
    const end = at + 46 + nameLength + extraLength + commentLength;
    if (end > bytes.length) break;
    let packedSize = u32(bytes, at + 20);
    let size = u32(bytes, at + 24);
    // ZIP64 sizes are in the extra field (id 1), in this order, when the 32-bit ones are full.
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = u16(bytes, extra);
      const length = u16(bytes, extra + 2);
      if (id === 1) {
        let field = extra + 4;
        if (size === 0xffffffff && field + 8 <= extra + 4 + length) {
          size = u64(bytes, field);
          field += 8;
        }
        if (packedSize === 0xffffffff && field + 8 <= extra + 4 + length)
          packedSize = u64(bytes, field);
        break;
      }
      extra += 4 + length;
    }
    const name = nameOf(bytes.subarray(at + 46, at + 46 + nameLength), (flags & 0x800) !== 0);
    entries.push({
      name,
      size,
      packedSize,
      modified: dosDate(u16(bytes, at + 14), u16(bytes, at + 12)),
      directory: name.endsWith('/'),
      encrypted: (flags & 1) !== 0,
    });
    at = end;
  }
  return entries;
}
