/**
 * Minter Admin poll writes from this device, shown at once until QDN lists
 * them (writes/adminPolls.ts marks them; the polls section settles them):
 *
 * - a vote: "Voted Yes ✓ (confirming…)" while it is on its way;
 * - a new poll: listed as "Publishing…";
 * - a share: "Shared (confirming…)";
 * - a comment, edit or deletion: in its thread at once.
 *
 * Entries expire after 15 minutes, so a publish that never arrives doesn't
 * stick. Nothing here is saved on the device.
 */
import { useMemo } from 'react';
import { atom, getDefaultStore, useAtomValue, type PrimitiveAtom } from 'jotai';
import type { PollCommentRecord, PollRecord, PollVote } from '../data/adminPollRecords';
import type { Publisher } from '../rules/adminPolls';

export type PendingPollStatus = 'sending' | 'confirming' | 'failed';

interface PendingBase {
  status: PendingPollStatus;
  at: number;
  message?: string;
}

export interface PendingVote extends PendingBase {
  vote: PollVote;
}

export interface PendingPoll extends PendingBase {
  poll: PollRecord;
  publisher: Publisher;
}

export interface PendingShare extends PendingBase {
  /** Who the copy was encrypted to. */
  readers: string[];
}

export interface PendingPollComment {
  ref: string;
  name: string;
  identifier: string;
  pollId: string;
  record: PollCommentRecord;
  at: number;
}

export const POLL_WRITE_EXPIRE_MS = 15 * 60_000;

/** By poll id. */
export const pendingVotesAtom = atom<Record<string, PendingVote>>({});
export const pendingPollsAtom = atom<Record<string, PendingPoll>>({});
export const pendingSharesAtom = atom<Record<string, PendingShare>>({});
/** By comment ref (name + identifier). */
export const pendingPollCommentsAtom = atom<Record<string, PendingPollComment>>({});

const store = getDefaultStore();

function put<T>(target: PrimitiveAtom<Record<string, T>>, key: string, value: T | null): void {
  store.set(target, (current) => {
    if (value) return { ...current, [key]: value };
    if (!(key in current)) return current;
    const next = { ...current };
    delete next[key];
    return next;
  });
}

export function setPendingVote(pollId: string, value: PendingVote | null): void {
  put(pendingVotesAtom, pollId, value);
}

export function setPendingPoll(pollId: string, value: PendingPoll | null): void {
  put(pendingPollsAtom, pollId, value);
}

export function setPendingShare(pollId: string, value: PendingShare | null): void {
  put(pendingSharesAtom, pollId, value);
}

export function setPendingPollComment(ref: string, value: PendingPollComment | null): void {
  put(pendingPollCommentsAtom, ref, value);
}

/** Entries still worth showing. */
export function fresh<T extends { at: number }>(
  all: Record<string, T>,
  now = Date.now()
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(all).filter(([, v]) => now - v.at <= POLL_WRITE_EXPIRE_MS)
  );
}

/** React: this device's poll writes still on their way (expired ones left out). */
export function usePendingPollWrites(): {
  votes: Record<string, PendingVote>;
  polls: Record<string, PendingPoll>;
  shares: Record<string, PendingShare>;
  comments: Record<string, PendingPollComment>;
} {
  const votes = useAtomValue(pendingVotesAtom);
  const polls = useAtomValue(pendingPollsAtom);
  const shares = useAtomValue(pendingSharesAtom);
  const comments = useAtomValue(pendingPollCommentsAtom);
  return useMemo(() => {
    const now = Date.now();
    return {
      votes: fresh(votes, now),
      polls: fresh(polls, now),
      shares: fresh(shares, now),
      comments: fresh(comments, now),
    };
  }, [votes, polls, shares, comments]);
}

/** Snapshots, outside React. */
export function pendingPollWrites() {
  return {
    votes: fresh(store.get(pendingVotesAtom)),
    polls: fresh(store.get(pendingPollsAtom)),
    shares: fresh(store.get(pendingSharesAtom)),
    comments: fresh(store.get(pendingPollCommentsAtom)),
  };
}

/** Tests start empty. */
export function resetPendingPollWrites(): void {
  store.set(pendingVotesAtom, {});
  store.set(pendingPollsAtom, {});
  store.set(pendingSharesAtom, {});
  store.set(pendingPollCommentsAtom, {});
}
