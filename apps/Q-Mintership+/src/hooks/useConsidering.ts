/**
 * Considering for one card: who is considering it (one shared read for
 * every card, refreshed while visible), and this admin's own state with
 * what this device is still publishing.
 */
import { useAtomValue } from 'jotai';
import { answersFromTally, loadConsidering } from '../data/considering';
import { consideringKey, type ConsideringTarget } from '../data/records';
import {
  consideringFor,
  myConsideringState,
  type ConsideringPerson,
  type ConsideringTargetQuery,
  type MyConsideringState,
} from '../rules/considering';
import type { Tally } from '../rules/tally';
import { pendingWritesAtom, writeKeys } from '../writes/optimistic';
import { LIVE_REFRESH_MS } from './useData';
import { useQuery } from './useQuery';

/** Every Considering record that can still matter (data/considering.ts). */
export function useConsideringData(enabled = true) {
  return useQuery('considering:all', (force) => loadConsidering({ force }), {
    refreshMs: LIVE_REFRESH_MS,
    enabled,
  });
}

export interface ConsideringView {
  /** Minter Admins considering it now, oldest first. */
  people: ConsideringPerson[];
  /** This admin, as the card shows them (null when nobody is signed in). */
  mine: MyConsideringState | null;
  /** The record this admin would publish: the decision, or the waiting nomination. */
  publishTarget: ConsideringTarget | null;
}

/**
 * Who is considering `target`, with answers on chain from `tally` replacing
 * older records. `myAddress` adds this admin's own state.
 */
export function useConsideringFor(
  target: ConsideringTargetQuery,
  tally: Tally | null | undefined,
  options: { enabled?: boolean; myAddress?: string | null } = {}
): ConsideringView {
  const enabled = options.enabled !== false;
  const data = useConsideringData(enabled);
  const writes = useAtomValue(pendingWritesAtom);
  const people =
    enabled && data.data ? consideringFor(data.data.entries, target, answersFromTally(tally)) : [];
  const publishTarget: ConsideringTarget | null = target.pendingSignature
    ? { pendingSignature: target.pendingSignature }
    : target.nomineeAddress
      ? { nomineeAddress: target.nomineeAddress }
      : null;
  let mine: MyConsideringState | null = null;
  if (options.myAddress && publishTarget) {
    let key: string | null = null;
    try {
      key = consideringKey(publishTarget);
    } catch {
      key = null;
    }
    mine = myConsideringState(people, options.myAddress, {
      set: key ? (writes[writeKeys.considering(key)] ?? null) : null,
      clear: key ? (writes[writeKeys.notConsidering(key)] ?? null) : null,
    });
  }
  return { people, mine, publishTarget };
}
