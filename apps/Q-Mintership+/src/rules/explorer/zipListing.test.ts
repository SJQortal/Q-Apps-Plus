import { describe, expect, it } from 'vitest';
import { findDirectory, readEntries } from './zipListing';

/**
 * A ZIP made with Python's zipfile: a folder "docs/", "docs/readme.txt"
 * (600 bytes, deflated) and "café.json" (stored, a UTF-8 name), with an
 * archive comment.
 */
const ZIP =
  'UEsDBBQAAAAAAMBLUV0AAAAAAAAAAAAAAAAFAAAAZG9jcy9QSwMEFAAAAAgAxUtRXfMxog0OAAAAWAIAAA8AAABkb2NzL3JlYWRtZS50eHTLSM3JyVfIGCVHSaqSAFBLAwQUAAAIAACDGCJar6wbVgcAAAAHAAAACgAAAGNhZsOpLmpzb257ImEiOjF9UEsBAhQDFAAAAAAAwEtRXQAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAIABAAAAAGRvY3MvUEsBAhQDFAAAAAgAxUtRXfMxog0OAAAAWAIAAA8AAAAAAAAAAAAAAIABIwAAAGRvY3MvcmVhZG1lLnR4dFBLAQIUAxQAAAgAAIMYIlqvrBtWBwAAAAcAAAAKAAAAAAAAAAAAAACAAV4AAABjYWbDqS5qc29uUEsFBgAAAAADAAMAqAAAAI0AAAAJAGEgY29tbWVudA==';

function bytesOf(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

describe('the files inside a ZIP', () => {
  const zip = bytesOf(ZIP);

  it('finds the central directory from the last bytes, past a comment', () => {
    // The whole file as the tail, or only its last 40 bytes: the end record is enough.
    expect(findDirectory(zip, 0)).toEqual({ count: 3, offset: 141, size: 168 });
    const start = zip.length - 40;
    expect(findDirectory(zip.subarray(start), start)).toEqual({ count: 3, offset: 141, size: 168 });
    // Cut inside the end record: not found.
    expect(findDirectory(zip.subarray(zip.length - 25), zip.length - 25)).toBeNull();
    expect(findDirectory(new TextEncoder().encode('not a zip at all, no'), 0)).toBeNull();
  });

  it('lists each entry with its sizes, date and kind', () => {
    const directory = findDirectory(zip, 0)!;
    const entries = readEntries(zip.subarray(directory.offset), 100);
    expect(entries.map((entry) => entry.name)).toEqual(['docs/', 'docs/readme.txt', 'café.json']);
    expect(entries[0].directory).toBe(true);
    expect(entries[1]).toMatchObject({ size: 600, packedSize: 14, directory: false });
    expect(entries[1].modified).toEqual(new Date(2026, 9, 17, 9, 30, 10));
    expect(entries[2]).toMatchObject({ size: 7, packedSize: 7, encrypted: false });
    expect(readEntries(zip.subarray(directory.offset), 2)).toHaveLength(2);
  });

  it('reads a ZIP64 end record through its locator', () => {
    // One entry ("a.txt", 5 bytes), then a ZIP64 end record, its locator and an end record full of 0xFF.
    const out: number[] = [];
    const u16 = (n: number) => out.push(n & 0xff, (n >> 8) & 0xff);
    const u32 = (n: number) => out.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24);
    const u64 = (n: number) => {
      u32(n % 2 ** 32);
      u32(Math.floor(n / 2 ** 32));
    };
    const name = [...'a.txt'].map((c) => c.charCodeAt(0));
    // Central directory entry at offset 0.
    u32(0x02014b50);
    u16(45);
    u16(45);
    u16(0x800);
    u16(0);
    u16(0);
    u16(0x5821);
    u32(0);
    u32(5);
    u32(5);
    u16(name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(0);
    out.push(...name);
    const directorySize = out.length;
    const end64 = out.length;
    u32(0x06064b50);
    u64(44);
    u16(45);
    u16(45);
    u32(0);
    u32(0);
    u64(1);
    u64(1);
    u64(directorySize);
    u64(0);
    u32(0x07064b50);
    u32(0);
    u64(end64);
    u32(1);
    u32(0x06054b50);
    u16(0);
    u16(0);
    u16(0xffff);
    u16(0xffff);
    u32(0xffffffff);
    u32(0xffffffff);
    u16(0);
    const archive = Uint8Array.from(out);
    expect(findDirectory(archive, 0)).toEqual({ count: 1, offset: 0, size: directorySize });
    expect(readEntries(archive, 10)).toEqual([
      expect.objectContaining({ name: 'a.txt', size: 5, packedSize: 5 }),
    ]);
  });
});
