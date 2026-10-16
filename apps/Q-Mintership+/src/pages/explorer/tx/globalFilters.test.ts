import { describe, expect, it } from 'vitest';
import { globalCoverage, globalEmpty, globalOlderLoaded } from './globalFilters';

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
