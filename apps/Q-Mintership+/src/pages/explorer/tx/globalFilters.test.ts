import { describe, expect, it } from 'vitest';
import {
  blocksParam,
  filteredCoverage,
  globalCoverage,
  globalEmpty,
  globalOlderLoaded,
  lookedFurtherWords,
  orderParam,
  parseBlocksParam,
  parseOrderParam,
  spanParam,
  spanWords,
} from './globalFilters';

const range = { start: 2_756_501, limit: 1000 };

describe('what Transactions on Qortal says it searched', () => {
  it('says All is every type except messages', () => {
    expect(globalCoverage('all', 37, true, range)).toBe(
      'All 37 transactions of every type except messages in blocks 2,756,501–2,757,500.'
    );
    expect(globalCoverage('all', 40, false, range)).toBe(
      'The newest 40 transactions of every type except messages in blocks 2,756,501–2,757,500.'
    );
    expect(globalCoverage('all', 1, true, range)).toBe(
      'The only transaction of any type except messages in blocks 2,756,501–2,757,500.'
    );
    expect(globalEmpty('all', range)).toBe(
      'No transactions of any type except messages in blocks 2,756,501–2,757,500.'
    );
    expect(globalOlderLoaded('all', 20)).toBe('20 older transactions loaded');
  });

  it('names a family or a type as before', () => {
    expect(globalCoverage('payments', 7, true, range)).toBe(
      'All 7 payments in blocks 2,756,501–2,757,500.'
    );
    expect(globalEmpty('payments', range)).toBe('No payments in blocks 2,756,501–2,757,500.');
  });
});

describe('the blocks, the order and narrowing in the URL and in words', () => {
  it('reads and writes how many blocks from a block, 10,000 left out', () => {
    expect(parseBlocksParam('from-2401221', '1')).toEqual({
      kind: 'from',
      start: 2_401_221,
      span: 1,
    });
    expect(parseBlocksParam('from-2401221', '10000')).toEqual({ kind: 'from', start: 2_401_221 });
    expect(parseBlocksParam('from-2401221', '7')).toEqual({ kind: 'from', start: 2_401_221 });
    // A span alone is nothing.
    expect(parseBlocksParam(null, '1')).toEqual({ kind: 'latest', blocks: 1000 });
    const one = { kind: 'from', start: 5, span: 1 } as const;
    expect([blocksParam(one), spanParam(one)]).toEqual(['from-5', '1']);
    expect(spanParam({ kind: 'from', start: 5 })).toBeNull();
    expect(spanParam({ kind: 'latest', blocks: 10000 })).toBeNull();
    expect(spanWords(1)).toBe('Just this block');
    expect(spanWords(1000)).toBe('1,000 blocks');
  });

  it('reads oldest first, newest otherwise', () => {
    expect(parseOrderParam('oldest')).toBe('oldest');
    expect(parseOrderParam('sideways')).toBe('newest');
    expect(orderParam('newest')).toBeNull();
    expect(globalCoverage('payments', 40, false, range, 'oldest')).toBe(
      'The oldest 40 payments in blocks 2,756,501–2,757,500.'
    );
    expect(globalOlderLoaded('payments', 20, 'oldest')).toBe('20 newer payments loaded');
  });

  it('says how many of the rows read match', () => {
    const all = globalCoverage('payments', 40, false, range);
    expect(filteredCoverage(3, all)).toBe(
      'Showing 3 that match, out of the newest 40 payments in blocks 2,756,501–2,757,500.'
    );
    expect(filteredCoverage(1, 'All 7 payments in block 5.')).toBe(
      'Showing 1 that matches, out of all 7 payments in block 5.'
    );
    expect(filteredCoverage(0, 'All 7 payments in block 5.')).toBe(
      'None match, out of all 7 payments in block 5.'
    );
    expect(lookedFurtherWords(60, 2, 'newest')).toBe('Read 60 older transactions: 2 match');
    expect(lookedFurtherWords(200, 0, 'oldest')).toBe('Read 200 newer transactions: none match');
  });
});
