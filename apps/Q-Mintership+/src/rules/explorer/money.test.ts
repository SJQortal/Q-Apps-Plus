import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import {
  busyLine,
  collapseBusy,
  flowAmounts,
  flowParts,
  flowsOf,
  formatAtomic,
  parseAtomic,
  paymentsCoverage,
  sortFlows,
  splitAt,
  wentTo,
  wentToParts,
} from './money';
import { partsToPlain, type TxPart } from './txWords';

const addr = (c: string) => `Q${c.repeat(33)}`;
const ME = addr('m');
const A = addr('a');
const B = addr('b');
const C = addr('c');
const AT = `A${'t'.repeat(33)}`;
const T0 = Date.UTC(2025, 2, 14, 12);
let n = 0;

function tx(type: string, height: number, extra: Partial<TxRow>): TxRow {
  n += 1;
  return {
    type,
    timestamp: T0 + (height - 1_000) * 86_400_000,
    signature: `sig${n}`.padEnd(88, 'x'),
    txGroupId: 0,
    blockHeight: height,
    ...extra,
  };
}
const pay = (from: string, to: string, height: number, amount: string) =>
  tx('PAYMENT', height, { creatorAddress: from, recipient: to, amount });

function plain(parts: TxPart[]): string {
  return partsToPlain(parts).replace(/Q(\w)\1{4}…\1{4}/g, (_, c: string) => c.toUpperCase());
}

describe('exact amounts', () => {
  it('parses and formats atomic units without floats', () => {
    expect(parseAtomic('4.30000000')).toBe(430_000_000n);
    expect(parseAtomic('0.1')).toBe(10_000_000n);
    expect(parseAtomic('1.123456789')).toBeNull();
    // As Core writes a BigDecimal (Simon, 2026-10-20: TeresaTee's balance is "0E-8").
    expect(parseAtomic('0E-8')).toBe(0n);
    expect(parseAtomic('1E-8')).toBe(1n);
    expect(parseAtomic('5E-7')).toBe(50n);
    expect(parseAtomic('1.5E+3')).toBe(150_000_000_000n);
    expect(parseAtomic('1.10000000')).toBe(110_000_000n);
    expect(parseAtomic('1.123456780')).toBe(112_345_678n);
    expect(parseAtomic('1E-9')).toBeNull();
    expect(parseAtomic('-1')).toBeNull();
    expect(parseAtomic('abc')).toBeNull();
    expect(formatAtomic(430_000_000n)).toBe('4.3');
    expect(formatAtomic(120_000_000_000n)).toBe('1,200');
    // 0.1 + 0.2 is exactly 0.3 here.
    expect(formatAtomic(parseAtomic('0.1')! + parseAtomic('0.2')!)).toBe('0.3');
  });
});

describe('flowsOf', () => {
  const rows = [
    pay(ME, A, 1_000, '10.00000000'),
    pay(ME, A, 1_010, '0.10000000'),
    pay(ME, A, 1_060, '0.20000000'),
    pay(ME, B, 1_020, '5'),
    pay(A, ME, 1_030, '2.5'),
    pay(ME, ME, 1_040, '1'),
    tx('TRANSFER_ASSET', 1_050, {
      creatorAddress: ME,
      recipient: B,
      amount: '50',
      assetId: 77,
      assetName: 'Bean Token',
    }),
    tx('TRANSFER_ASSET', 1_055, { creatorAddress: ME, recipient: B, amount: '3', assetId: 0 }),
    tx('MULTI_PAYMENT', 1_070, {
      creatorAddress: ME,
      payments: [
        { recipient: A, assetId: 0, amount: '1' },
        { recipient: A, assetId: 0, amount: '2' },
        { recipient: C, assetId: 0, amount: '3' },
      ],
    }),
    tx('MULTI_PAYMENT', 1_080, {
      creatorAddress: C,
      payments: [
        { recipient: ME, assetId: 0, amount: '7' },
        { recipient: A, assetId: 0, amount: '9' },
      ],
    }),
  ];

  it('groups what it sent by recipient, with exact totals, first and last', () => {
    const flows = flowsOf(rows, ME, 'sent');
    const a = flows.find((f) => f.address === A)!;
    // Three payments and one multi-payment (two parts to A count once).
    expect(a.count).toBe(4);
    expect(formatAtomic(a.qort)).toBe('13.3');
    expect(a.first.height).toBe(1_000);
    expect(a.last.height).toBe(1_070);
    expect(a.txs.map((t) => t.blockHeight)).toEqual([1_070, 1_060, 1_010, 1_000]);
    const b = flows.find((f) => f.address === B)!;
    expect(b.count).toBe(3);
    expect(formatAtomic(b.qort)).toBe('8');
    expect(b.assets).toEqual([{ asset: 'Bean Token', atomic: 5_000_000_000n }]);
    expect(plain(flowAmounts(b))).toBe('8 QORT and 50 Bean Token');
    // A payment to itself is no one's.
    expect(flows.map((f) => f.address)).not.toContain(ME);
  });

  it('groups what it received by sender, its share of a multi-payment only', () => {
    const flows = flowsOf(rows, ME, 'received');
    expect(flows.map((f) => [f.address, f.count, formatAtomic(f.qort)])).toEqual([
      [C, 1, '7'],
      [A, 1, '2.5'],
    ]);
  });

  it('counts a transaction once even when two pages both have it', () => {
    const dup = pay(ME, A, 2_000, '1');
    expect(flowsOf([dup, dup], ME, 'sent')[0].count).toBe(1);
  });

  it('leaves out unconfirmed rows and amounts it can’t read', () => {
    const waiting = { ...pay(ME, A, 1, '1'), blockHeight: undefined };
    expect(flowsOf([waiting, pay(ME, B, 2, 'x')], ME, 'sent')).toEqual([]);
  });

  it('words a flow each way', () => {
    const [a] = flowsOf([pay(ME, A, 1_000, '120'), pay(ME, A, 1_060, '1')], ME, 'sent');
    expect(plain(flowParts(a, 'sent'))).toBe('Paid A 121 QORT in 2 payments (Mar–May 2025)');
    const [b] = flowsOf([pay(B, ME, 1_000, '10')], ME, 'received');
    expect(plain(flowParts(b, 'received'))).toBe(
      'Received 10 QORT from B in 1 payment (14 Mar 2025)'
    );
  });
});

