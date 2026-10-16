import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { base58Encode, base58Decode } from '../../qortal/base58';
import { peekQuery, resetQueries } from '../query';
import {
  decodePrivsRecipient,
  exploreAccount,
  fundingFrom,
  getFirstSeen,
  getGroupsOf,
  getNameData,
  getNamesOf,
  getPayerBand,
  isAtAddress,
  isSignature,
  payerBandWords,
} from './account';
import type { TxRow } from '../types';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const B = 'QPmsozoP6w3WAgvMyHnUhqauz1JR9FVHeF';
const SIG = (n: number) => `${'4Kw5V2Zmh7mfV6KjPuX2ZXCK3HE2fsR6w5CWD75CdMa8Rfat1mXcf5rCiLpm8tm96FMPhCUBpMUaLpvUmitbq'}${'Jbm'.slice(0, 1)}${n}`.slice(0, 88);

function account(extra: Record<string, unknown> = {}) {
  return { address: A, level: 3, blocksMinted: 1000, flags: 0, ...extra };
}

beforeEach(() => {
  resetQueries();
});

describe('address shapes', () => {
  it('tells AT addresses and signatures apart from accounts', () => {
    expect(isAtAddress('AXkh6WsHiwsSHjAhdnx7ru1zcJb4hePoBj')).toBe(true);
    expect(isAtAddress(A)).toBe(false);
    expect(isSignature(SIG(1))).toBe(true);
    expect(isSignature(A)).toBe(false);
  });
});

describe('exploreAccount', () => {
  it('says "unused" for a valid address Core has never seen', async () => {
    mockFetchRoute(
      '/addresses/',
      () =>
        new Response(JSON.stringify({ error: 124, message: 'account address unknown' }), {
          status: 404,
        })
    );
    await expect(exploreAccount(A)).resolves.toEqual({ kind: 'unused', address: A });
  });

  it('primes the shared account read', async () => {
    mockFetchRoute('/addresses/', account());
    const explored = await exploreAccount(A);
    expect(explored.kind).toBe('account');
    expect(peekQuery(`account:${A}`)).toMatchObject({ address: A, level: 3 });
  });

  it('throws other failures (never cached as unused)', async () => {
    mockFetchRoute('/addresses/', () => new Response('boom', { status: 500 }));
    await expect(exploreAccount(A)).rejects.toThrow();
  });
});

describe('getNamesOf', () => {
  it('reads every page of names, 100 at a time', async () => {
    mockFetchRoute('/names/address/', (url: URL) => {
      const offset = Number(url.searchParams.get('offset'));
      expect(url.searchParams.get('limit')).toBe('100');
      const count = offset === 0 ? 100 : 30;
      return Array.from({ length: count }, (_, i) => ({ name: `n${offset + i}`, owner: A }));
    });
    const result = await getNamesOf(A);
    expect(result.names).toHaveLength(130);
    expect(result.truncated).toBe(false);
    expect(fetchCallsFor('/names/address/')).toHaveLength(2);
  });

  it('stops at 5 pages and says so', async () => {
    mockFetchRoute('/names/address/', (url: URL) =>
      Array.from({ length: 100 }, (_, i) => ({
        name: `n${Number(url.searchParams.get('offset')) + i}`,
        owner: A,
      }))
    );
    const result = await getNamesOf(A);
    expect(result.names).toHaveLength(500);
    expect(result.truncated).toBe(true);
    expect(fetchCallsFor('/names/address/')).toHaveLength(5);
  });
});

describe('getNameData', () => {
  it('returns the name as Core spells it, and primes the owner lookup', async () => {
    mockFetchRoute('/names/', { name: 'Tools', reducedName: 't001s', owner: B, registered: 5 });
    const data = await getNameData('T00LS');
    expect(data).toMatchObject({ name: 'Tools', owner: B, registered: 5 });
    expect(peekQuery('nameowner:T00LS')).toBe(B);
  });

  it('is null for a name nobody has', async () => {
    mockFetchRoute(
      '/names/',
      () => new Response(JSON.stringify({ error: 401, message: 'name unknown' }), { status: 404 })
    );
    await expect(getNameData('nobody')).resolves.toBeNull();
  });
});

describe('getGroupsOf', () => {
  it('lists every group and primes the MINTER membership', async () => {
    mockFetchRoute('/groups/member/', [
      { groupId: 31, groupName: 'alt coin investor', isOpen: true, memberCount: 72, isAdmin: false },
      { groupId: 694, groupName: 'MINTER', isOpen: false, memberCount: 629, isAdmin: true },
    ]);
    const groups = await getGroupsOf(A);
    expect(groups.map((g) => g.groupName)).toEqual(['alt coin investor', 'MINTER']);
    expect(groups[0].isAdmin).toBeUndefined();
    expect(peekQuery(`membership:${A}`)).toEqual({ isMember: true, isAdmin: true });
  });
});

function privsRaw(recipient: string): string {
  const bytes = new Uint8Array(209);
  new DataView(bytes.buffer).setInt32(0, 40);
  bytes.set(base58Decode(recipient), 112);
  for (let i = 137; i < 209; i++) bytes[i] = (i * 7) & 0xff;
  return base58Encode(bytes);
}

