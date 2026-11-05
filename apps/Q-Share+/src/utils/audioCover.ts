/**
 * Cover art embedded in an audio file: ID3v2 (MP3), the MP4 `covr` atom (M4A,
 * M4B) and FLAC's PICTURE block. Only the bytes needed are read, through a
 * ByteReader: a File's slices when publishing, Range requests to the node for
 * a track it holds. Only real JPEG, PNG, WebP and GIF data is accepted,
 * whatever the tag claims: the bytes come from someone else's file.
 */
export type ByteReader = (start: number, end: number) => Promise<Uint8Array>;

export interface EmbeddedCover {
  bytes: Uint8Array;
  type: string;
}

/** Tags and atoms read whole, at most; a tag this big is not a cover worth showing. */
export const COVER_READ_MAX_BYTES = 16 * 1024 * 1024;
const MAX_ATOMS = 64;
const FRONT_COVER = 3;

/** The image type of `bytes`, from their signature, or null. */
export function sniffImage(bytes: Uint8Array): string | null {
  const at = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (at(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0x52, 0x49, 0x46, 0x46) && text(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

function text(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end));
}

const u32 = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const synchsafe = (b: Uint8Array, at: number) => (b[at] << 21) | (b[at + 1] << 14) | (b[at + 2] << 7) | b[at + 3];

function image(bytes: Uint8Array): EmbeddedCover | null {
  const type = sniffImage(bytes);
  return type && bytes.length > 0 ? { bytes, type } : null;
}

/** ID3 unsynchronisation: FF 00 back to FF. */
function resync(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[n++] = bytes[i];
    if (bytes[i] === 0xff && bytes[i + 1] === 0) i++;
  }
  return out.subarray(0, n);
}

/** Past a text field ended by a NUL (two, aligned, in UTF-16). */
function afterText(b: Uint8Array, start: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    let i = start;
    while (i + 1 < b.length && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
    return i + 2;
  }
  const end = b.indexOf(0, start);
  return end < 0 ? b.length : end + 1;
}

/** One APIC (or ID3v2.2 PIC) frame's picture type and image. */
function parsePictureFrame(frame: Uint8Array, version: number): { kind: number; cover: EmbeddedCover | null } {
  const encoding = frame[0];
  // v2.2: a three-letter format; later: a MIME type ended by a NUL.
  const afterFormat = version === 2 ? 4 : afterText(frame, 1, 0);
  const kind = frame[afterFormat];
  const data = afterText(frame, afterFormat + 1, encoding);
  return { kind, cover: image(frame.subarray(data)) };
}

/** The front cover in a whole ID3v2 tag, else its first picture. */
export function parseId3(tag: Uint8Array): EmbeddedCover | null {
  const version = tag[3];
  const flags = tag[5];
  if (version < 2 || version > 4) return null;
  let b = tag.subarray(10, 10 + synchsafe(tag, 6));
  if (version < 4 && flags & 0x80) b = resync(b);
  let at = 0;
  if (version >= 3 && flags & 0x40) at = version === 3 ? u32(b, 0) + 4 : synchsafe(b, 0);
  const headerSize = version === 2 ? 6 : 10;
  let first: EmbeddedCover | null = null;
  while (at + headerSize <= b.length && b[at] !== 0) {
    const id = text(b, at, at + (version === 2 ? 3 : 4));
    const size =
      version === 2
        ? (b[at + 3] << 16) | (b[at + 4] << 8) | b[at + 5]
        : version === 3
          ? u32(b, at + 4)
          : synchsafe(b, at + 4);
    if (size <= 0) break;
    if (id === "APIC" || id === "PIC") {
      let frame = b.subarray(at + headerSize, at + headerSize + size);
      const format = version === 4 ? b[at + 9] : 0;
      // Compressed or encrypted pictures aren't worth undoing.
      if (!(version === 3 && b[at + 9] & 0xc0) && !(format & 0x0c)) {
        if (format & 0x01) frame = frame.subarray(4); // a data length indicator
        if (format & 0x02) frame = resync(frame);
        const { kind, cover } = parsePictureFrame(frame, version);
        if (cover && kind === FRONT_COVER) return cover;
        first ??= cover;
      }
    }
    at += headerSize + size;
  }
  return first;
}