describe('sorting, ATs and busy accounts', () => {
  const rows = [
    pay(ME, A, 1, '1'),
    pay(ME, A, 2, '1'),
    pay(ME, A, 3, '1'),
    pay(ME, B, 4, '100'),
    pay(ME, C, 5, '50'),
    pay(ME, C, 6, '0.5'),
    pay(ME, AT, 7, '12'),
  ];
  const flows = flowsOf(rows, ME, 'sent');

  it('sorts by count or by total', () => {
    expect(sortFlows(flows, 'count').map((f) => f.address)).toEqual([A, C, B, AT]);
    expect(sortFlows(flows, 'total').map((f) => f.address)).toEqual([B, C, AT, A]);
  });

  it('sorts by the latest payment, or by the earliest', () => {
    expect(sortFlows(flows, 'latest').map((f) => f.address)).toEqual([AT, C, B, A]);
    expect(sortFlows(flows, 'first').map((f) => f.address)).toEqual([A, B, C, AT]);
  });

  it('splits out AT addresses', () => {
    const { people, ats } = splitAt(flows);
    expect(ats.map((f) => f.address)).toEqual([AT]);
    expect(people).toHaveLength(3);
  });

  it('collapses accounts that have sent 1,000+ payments, keeping 100+ and 500+ in the list', () => {
    const { shown, busy } = collapseBusy(sortFlows(flows, 'count'), {
      [A]: 1000,
      [B]: 500,
      [C]: 100,
    });
    expect(busy.map((f) => f.address)).toEqual([A]);
    expect(shown.map((f) => f.address)).toEqual([C, B, AT]);
    expect(busyLine(3)).toBe('3 more with accounts that have sent 1,000+ payments');
    expect(busyLine(1)).toBe('1 more with an account that has sent 1,000+ payments');
  });
});

describe('coverage', () => {
  it('says how far it read', () => {
    expect(paymentsCoverage({ count: 100, done: false }, { count: 100, done: false })).toBe(
      'Read: its latest 100 QORT payments each way.'
    );
    expect(
      paymentsCoverage(
        { count: 6, done: true },
        { count: 200, done: false },
        { count: 100, truncated: true }
      )
    ).toBe(
      'Read: every QORT payment it sent (6), its latest 200 QORT payments received and its latest 100 asset transfers and multi-payments.'
    );
    expect(
      paymentsCoverage(
        { count: 0, done: true },
        { count: 1, done: true },
        { count: 0, truncated: false }
      )
    ).toBe(
      'Read: every QORT payment it sent (none), every QORT payment it received (1) and every asset transfer and multi-payment (none).'
    );
    expect(
      paymentsCoverage(
        { count: 2, done: true },
        { count: 2, done: true },
        { count: 3, truncated: false }
      )
    ).toBe(
      'Read: every QORT payment it sent (2), every QORT payment it received (2) and every asset transfer and multi-payment (3).'
    );
  });
});

describe('across a set', () => {
  it('finds where several accounts sent QORT, ATs left out and counted', () => {
    const s1 = addr('1');
    const s2 = addr('2');
    const s3 = addr('3');
    const sent = new Map<string, TxRow[]>([
      [s1, [pay(s1, B, 1, '1'), pay(s1, B, 2, '2'), pay(s1, AT, 3, '9')]],
      [s2, [pay(s2, B, 4, '0.5'), pay(s2, C, 5, '1')]],
      [s3, [pay(s3, C, 6, '4'), pay(s3, `A${'u'.repeat(33)}`, 7, '1')]],
    ]);
    const { recipients, atLeftOut } = wentTo(sent);
    expect(atLeftOut).toBe(2);
    expect(
      recipients.map((r) => [r.address, r.from.length, r.count, formatAtomic(r.qort)])
    ).toEqual([
      [B, 2, 3, '3.5'],
      [C, 2, 2, '5'],
    ]);
    expect(plain(wentToParts(recipients[0], 48))).toBe(
      'B received QORT from 2 of these 48 accounts: 3 payments, 3.5 QORT'
    );
  });
});