describe('decodePrivsRecipient', () => {
  it('reads the recipient at bytes 112–136 of a TRANSFER_PRIVS', () => {
    expect(decodePrivsRecipient(privsRaw(B))).toBe(B);
  });

  it('refuses other types and short or broken input', () => {
    const other = base58Decode(privsRaw(B));
    new DataView(other.buffer).setInt32(0, 2);
    expect(decodePrivsRecipient(base58Encode(other))).toBeNull();
    expect(decodePrivsRecipient('abc')).toBeNull();
    expect(decodePrivsRecipient('0OIl')).toBeNull();
  });
});

describe('fundingFrom', () => {
  const base = { timestamp: 10, signature: 's', txGroupId: 0, blockHeight: 100 } as TxRow;
  it('names who sent what', () => {
    expect(
      fundingFrom({ ...base, type: 'PAYMENT', recipient: A, creatorAddress: B, amount: '5' }, A)
    ).toMatchObject({ kind: 'payment', from: B, amount: '5', height: 100 });
    expect(
      fundingFrom(
        { ...base, type: 'REWARD_SHARE', recipient: A, creatorAddress: B, sharePercent: '0.00' },
        A
      )
    ).toMatchObject({ kind: 'rewardShare', from: B, sharePercent: '0.00' });
    expect(
      fundingFrom(
        {
          ...base,
          type: 'AT',
          recipient: A,
          atAddress: 'AXkh6WsHiwsSHjAhdnx7ru1zcJb4hePoBj',
          creatorAddress: 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG',
          amount: '1',
        },
        A
      )
    ).toMatchObject({ kind: 'at', from: 'AXkh6WsHiwsSHjAhdnx7ru1zcJb4hePoBj' });
    expect(
      fundingFrom(
        {
          ...base,
          type: 'MULTI_PAYMENT',
          creatorAddress: B,
          payments: [{ recipient: 'Qother', amount: '1' }, { recipient: A, amount: '2' }],
        },
        A
      )
    ).toMatchObject({ kind: 'multiPayment', amount: '2' });
  });

  it('ignores transactions that send nothing to the account', () => {
    expect(fundingFrom({ ...base, type: 'PAYMENT', recipient: B, creatorAddress: A }, A)).toBeNull();
    expect(fundingFrom({ ...base, type: 'REGISTER_NAME', creatorAddress: A }, A)).toBeNull();
    expect(
      fundingFrom({ ...base, type: 'PAYMENT', recipient: A, creatorAddress: B, blockHeight: undefined }, A)
    ).toBeNull();
  });
});

describe('getFirstSeen', () => {
  const payment = {
    type: 'PAYMENT',
    timestamp: 2000,
    signature: 'pay1',
    txGroupId: 0,
    blockHeight: 1_199_332,
    recipient: A,
    creatorAddress: B,
    amount: '4.3',
  };

  it('follows the reference of an account that never sent anything', async () => {
    mockFetchRoute('/addresses/', account({ reference: 'pay1' }));
    mockFetchRoute('/transactions/signature/', payment);
    const seen = await getFirstSeen(A);
    expect(seen.firstOwn).toBeNull();
    expect(seen.funding).toMatchObject({ kind: 'payment', from: B, amount: '4.3' });
    expect(seen.firstSeen).toEqual({ height: 1_199_332, timestamp: 2000 });
    expect(fetchCallsFor('/transactions/payments/between')).toHaveLength(0);
  });

  it('skips a PUBLICIZE first transaction and asks for the first payment received', async () => {
    mockFetchRoute('/addresses/', account({ publicKey: 'PK', reference: 'later' }));
    mockFetchRoute('/transactions/creator/', [
      {
        type: 'PUBLICIZE',
        timestamp: 1000,
        signature: 'pub',
        reference: 'random',
        txGroupId: 0,
        blockHeight: 1_198_606,
        creatorAddress: A,
      },
    ]);
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      expect(url.searchParams.get('recipientAddress')).toBe(A);
      expect(url.searchParams.get('limit')).toBe('1');
      return [payment];
    });
    const seen = await getFirstSeen(A);
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(0);
    expect(seen.firstOwn).toMatchObject({ type: 'PUBLICIZE', height: 1_198_606 });
    expect(seen.funding).toMatchObject({ kind: 'payment', height: 1_199_332 });
    expect(seen.firstSeen?.height).toBe(1_198_606);
  });

  it('falls back when the reference names someone else', async () => {
    mockFetchRoute('/addresses/', account({ publicKey: 'PK' }));
    mockFetchRoute('/transactions/creator/', [
      { type: 'PAYMENT', timestamp: 3000, signature: 'own', reference: 'x', txGroupId: 0, blockHeight: 500 },
    ]);
    mockFetchRoute('/transactions/signature/', { ...payment, recipient: 'Qsomeoneelse' });
    mockFetchRoute('/transactions/payments/between', []);
    const seen = await getFirstSeen(A);
    expect(seen.funding).toBeNull();
    expect(seen.firstSeen).toEqual({ height: 500, timestamp: 3000 });
  });
});

describe('getPayerBand', () => {
  it('reads bands of sent payments, stopping at the first empty one', async () => {
    mockFetchRoute('/transactions/payments/between', (url: URL) => {
      expect(url.searchParams.get('senderAddress')).toBe(B);
      return Number(url.searchParams.get('offset')) < 499 ? [{}] : [];
    });
    await expect(getPayerBand(B)).resolves.toBe(100);
    expect(fetchCallsFor('/transactions/payments/between')).toHaveLength(2);
    expect(payerBandWords(100)).toBe('has sent 100+ payments');
    expect(payerBandWords(1000)).toBe('has sent 1,000+ payments');
    expect(payerBandWords(0)).toBeNull();
  });
});
