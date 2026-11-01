import { describe, expect, it } from "vitest";
import { fetchCallsMatching, mockFetch } from "../test/setup";
import { type ByteReader, nodeReader, readEmbeddedCover, sniffImage } from "./audioCover";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4];
const PNG = [0x89, 0x50, 0x4e, 0x47, 9, 9, 9];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const safe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];

/** Counts what is read, like Range requests would. */
function reader(bytes: number[]) {
  const data = new Uint8Array(bytes);
  const reads: Array<[number, number]> = [];
  const read: ByteReader = async (start, end) => {
    reads.push([start, end]);
    return data.subarray(start, end);
  };
  return { read, reads };
}

function apic(image: number[], kind = 3, encoding = 0, description: number[] = [0], version = 3) {
  const body = [encoding, ...ascii("image/jpeg"), 0, kind, ...description, ...image];
  return [...ascii("APIC"), ...(version === 4 ? safe(body.length) : be32(body.length)), 0, 0, ...body];
}
const id3 = (frames: number[], version = 3, flags = 0) => [...ascii("ID3"), version, 0, flags, ...safe(frames.length), ...frames];
const title = [...ascii("TIT2"), ...be32(3), 0, 0, 0, ...ascii("Hi")];

const atom = (type: string, body: number[]) => [...be32(body.length + 8), ...ascii(type), ...body];
const moov = (image: number[]) =>
  atom(
    "moov",
    atom("udta", atom("meta", [0, 0, 0, 0, ...atom("ilst", atom("covr", atom("data", [0, 0, 0, 13, 0, 0, 0, 0, ...image])))]))
  );

const flacPicture = (image: number[], kind = 3) => {
  const mime = ascii("image/jpeg");
  return [...be32(kind), ...be32(mime.length), ...mime, ...be32(0), ...be32(0), ...be32(0), ...be32(0), ...be32(0), ...be32(image.length), ...image];
};
const flacBlock = (type: number, body: number[], last = false) => [(last ? 0x80 : 0) | type, 0, (body.length >> 8) & 255, body.length & 255, ...body];

describe("cover art embedded in audio", () => {
  it("finds it in ID3v2.3 and v2.4, past other frames, preferring the front cover", async () => {
    const v3 = id3([...title, ...apic(PNG, 4), ...apic(JPEG, 3), ...new Array(20).fill(0)]);
    expect(await readEmbeddedCover(reader(v3).read)).toEqual({ bytes: new Uint8Array(JPEG), type: "image/jpeg" });
    const v4 = id3(apic(JPEG, 0, 0, [0], 4), 4);
    expect((await readEmbeddedCover(reader(v4).read))?.type).toBe("image/jpeg");
  });

  it("reads a UTF-16 description and ID3v2.2's PIC", async () => {
    const utf16 = id3(apic(JPEG, 3, 1, [0xff, 0xfe, 0x41, 0, 0, 0]));
    expect((await readEmbeddedCover(reader(utf16).read))?.bytes).toEqual(new Uint8Array(JPEG));
    const body = [0, ...ascii("JPG"), 3, 0, ...JPEG];
    const v2 = id3([...ascii("PIC"), 0, 0, body.length, ...body], 2);
    expect((await readEmbeddedCover(reader(v2).read))?.type).toBe("image/jpeg");
  });

  it("undoes unsynchronisation", async () => {
    const synced = id3(apic([0xff, 0x00, 0xd8, 0xff, 0xe0, 5]), 3, 0x80);
    expect((await readEmbeddedCover(reader(synced).read))?.bytes).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 5]));
  });

  it("walks an M4A to its moov, even after the audio, reading only headers on the way", async () => {
    const mdat = atom("mdat", new Array(5000).fill(7));
    const { read, reads } = reader([...atom("ftyp", ascii("M4A ")), ...mdat, ...moov(PNG)]);
    expect((await readEmbeddedCover(read))?.type).toBe("image/png");
    const bytesRead = reads.slice(0, -1).reduce((sum, [s, e]) => sum + e - s, 0);
    expect(bytesRead).toBeLessThan(100);
  });

  it("finds it in a FLAC's PICTURE block", async () => {
    const flac = [...ascii("fLaC"), ...flacBlock(0, new Array(34).fill(0)), ...flacBlock(6, flacPicture(JPEG), true)];
    expect((await readEmbeddedCover(reader(flac).read))?.bytes).toEqual(new Uint8Array(JPEG));
  });

  it("says none for files without art, other formats and tags claiming an image that isn't one", async () => {
    expect(await readEmbeddedCover(reader(id3(title)).read)).toBeNull();
    expect(await readEmbeddedCover(reader(ascii("OggS and more bytes")).read)).toBeNull();
    expect(await readEmbeddedCover(reader([...atom("ftyp", ascii("M4A ")), ...atom("moov", [])]).read)).toBeNull();
    const svg = ascii('<svg onload="x()">');
    expect(await readEmbeddedCover(reader(id3(apic(svg))).read)).toBeNull();
    expect(sniffImage(new Uint8Array(svg))).toBeNull();
  });

  it("survives a damaged tag without running on", async () => {
    const broken = id3([...ascii("APIC"), ...be32(0xfffffff0), 0, 0, 0]);
    await expect(readEmbeddedCover(reader(broken).read)).resolves.toBeNull();
  });

  it("asks the node by Range, without holding it", async () => {
    mockFetch("/arbitrary/FILE/", "abcdef");
    const bytes = await nodeReader("/arbitrary/FILE/a/b")(1, 3);
    expect(fetchCallsMatching("/arbitrary/FILE/a/b")[0]).toBe("/arbitrary/FILE/a/b?async=true");
    // The mock answers 200 with everything: the wanted part is cut out.
    expect(new TextDecoder().decode(bytes)).toBe("bc");
  });
});
