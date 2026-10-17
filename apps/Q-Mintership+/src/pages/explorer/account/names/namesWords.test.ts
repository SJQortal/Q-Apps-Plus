import { describe, expect, it } from 'vitest';
import {
  historyCoverage,
  nameDataParts,
  namesTitle,
  showMoreWords,
  truncatedLine,
} from './namesWords';

const OWNER = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const DAY = Date.UTC(2024, 9, 12);

describe('the names list', () => {
  it('titles the list with its count, saying when Core’s list was cut', () => {
    expect(namesTitle(undefined)).toBe('Names');
    expect(namesTitle({ names: ['a', 'b'], truncated: false })).toBe('Names (2)');
    expect(namesTitle({ names: Array(500).fill('n'), truncated: true })).toBe('Names (500+)');
    expect(truncatedLine(500)).toBe('500+ names; the first 500 are listed.');
    expect(showMoreWords(68, 20)).toBe('Show 20 more');
    expect(showMoreWords(8, 20)).toBe('Show 8 more');
  });

  it('reads a name’s own record in short parts', () => {
    expect(
      nameDataParts({
        name: 'Maps',
        owner: OWNER,
        registered: DAY,
        updated: DAY + 86_400_000,
        isForSale: true,
        salePrice: '5.00000000',
      })
    ).toEqual(['Registered 12 Oct 2024', 'Updated 13 Oct 2024', 'For sale at 5 QORT']);
    expect(
      nameDataParts({ name: 'Maps', owner: OWNER, registered: DAY, isForSale: false })
    ).toEqual(['Registered 12 Oct 2024']);
  });
});

describe('the name history', () => {
  it('says how much of it was read', () => {
    expect(historyCoverage(100, true)).toBe(
      "Each name's history comes from its newest 100 name transactions. Older ones aren't read yet."
    );
    expect(historyCoverage(100, true, 100, 19)).toBe(
      "Each name's history comes from its newest 100 name transactions. 19 of the names below have none in them. Older ones aren't read yet."
    );
    expect(historyCoverage(1000, true, 1000, 1)).toBe(
      "Each name's history comes from its newest 1,000 name transactions. 1 of the names below has none in them. Older ones aren't read yet."
    );
    expect(historyCoverage(3, false)).toBe('3 name transactions.');
    expect(historyCoverage(1, false)).toBe('1 name transaction.');
  });
});
