/**
 * Mock-world helpers for the QORT summaries' tests (Overview, Minter
 * Profile): a longer history, and a balance that makes QORT minted come to a
 * chosen amount by the app's own bookkeeping (rules/explorer/qortBook.ts,
 * checked against real accounts there).
 */
import { answerCore, fakeAddress, fakeKey, NOW } from '../../e2e/world.mjs';
import type { TxRow } from '../data/types';
import { qortBook, qortMinted } from '../rules/explorer/qortBook';
import type { RenderPageOptions } from './render';

type World = Parameters<NonNullable<RenderPageOptions['setup']>>[0];

/** `count` payments of 1 QORT to `address`, an hour apart, from one payer. */
export function addPaymentsTo(world: World, address: string, count: number) {
  const from = fakeAddress('summaries-payer');
  for (let i = 0; i < count; i++) {
    const signature = fakeKey(`summaries:${address}:${i}`, 64);
    const row = {
      type: 'PAYMENT',
      timestamp: NOW - (i + 1) * 3_600_000,
      reference: fakeKey(`summaries-ref:${address}:${i}`, 64),
      fee: '0.01000000',
      signature,
      txGroupId: 0,
      blockHeight: 2_700_000 + i,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: from,
      recipient: address,
      amount: '1.00000000',
    };
    world.explorer.rows.push(row);
    world.explorer.bySig.set(signature, row);
    world.explorer.parties.set(signature, [from, address]);
  }
}

/** Sets the account's balance so its QORT minted comes to `minted` QORT. */
export function setMintedTo(world: World, address: string, minted: bigint) {
  const reply = answerCore(
    world,
    '/transactions/search',
    new URLSearchParams({ address, confirmationStatus: 'CONFIRMED', limit: '20000' })
  );
  const rows = reply?.body as TxRow[];
  const moved = -qortMinted(0n, qortBook(rows, address), 0n);
  const balance = minted * 100_000_000n + moved;
  const account = world.accounts.get(address);
  if (account)
    account.balance = `${balance / 100_000_000n}.${String(balance % 100_000_000n).padStart(8, '0')}`;
}
