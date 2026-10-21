import { describe, expect, it } from 'vitest';
import { jsonLines, jsonText } from './jsonLines';

describe('jsonLines', () => {
  it('splits each line into its indent, key, punctuation and a value of its kind', () => {
    const value = {
      type: 'PAYMENT',
      fee: '0.01000000',
      blockHeight: 2761653,
      approvalHeight: null,
      isText: true,
      payments: [{ amount: '1' }],
      empty: [],
    };
    const lines = jsonLines(value);
    expect(lines[0]).toEqual({ depth: 0, parts: [{ kind: 'punct', text: '{' }] });
    expect(lines[1]).toEqual({
      depth: 1,
      parts: [
        { kind: 'key', text: '"type"' },
        { kind: 'punct', text: ': ' },
        { kind: 'string', text: '"PAYMENT"' },
        { kind: 'punct', text: ',' },
      ],
    });
    const kinds = (i: number) => lines[i].parts.map((part) => part.kind);
    expect(kinds(3)).toEqual(['key', 'punct', 'number', 'punct']);
    expect(kinds(4)).toEqual(['key', 'punct', 'null', 'punct']);
    expect(kinds(5)).toEqual(['key', 'punct', 'boolean', 'punct']);
    expect(kinds(6)).toEqual(['key', 'punct', 'punct']);
    expect(lines[7]).toEqual({ depth: 2, parts: [{ kind: 'punct', text: '{' }] });
    expect(lines.at(-2)?.parts.at(-1)).toEqual({ kind: 'punct', text: '[]' });
    expect(lines.at(-1)).toEqual({ depth: 0, parts: [{ kind: 'punct', text: '}' }] });
  });

  it('keeps quotes and colons inside strings in the string', () => {
    const lines = jsonLines({ 'a": b': 'say "hi": ok', n: -1.5e-7 });
    expect(lines[1].parts[0]).toEqual({ kind: 'key', text: '"a\\": b"' });
    expect(lines[1].parts[2]).toEqual({ kind: 'string', text: '"say \\"hi\\": ok"' });
    expect(lines[2].parts[2]).toEqual({ kind: 'number', text: '-1.5e-7' });
  });

  it('gives back exactly JSON.stringify’s text', () => {
    const value = { a: [1, { b: 'x,y' }, []], c: {}, d: 'é ✓' };
    expect(jsonText(jsonLines(value))).toBe(JSON.stringify(value, null, 2));
  });
});
