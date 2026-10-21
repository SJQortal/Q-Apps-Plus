import { describe, expect, it } from 'vitest';
import { guessDelimiter, hexRows, parseTable } from './fileText';

describe('a CSV or TSV file as a table', () => {
  it('guesses the delimiter from the first line', () => {
    expect(guessDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(guessDelimiter('a\tb\tc\n1,2,3')).toBe('\t');
    expect(guessDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(guessDelimiter('just one cell')).toBe(',');
  });

  it('reads quoted cells with delimiters, line breaks and doubled quotes', () => {
    const table = parseTable('﻿name,note\r\n"Bob, Jr.","said ""hi""\nthen left"\nAnn,ok\n', {
      maxRows: 10,
    });
    expect(table.rows).toEqual([
      ['name', 'note'],
      ['Bob, Jr.', 'said "hi"\nthen left'],
      ['Ann', 'ok'],
    ]);
    expect(table.truncated).toBe(false);
  });

  it('stops at the row cap, and drops a last line cut by a partial read', () => {
    expect(parseTable('a\nb\nc\nd', { maxRows: 2 })).toMatchObject({
      rows: [['a'], ['b']],
      truncated: true,
    });
    expect(parseTable('a,b\n1,2\n3,', { maxRows: 10, partial: true })).toMatchObject({
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
      truncated: true,
    });
    expect(parseTable('a,b\n1,2', { maxRows: 10 }).rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('binary data as hex rows', () => {
  it('shows 16 bytes a row with their offset and printable characters', () => {
    const bytes = new Uint8Array(20);
    bytes.set(new TextEncoder().encode('%PDF-1.7'), 0);
    bytes[8] = 0x0a;
    const rows = hexRows(bytes, 0x100);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      offset: '00000100',
      hex: '25 50 44 46 2d 31 2e 37  0a 00 00 00 00 00 00 00',
      text: '%PDF-1.7........',
    });
    expect(rows[1]).toEqual({ offset: '00000110', hex: '00 00 00 00', text: '....' });
  });
});
