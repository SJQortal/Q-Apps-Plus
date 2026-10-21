import { describe, expect, it } from "vitest";
import { buildZip, crc32, dosDateTime, uniqueZipNames } from "./zip";

const bytes = (s: string) => new TextEncoder().encode(s);
const le32 = (a: Uint8Array, o: number) => new DataView(a.buffer, a.byteOffset).getUint32(o, true);
const le16 = (a: Uint8Array, o: number) => new DataView(a.buffer, a.byteOffset).getUint16(o, true);

describe("zip writer", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(bytes("hello")).toString(16)).toBe("3610a686");
    expect(crc32(bytes("123456789")).toString(16)).toBe("cbf43926");
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it("makes names unique and strips path tricks", () => {
    expect(uniqueZipNames(["a.txt", "A.TXT", "a.txt", "../../etc/passwd", "/x/y.png", "", "noext", "noext"])).toEqual([
      "a.txt",
      "A (2).TXT",
      "a (3).txt",
      "etc/passwd",
      "x/y.png",
      "file",
      "noext",
      "noext (2)",
    ]);
  });

  it("writes local headers, a central directory and an end record that agree", () => {
    const a = bytes("hello");
    const b = bytes("wörld!");
    const zip = buildZip([
      { name: "one.txt", data: a, modified: Date.UTC(2026, 8, 30, 12, 0, 0) },
      { name: "två.txt", data: b, modified: Date.UTC(2026, 8, 30, 12, 0, 0) },
    ]);
    const n1 = bytes("one.txt").length;
    const n2 = bytes("två.txt").length;
    // local header 1
    expect(le32(zip, 0).toString(16)).toBe("4034b50");
    expect(le16(zip, 6)).toBe(0x0800); // UTF-8 flag
    expect(le16(zip, 8)).toBe(0); // stored
    expect(le32(zip, 14)).toBe(crc32(a));
    expect(le32(zip, 18)).toBe(a.length);
    expect(le16(zip, 26)).toBe(n1);
    expect(new TextDecoder().decode(zip.slice(30, 30 + n1))).toBe("one.txt");
    expect(new TextDecoder().decode(zip.slice(30 + n1, 30 + n1 + a.length))).toBe("hello");
    // local header 2 follows immediately
    const off2 = 30 + n1 + a.length;
    expect(le32(zip, off2).toString(16)).toBe("4034b50");
    expect(le32(zip, off2 + 14)).toBe(crc32(b));
    expect(new TextDecoder().decode(zip.slice(off2 + 30, off2 + 30 + n2))).toBe("två.txt");
    // central directory
    const cdStart = off2 + 30 + n2 + b.length;
    expect(le32(zip, cdStart).toString(16)).toBe("2014b50");
    expect(le32(zip, cdStart + 42)).toBe(0); // offset of entry 1
    const cd2 = cdStart + 46 + n1;
    expect(le32(zip, cd2).toString(16)).toBe("2014b50");
    expect(le32(zip, cd2 + 42)).toBe(off2);
    // end of central directory
    const endStart = zip.length - 22;
    expect(le32(zip, endStart).toString(16)).toBe("6054b50");
    expect(le16(zip, endStart + 8)).toBe(2);
    expect(le16(zip, endStart + 10)).toBe(2);
    expect(le32(zip, endStart + 12)).toBe(46 + n1 + 46 + n2);
    expect(le32(zip, endStart + 16)).toBe(cdStart);
  });

  it("encodes DOS date and time in 2-second steps and clamps the year", () => {
    const { date, time } = dosDateTime(new Date(2026, 8, 30, 13, 45, 31).getTime());
    expect(date >> 9).toBe(46); // 2026 - 1980
    expect((date >> 5) & 0xf).toBe(9);
    expect(date & 0x1f).toBe(30);
    expect(time >> 11).toBe(13);
    expect((time >> 5) & 0x3f).toBe(45);
    expect(time & 0x1f).toBe(15);
    expect(dosDateTime(new Date(1970, 0, 1).getTime()).date >> 9).toBe(0);
  });

  it("refuses more than the classic format can hold", () => {
    const entries = Array.from({ length: 0x10000 }, (_, i) => ({ name: `f${i}`, data: new Uint8Array(0) }));
    expect(() => buildZip(entries)).toThrow();
  });
});
