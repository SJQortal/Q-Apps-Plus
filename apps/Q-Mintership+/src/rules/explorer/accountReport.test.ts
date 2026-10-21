import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import {
  accountReportMarkdown,
  EVIDENCE_MAX,
  historyWords,
  reportFilename,
  utc,
  type AccountReportData,
} from './accountReport';
import type { Finding } from './findings';

const A = `Q${'a'.repeat(33)}`;
const B = `Q${'b'.repeat(33)}`;
const MADE = Date.UTC(2026, 9, 21, 14, 3);

function tx(i: number, extra: Partial<TxRow> = {}): TxRow {
  return {
    type: 'PAYMENT',
    signature: `sig${i}`.padEnd(88, 'x'),
    timestamp: Date.UTC(2026, 0, 1) + i * 60_000,
    blockHeight: 2_000_000 + i,
    creatorAddress: B,
    ...extra,
  } as TxRow;
}

function data(over: Partial<AccountReportData> = {}): AccountReportData {
  return {
    address: A,
    madeAt: MADE,
    tip: { height: 2_767_000, timestamp: MADE },
    app: {
      name: 'Q-Mintership+',
      version: '1.0.1',
      link: `qortal://APP/Q-Mintership+/explorer/account/${A}/connections`,
    },
    neutralLine: 'Public chain and QDN facts.',
    account: {
      address: A,
      publicKey: 'PK',
      level: 5,
      blocksMinted: 1_000,
      blocksMintedAdjustment: 0,
      blocksMintedPenalty: 0,
    },
    balance: 12_345_000_000n,
    primaryName: 'Ada | Approved',
    names: { names: ['Ada | Approved', 'second'], truncated: false },
    groups: [{ groupId: 694, groupName: 'MINTER', isAdmin: true }],
    minting: [],
    firstSeen: null,
    history: { rows: [tx(1), tx(2, { type: 'REWARD_SHARE' })], done: true },
    findings: [],
    nothingFound: 'Also checked, nothing found: level moves.',
    sponsorReport: null,
    sameSponsor: null,
    exchanges: null,
    qort: { minted: 50_000_000_000n, received: 100_000_000n, sent: 0n, bought: 0n, sold: 0n },
    coverage: ['Read: every QORT payment it sent (none).'],
    failed: [],
    nameOf: (address) => (address === B ? 'Bob' : null),
    ...over,
  };
}

describe('the account report (Simon, 2026-10-21)', () => {
  it('has the same sections every time, in order', () => {
    const text = accountReportMarkdown(data());
    const headings = text.split('\n').filter((line) => /^#{1,2} /.test(line));
    expect(headings).toEqual([
      '# Account report: Ada | Approved',
      '## Account',
      '## QORT totals',
      '## Activity by type',
      '## Connections',
      '## Core’s sponsorship report',
      '## What was read',
      '## Transactions behind the connections',
    ]);
  });

  it('writes facts as tables, escaping what would break them, times in UTC', () => {
    const text = accountReportMarkdown(data());
    expect(text).toContain('| Primary name | Ada \\| Approved |');
    expect(text).toContain('| Made | 2026-10-21 14:03 UTC, at block 2,767,000 |');
    expect(text).toContain('| Balance | 123.45 QORT |');
    expect(text).toContain('| MINTER group (694) | member, Minter Admin |');
    expect(text).toContain('| Minting now | no |');
    expect(text).toContain('| Minted | 500 QORT |');
    expect(text).toContain('> Public chain and QDN facts.');
    expect(text).toContain('| Payment | 1 | 2026-01-01 | 2026-01-01 |');
  });

  it('says plainly when its whole history wasn’t read, and leaves the totals out', () => {
    const text = accountReportMarkdown(data({ history: { rows: [tx(1)], done: false } }));
    expect(text).toContain('only its newest 1 transactions (not its whole history)');
    expect(text).toContain('read all of it first to have them');
    expect(text).not.toContain('| Minted |');
    expect(historyWords(null)).toBe('its history couldn’t be read');
  });

  it('lists each connection with its block, date and whole signature, and payments as tables', () => {
    const paid: Finding = {
      key: `paidBy:${B}`,
      kind: 'paidBy',
      other: B,
      parts: [
        { kind: 'text', text: 'Received 5 QORT from ' },
        { kind: 'account', address: B },
      ],
      height: 2_000_002,
      firstHeight: 2_000_001,
      timestamp: tx(2).timestamp,
      firstTimestamp: tx(1).timestamp,
      signature: tx(2).signature,
      count: 2,
      evidence: [tx(2), tx(1)],
      evidenceWords: '2 payments',
      qort: 500_000_000n,
      assets: [],
    };
    const moved: Finding = {
      key: 'level:x',
      kind: 'levelMove',
      other: B,
      parts: [
        { kind: 'text', text: 'Got its minting level from ' },
        { kind: 'account', address: B },
      ],
      height: 1_500_000,
      timestamp: Date.UTC(2023, 1, 2),
      signature: tx(9).signature,
      evidence: [tx(9)],
      evidenceWords: '1 transaction',
    };
    const text = accountReportMarkdown(data({ findings: [moved, paid] }));
    expect(text).toContain(
      `- Got its minting level from Bob (Qbbbbb…bbbb) (block 1,500,000, 2023-02-02, \`${tx(9).signature}\`)`
    );
    expect(text).toContain('### Payments received from');
    expect(text).toContain(`| \`${B}\` | Bob | 2 | 5 |  | 2026-01-01 | 2026-01-01 |`);
    expect(text).toContain(`| \`${tx(9).signature}\` |`);
    expect(text).toContain('Also checked, nothing found: level moves.');
  });

  it('names what couldn’t be read, never as none', () => {
    const text = accountReportMarkdown(
      data({ failed: ['Core’s sponsorship report', 'its asset trades'], sponsorReport: null })
    );
    expect(text).toContain('Core’s sponsorship report couldn’t be read.');
    expect(text).toContain('- Couldn’t be read: Core’s sponsorship report, its asset trades.');
  });

  it('lists at most EVIDENCE_MAX transactions behind the connections, and says so', () => {
    const many = Array.from({ length: EVIDENCE_MAX + 5 }, (_, i) => tx(i));
    const finding: Finding = {
      key: `paidBy:${B}`,
      kind: 'paidBy',
      other: B,
      parts: [{ kind: 'text', text: 'Received' }],
      height: 1,
      timestamp: 1,
      signature: many[0].signature,
      evidence: many,
      evidenceWords: '',
    };
    const text = accountReportMarkdown(data({ findings: [finding] }));
    expect(text).toContain(
      `The newest ${EVIDENCE_MAX.toLocaleString('en-US')} of ${(EVIDENCE_MAX + 5).toLocaleString('en-US')} are listed.`
    );
  });

  it('an address Core never saw', () => {
    const text = accountReportMarkdown(
      data({ account: 'unused', history: { rows: [], done: true } })
    );
    expect(text).toContain('Core has never seen this address: no transaction ever involved it.');
  });

  it('a file name of letters, digits and dashes, with the day', () => {
    expect(reportFilename({ address: A, primaryName: 'Ünïcode Ñame+1', madeAt: MADE })).toBe(
      'account-report-Unicode-Name-1-2026-10-21.md'
    );
    expect(reportFilename({ address: A, primaryName: null, madeAt: MADE })).toBe(
      `account-report-${A}-2026-10-21.md`
    );
    expect(utc(MADE)).toBe('2026-10-21 14:03 UTC');
  });
});