/** One FLAC PICTURE block's picture type and image. */
function parseFlacPicture(block: Uint8Array): { kind: number; cover: EmbeddedCover | null } {
  const kind = u32(block, 0);
  let at = 4;
  at += 4 + u32(block, at); // MIME type
  at += 4 + u32(block, at); // description
  at += 16; // width, height, depth, colours
  const size = u32(block, at);
  return { kind, cover: image(block.subarray(at + 4, at + 4 + size)) };
}

async function readFlac(read: ByteReader): Promise<EmbeddedCover | null> {
  let at = 4;
  let first: EmbeddedCover | null = null;
  for (let n = 0; n < MAX_ATOMS; n++) {
    const header = await read(at, at + 4);
    if (header.length < 4) break;
    const size = (header[1] << 16) | (header[2] << 8) | header[3];
    if ((header[0] & 0x7f) === 6 && size <= COVER_READ_MAX_BYTES) {
      const { kind, cover } = parseFlacPicture(await read(at + 4, at + 4 + size));
      if (cover && kind === FRONT_COVER) return cover;
      first ??= cover;
    }
    if (header[0] & 0x80) break; // the last block
    at += 4 + size;
  }
  return first;
}

/** The atom `path` inside `b`, or null. `meta` has four extra bytes before its children. */
function findAtom(b: Uint8Array, path: string[]): Uint8Array | null {
  let at = 0;
  while (at + 8 <= b.length) {
    const size = u32(b, at);
    if (size < 8) return null;
    if (text(b, at + 4, at + 8) === path[0]) {
      const start = at + 8 + (path[0] === "meta" ? 4 : 0);
      const body = b.subarray(start, at + size);
      return path.length === 1 ? body : findAtom(body, path.slice(1));
    }
    at += size;
  }
  return null;
}

/** The `covr` image in a whole `moov` atom's contents. */
export function parseMoov(moov: Uint8Array): EmbeddedCover | null {
  const data = findAtom(moov, ["udta", "meta", "ilst", "covr", "data"]);
  // Eight bytes of type and locale before the image.
  return data ? image(data.subarray(8)) : null;
}

async function readMp4(read: ByteReader): Promise<EmbeddedCover | null> {
  let at = 0;
  for (let n = 0; n < MAX_ATOMS; n++) {
    const header = await read(at, at + 16);
    if (header.length < 8) return null;
    let size = u32(header, 0);
    let headerSize = 8;
    if (size === 1) {
      // A 64-bit size; audio this long still fits a double.
      size = u32(header, 8) * 2 ** 32 + u32(header, 12);
      headerSize = 16;
    }
    if (text(header, 4, 8) === "moov") {
      const end = size === 0 ? at + COVER_READ_MAX_BYTES : at + Math.min(size, COVER_READ_MAX_BYTES);
      return parseMoov(await read(at + headerSize, end));
    }
    if (size < headerSize) return null; // size 0 is "to the end of the file": nothing after it
    at += size;
  }
  return null;
}

/** The cover embedded in an audio file, or null when it has none. Rejects when `read` does. */
export async function readEmbeddedCover(read: ByteReader): Promise<EmbeddedCover | null> {
  const head = await read(0, 10);
  if (text(head, 0, 3) === "ID3") {
    const total = 10 + synchsafe(head, 6);
    return total > COVER_READ_MAX_BYTES ? null : parseId3(await read(0, total));
  }
  if (text(head, 0, 4) === "fLaC") return readFlac(read);
  if (text(head, 4, 8) === "ftyp") return readMp4(read);
  return null;
}

/** A local file's bytes. */
export const blobReader =
  (blob: Blob): ByteReader =>
  async (start, end) =>
    new Uint8Array(await blob.slice(start, end).arrayBuffer());

/** A file's bytes from the node by Range; `async=true`, so a file it lacks can't hold a node thread. */
export const nodeReader =
  (url: string): ByteReader =>
  async (start, end) => {
    const response = await fetch(`${url}?async=true`, { headers: { Range: `bytes=${start}-${end - 1}` } });
    if (response.status === 416) return new Uint8Array(0);
    if (!response.ok) throw new Error(`The node answered ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // A node that ignored the Range sent the whole file.
    return response.status === 206 ? bytes : bytes.subarray(start, end);
  };
