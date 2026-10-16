/**
 * Tests only: what the Mintership tab's tests add to the mock world, kept
 * out of e2e/world-explorer.mjs so every other test's world stays the same.
 */
import { fakeKey } from '../../../../../e2e/world.mjs';
import { MS_PER_BLOCK, NOW, TIP, type InstalledWorld } from '../../../../test/world';

type World = InstalledWorld['world'];

const blockTime = (height: number) => NOW - (TIP - height) * MS_PER_BLOCK;

/**
 * Four VOTE_ON_POLL transactions by `voter`: No on bob+builder's card
 * (options Yes, No), the second option on Kit Kicked's card, one on an
 * encrypted admin board card's poll and one on another app's poll.
 */
export function addPollVotes(world: World, voter: string): void {
  const x = world.explorer;
  const add = (pollName: string, optionIndex: number, height: number) => {
    const signature = fakeKey(`pollvote:${voter}:${pollName}`, 64);
    x.rows.push({
      type: 'VOTE_ON_POLL',
      timestamp: blockTime(height) - 20_000,
      reference: fakeKey(`pollvote-ref:${voter}:${pollName}`, 64),
      fee: '0.01000000',
      signature,
      txGroupId: 0,
      blockHeight: height,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: voter,
      voterPublicKey: fakeKey(`pk:${voter}`, 32),
      pollName,
      optionIndex,
    });
    x.parties.set(signature, [voter]);
    x.bySig.set(signature, x.rows[x.rows.length - 1]);
  };
  add('Minter-board-card-bQ7xK2-poll', 1, 2_740_000);
  add('Minter-board-card-Kt3mPq-poll', 1, 2_745_000);
  add('card-MAC-NC-1780000000000-a1B2c3-poll', 0, 2_746_000);
  add('Some other app poll', 0, 2_747_000);
  x.rows.sort(
    (a: { blockHeight: number }, b: { blockHeight: number }) => a.blockHeight - b.blockHeight
  );
}

/** A Q-Mintership+ record (service JSON) published under `name`. */
export function addRecord(
  world: World,
  name: string,
  identifier: string,
  body: Record<string, unknown>,
  ageMs = 3_600_000
): void {
  world.records.push({ name, identifier, created: NOW - ageMs, body: { v: 1, ...body } });
}
