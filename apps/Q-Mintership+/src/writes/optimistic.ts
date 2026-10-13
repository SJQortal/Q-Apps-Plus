/**
 * Writes in flight, for optimistic UI: "Signed ✓ (confirming…)", "Rejected
 * (confirming…)" or "Withdrawn (confirming…)" from the moment Hub answers
 * until the chain shows the answer. Keyed by what the write is about, e.g.
 * `sign:<pendingSignature>` or `join:<address>`.
 * Entries expire after 15 minutes so a lost transaction never sticks.
 */
import { atom, getDefaultStore, useAtomValue } from 'jotai';

export type PendingWriteStatus = 'sending' | 'confirming' | 'failed';

export interface PendingWrite {
  key: string;
  status: PendingWriteStatus;
  /** The transaction's signature once Hub returned it. */
  signature: string | null;
  at: number;
  message?: string;
  /**
   * When this device saw its transaction in a block (useSettleConfirmingWrites).
   * The entry stays 'confirming' until the views show the answer; this only
   * ends the faster refresh.
   */
  onChainAt?: number;
}

const EXPIRE_MS = 15 * 60_000;

export const pendingWritesAtom = atom<Record<string, PendingWrite>>({});

const store = getDefaultStore();

export function markWrite(
  key: string,
  status: PendingWriteStatus,
  extra: Partial<PendingWrite> = {}
): void {
  store.set(pendingWritesAtom, (current) => ({
    ...current,
    [key]: {
      key,
      status,
      signature: extra.signature ?? current[key]?.signature ?? null,
      at: Date.now(),
      message: extra.message,
    },
  }));
}

/**
 * The write's transaction is in a block: the live views can go back to their
 * usual pace. `status` and `at` stay as they are, so "(confirming…)" still
 * shows until the views have the answer. A newer write on the key (another
 * signature) is left alone.
 */
export function settleWrite(key: string, signature?: string): void {
  store.set(pendingWritesAtom, (current) => {
    const entry = current[key];
    if (!entry || entry.status !== 'confirming' || entry.onChainAt) return current;
    if (signature !== undefined && entry.signature !== signature) return current;
    return { ...current, [key]: { ...entry, onChainAt: Date.now() } };
  });
}

export function clearWrite(key: string): void {
  store.set(pendingWritesAtom, (current) => {
    if (!(key in current)) return current;
    const next = { ...current };
    delete next[key];
    return next;
  });
}

export function getPendingWrite(key: string): PendingWrite | null {
  const entry = store.get(pendingWritesAtom)[key];
  if (!entry) return null;
  if (Date.now() - entry.at > EXPIRE_MS) {
    clearWrite(key);
    return null;
  }
  return entry;
}

/** React: the in-flight write for `key`, or null. */
export function usePendingWrite(key: string | null): PendingWrite | null {
  const all = useAtomValue(pendingWritesAtom);
  if (!key) return null;
  const entry = all[key];
  return entry && Date.now() - entry.at <= EXPIRE_MS ? entry : null;
}

/** How long after a write the live views refresh faster, while it waits for its block. */
export const CONFIRMING_WINDOW_MS = 5 * 60_000;

/**
 * A write that keeps the live views fast: sent from this device in the last
 * few minutes, and not yet seen in a block. A Considering record doesn't
 * count: it changes none of those views.
 */
export function waitsForBlock(entry: PendingWrite, now = Date.now()): boolean {
  return (
    entry.status === 'confirming' &&
    !entry.onChainAt &&
    now - entry.at <= CONFIRMING_WINDOW_MS &&
    !QDN_NOTE_PREFIXES.some((prefix) => entry.key.startsWith(prefix))
  );
}

/**
 * True while a write this device sent in the last few minutes is still
 * waiting for its block: the live views then refresh every 15 s instead of
 * every minute, so "(confirming…)" settles soon after the block (about a
 * minute on mainnet) rather than up to a minute later. It ends once the
 * transaction is in a block (settleWrite), or after the window for one that
 * never shows up.
 */
export function useConfirmingWrites(): boolean {
  const all = useAtomValue(pendingWritesAtom);
  const now = Date.now();
  return Object.values(all).some((entry) => waitsForBlock(entry, now));
}

/** An admin's answers on one decision from this device: Sign, Reject, Withdraw my signature. */
export interface PendingAnswers {
  sign: PendingWrite | null;
  reject: PendingWrite | null;
  withdraw: PendingWrite | null;
}

function fresh(entry: PendingWrite | undefined, now: number): PendingWrite | null {
  return entry && now - entry.at <= EXPIRE_MS ? entry : null;
}

/** The answers on `pendingSignature` in a snapshot of the writes (pages that read the atom). */
export function pendingAnswersIn(
  all: Record<string, PendingWrite>,
  pendingSignature: string,
  now = Date.now()
): PendingAnswers {
  return {
    sign: fresh(all[writeKeys.sign(pendingSignature)], now),
    reject: fresh(all[writeKeys.reject(pendingSignature)], now),
    withdraw: fresh(all[writeKeys.withdraw(pendingSignature)], now),
  };
}

/** React: the admin's answers on a decision still on their way from this device. */
export function usePendingAnswers(pendingSignature: string): PendingAnswers {
  const all = useAtomValue(pendingWritesAtom);
  return pendingAnswersIn(all, pendingSignature);
}

export const writeKeys = {
  sign: (pendingSignature: string) => `sign:${pendingSignature}`,
  /** Reject: a rejection from an admin who hadn't signed. */
  reject: (pendingSignature: string) => `reject:${pendingSignature}`,
  /** Withdraw my signature: a rejection after the admin's own signature. */
  withdraw: (pendingSignature: string) => `withdraw:${pendingSignature}`,
  invite: (nominee: string) => `invite:${nominee}`,
  join: (address: string) => `join:${address}`,
  nominate: (nominee: string) => `nominate:${nominee}`,
  support: (nominee: string) => `support:${nominee}`,
  propose: (kind: string, subject: string) => `propose:${kind}:${subject}`,
  /** Considering, by its record's key (a pending signature's first 40 characters, or an address). */
  considering: (key: string) => `considering:${key}`,
  /** No longer considering. */
  notConsidering: (key: string) => `notconsidering:${key}`,
};

/** Writes that only publish a QDN note, which the chain views never show. */
const QDN_NOTE_PREFIXES = [writeKeys.considering(''), writeKeys.notConsidering('')];
