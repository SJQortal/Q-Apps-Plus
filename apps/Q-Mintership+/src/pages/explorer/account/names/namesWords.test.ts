import { describe, expect, it } from 'vitest';
import {
  autoNamesWords,
  cappedWords,
  encryptedWords,
  historyCoverage,
  nameDataParts,
  namesTitle,
  resourcesWords,
  searchedLine,
  searchMoreWords,
  serviceCountWords,
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
    expect(historyCoverage(100, true)).toBe('The newest 100 name transactions.');
    expect(historyCoverage(3, false)).toBe('3 name transactions.');
    expect(historyCoverage(1, false)).toBe('1 name transaction.');
  });
});

describe('QDN', () => {
  it('says which names were searched, out of how many', () => {
    expect(searchedLine(10, 88, false)).toBe('Searched 10 of 88 names.');
    expect(searchedLine(10, 500, true)).toBe('Searched 10 of 500+ names.');
    expect(searchedLine(3, 3, false)).toBe('Searched all 3 names.');
    expect(searchedLine(1, 1, false)).toBe('Searched its only name.');
    expect(autoNamesWords(true, 9)).toBe(
      'First the primary name and the 9 registered most recently.'
    );
    expect(autoNamesWords(false, 10)).toBe('First the 10 registered most recently.');
    expect(searchMoreWords(78)).toBe('Search 78 more names');
    expect(searchMoreWords(1)).toBe('Search 1 more name');
  });

  it('counts per service, marking counts a capped name may have cut short', () => {
    expect(serviceCountWords({ service: 'APP', count: 2, partial: false, encrypted: false })).toBe(
      'APP 2'
    );
    expect(
      serviceCountWords({ service: 'DOCUMENT', count: 100, partial: true, encrypted: false })
    ).toBe('DOCUMENT 100+');
    expect(resourcesWords(74, false)).toBe('74 resources');
    expect(resourcesWords(1, false)).toBe('1 resource');
    expect(resourcesWords(107, true)).toBe('107+ resources');
    expect(cappedWords([])).toBeNull();
    expect(cappedWords(['a'])).toBe('has more than 100 resources: its newest 100 are counted.');
    expect(cappedWords(['a', 'b'])).toBe(
      '2 names have more than 100 resources each: their newest 100 are counted.'
    );
    expect(encryptedWords(1)).toBe('1 encrypted resource is counted above and not listed.');
    expect(encryptedWords(53)).toBe('53 encrypted resources are counted above and not listed.');
  });
});
