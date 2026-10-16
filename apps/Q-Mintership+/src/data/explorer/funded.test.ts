import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { ADDR, installWorld } from '../../test/world';
import { FUNDER, SPONSEES } from '../../../e2e/world.mjs';
import { peekQuery, resetQueries } from '../query';
import { checkMoreFunded, firstPaidBy, fundedKey, getFunded } from './funded';

const H = `Q${'h'.repeat(33)}`;
const OTHER = `Q${'o'.repeat(33)}`;
const AT = `A${'t'.repeat(33)}`;
const to = (i: number) => `Q${String(i).padStart(4, '0').replace(/0/g, 'z')}${'r'.repeat(29)}`;

const params = (path: string) => new URL(path, 'http://x').searchParams;

function pay(from: string, recipient: string, height: number) {
  return {
    type: 'PAYMENT',
    signature: `${from.slice(1, 6)}${recipient.slice(1, 6)}${height}`.padEnd(88, 'x'),
    timestamp: height * 60_000,
    blockHeight: height,
    creatorAddress: from,
    recipient,
    amount: '1.50000000',
  };
}

beforeEach(() => resetQueries());
afterEach(() => vi.useRealTimers());

describe('whose first QORT payment came from an account', () => {
  it('reads its first 100 payments, then each account’s earliest payment received, 50 per tap', async () => {
    // H paid 60 accounts (one twice, one AT, one to itself); it was the first payer of the even ones.
    const sent = [
      ...Array.from({ length: 60 }, (_, i) => pay(H, to(i), 1_000 + i)),
      pay(H, to(0), 2_000),
      pay(H, AT, 2_001),
      pay(H, H, 2_002),
    ];
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      const sp = url.searchParams;
      if (sp.get('senderAddress')) return sent;
      const r = sp.get('recipientAddress') as string;
      const i = Number(r.slice(1, 5).replace(/z/g, '0'));
      return [i % 2 === 0 ? pay(H, r, 1_000 + i) : pay(OTHER, r, 500)];
    });
    const read = await getFunded(H);
    expect(read).toMatchObject({ payments: 63, truncated: false, atLeftOut: 1, checked: 0 });
    expect(read.paid).toHaveLength(60);
    expect(read.paid[0]).toMatchObject({ address: to(0), height: 1_000, amount: '1.50000000' });
    expect(fetchCallsFor('/transactions/payments/between')).toHaveLength(1);
    const first = params(fetchCallsFor('/transactions/payments/between')[0]);
    expect(first.get('senderAddress')).toBe(H);
    expect(first.get('limit')).toBe('100');
    expect(first.get('reverse')).toBeNull();
    expect(first.get('confirmationStatus')).toBe('CONFIRMED');

    const progress: number[] = [];
    const funded = (await checkMoreFunded(H, { onProgress: (done) => progress.push(done) }))!;
    expect(funded.checked).toBe(50);
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(50);
    const checks = fetchCallsFor('/transactions/payments/between').slice(1).map(params);
    expect(checks).toHaveLength(50);
    expect(checks.every((c) => c.get('limit') === '1' && c.get('recipientAddress'))).toBe(true);
    expect(firstPaidBy(funded, H)).toHaveLength(25);

    const more = await checkMoreFunded(H);
    expect(more?.checked).toBe(60);
    expect(firstPaidBy(more!, H)).toHaveLength(30);
    expect(peekQuery(fundedKey(H))).toBe(more);
    // All checked: no more reads.
    const reads = fetchCallsFor('/transactions/payments/between').length;
    await checkMoreFunded(H);
    expect(fetchCallsFor('/transactions/payments/between')).toHaveLength(reads);
  });

  it('runs at most 4 checks at once', async () => {
    let running = 0;
    let most = 0;
    mockFetchRoute('/transactions/payments/between', async (url: URL) => {
      if (url.searchParams.get('senderAddress'))
        return Array.from({ length: 12 }, (_, i) => pay(H, to(i), 1_000 + i));
      running += 1;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 2));
      running -= 1;
      return [];
    });
    await getFunded(H);
    const funded = (await checkMoreFunded(H))!;
    expect(most).toBe(4);
    expect(funded.checked).toBe(12);
    expect(firstPaidBy(funded, H)).toEqual([]);
  });

  it('in the mock world: Hal made the first QORT payment to every account he paid first', async () => {
    installWorld('admin', { strict: true });
    await getFunded(FUNDER.address);
    const funded = (await checkMoreFunded(FUNDER.address))!;
    expect(funded).toMatchObject({ payments: 100, truncated: true, checked: 50 });
    expect(funded.paid.slice(0, 4).map((p) => p.address)).toEqual([
      ADDR.kicked,
      ADDR.left,
      SPONSEES[1].address,
      SPONSEES[2].address,
    ]);
    expect(firstPaidBy(funded, FUNDER.address)).toHaveLength(50);
  });
});
