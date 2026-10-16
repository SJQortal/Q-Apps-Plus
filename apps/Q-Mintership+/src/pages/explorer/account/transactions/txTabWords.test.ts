import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, type TxFilters } from '../../../../rules/explorer/accountTxFilters';
import { formatDate } from '../../../../utils/format';
import { dayStart } from '../../../../rules/explorer/accountTxFilters';
import {
  coverageLine,
  emptyLine,
  loadMoreLabel,
  noNameLine,
  olderLoadedLine,
  scopePhrase,
} from './txTabWords';

const f = (over: Partial<TxFilters>): TxFilters => ({ ...DEFAULT_FILTERS, ...over });

describe('the Transactions tab’s words', () => {
  it('says what narrows the list', () => {
    expect(scopePhrase(DEFAULT_FILTERS)).toBe('');
    expect(scopePhrase(f({ when: '7d' }))).toBe(' in the last 7 days');
    expect(
      scopePhrase(f({ name: 'Q-Maps', when: 'dates', from: '2026-09-01', to: '2026-09-30' }))
    ).toBe(
      ` about “Q-Maps” between ${formatDate(dayStart('2026-09-01'))} and ${formatDate(dayStart('2026-09-30'))}`
    );
    expect(scopePhrase(f({ when: 'blocks', from: '2700000' }))).toBe(' from block 2,700,000 on');
    expect(scopePhrase(f({ when: 'blocks', to: '2700000' }))).toBe(' up to block 2,700,000');
  });

  it('says what is on screen, out of what, in the order picked', () => {
    expect(coverageLine(DEFAULT_FILTERS, 50, 150, 150, false)).toBe(
      "The newest 50 of this account's transactions."
    );
    expect(coverageLine(f({ kind: 'payments', order: 'oldest' }), 50, 87, 87, true)).toBe(
      "The oldest 50 of this account's 87 payments."
    );
    expect(coverageLine(f({ when: '30d' }), 3, 3, 3, true)).toBe(
      "All 3 of this account's transactions in the last 30 days."
    );
    expect(coverageLine(f({ order: 'amount' }), 50, 100, 100, false)).toBe(
      "Biggest amounts first, among the 100 read so far. The newest 50 of this account's transactions."
    );
    expect(coverageLine(f({ name: 'Q-Maps' }), 0, 0, 100, false)).toBe(
      'None yet about “Q-Maps” in its newest 100 name and QDN transactions. Load older looks further.'
    );
    expect(coverageLine(f({ kind: 'qdn', name: 'Q-Maps' }), 4, 4, 300, false)).toBe(
      '4 about “Q-Maps” in its newest 300 QDN publishes. Load older looks further.'
    );
  });

  it('says when nothing matches, and why a kind can’t', () => {
    expect(emptyLine(f({ kind: 'names' }))).toBe("No name transactions in this account's history.");
    expect(emptyLine(f({ kind: 'names', type: 'BUY_NAME', when: '24h' }))).toBe(
      'This account has no “Name purchase” transactions in the last 24 hours.'
    );
    expect(noNameLine(f({ kind: 'payments', name: 'Q-Maps' }))).toBe(
      'Payments are never about a name. Pick All, Names or QDN data to see transactions about “Q-Maps”.'
    );
  });

  it('names the paging button and what it brought by the order', () => {
    expect(loadMoreLabel(DEFAULT_FILTERS)).toBe('Load older');
    expect(loadMoreLabel(f({ order: 'oldest' }))).toBe('Load newer');
    expect(olderLoadedLine(DEFAULT_FILTERS, 50, false)).toBe('50 older transactions loaded');
    expect(olderLoadedLine(f({ order: 'oldest' }), 1, false)).toBe('1 newer transaction loaded');
    expect(olderLoadedLine(f({ name: 'Q-Maps' }), 0, false)).toBe(
      'None about “Q-Maps” in the next 100 read'
    );
    expect(olderLoadedLine(DEFAULT_FILTERS, 0, true)).toBe('No older transactions');
  });
});
