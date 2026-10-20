/**
 * A name's whole history (Simon, 2026-10-17: "on the names tab for each of
 * the names to have expand to see if there were any changes made to that
 * name"): every name transaction of its current registration, by each
 * account that had it and under its earlier spellings, newest first.
 *
 * Core has no history by name, so it is walked back from the owner (its
 * record, `/names/<name>`): each owner's name transactions (nameHistory.ts:
 * one read, shared with that account's Names tab; the whole of them, up to
 * 1,000, when the first 100 stop short) down to how it got the name
 * (rules/explorer/nameLife.ts): bought (the seller's come next, before the
 * sale), renamed from an earlier name (the same account's, under that
 * name), or registered, where it ends. At most NAME_LIFE_HOPS steps back,
 * one after another, each through the Explorer's limiter under the account
 * it reads (so leaving a page doesn't drop them). The registration found is checked against the record's, which
 * Core keeps through sales and renames. A name renamed away and registered
 * again is a new registration: Core keeps no link to the one before.
 *
 * Read only when its history is opened; kept 10 minutes under
 * `xnamelife:<name>`.
 */
import { fetchQuery, type FetchOptions } from '../query';
import type { TxRow } from '../types';
import { getNameData } from './account';
import { getNameHistory, NAME_HISTORY_PAGES_ALL } from './nameHistory';
import {
  CHAIN_NOW,
  ownerSpan,
  positionOf,
  type ChainPosition,
} from '../../rules/explorer/nameLife';

/** Owners and spellings gone back through at most. */
export const NAME_LIFE_HOPS = 12;

export type NameLifeEnd =
  /** Down to its registration; `matches`: the one its record gives. */
  | { kind: 'registered'; tx: TxRow; matches: boolean }
  /**
   * Cut short at `at`, the account whose part couldn't be read through:
   * its name transactions go back further than can be read (`capped`), they
   * don't say how it got the name (`notFound`), or too many steps (`hops`).
   */
  | { kind: 'cut'; at: string; why: 'capped' | 'notFound' | 'hops' };

export interface NameLife {
  name: string;
  /** Newest first. */
  steps: TxRow[];
  /** The accounts that had it, its owner first (one that had it twice, twice). */
  owners: string[];
  end: NameLifeEnd;
  /** When its record says it was registered (Core's ms), if it says. */
  registered: number | null;
}

export function nameLifeKey(name: string): string {
  return `xnamelife:${name}`;
}

/** The name's whole history; null when Core has no record of the name now. */
export function getNameLife(
  name: string,
  options: Pick<FetchOptions, 'force'> = {}
): Promise<NameLife | null> {
  return fetchQuery(
    nameLifeKey(name),
    async () => {
      const record = await getNameData(name);
      if (!record) return null;
      const registered = typeof record.registered === 'number' ? record.registered : null;
      const steps: TxRow[] = [];
      const owners: string[] = [];
      let account = record.owner;
      let spelling = name;
      let before: ChainPosition = CHAIN_NOW;
      for (let hop = 0; hop < NAME_LIFE_HOPS; hop += 1) {
        if (owners[owners.length - 1] !== account) owners.push(account);
        let read = await getNameHistory(account);
        let span = ownerSpan(read.rows, account, spelling, before);
        if (span.got.kind === 'notFound' && read.capped) {
          read = await getNameHistory(account, { pages: NAME_HISTORY_PAGES_ALL });
          span = ownerSpan(read.rows, account, spelling, before);
        }
        steps.push(...span.steps);
        const got = span.got;
        if (got.kind === 'registered')
          return {
            name,
            steps,
            owners,
            registered,
            end: {
              kind: 'registered',
              tx: got.tx,
              matches: registered === null || registered === got.tx.timestamp,
            },
          };
        if (got.kind === 'notFound')
          return {
            name,
            steps,
            owners,
            registered,
            end: { kind: 'cut', at: account, why: read.capped ? 'capped' : 'notFound' },
          };
        before = positionOf(got.tx);
        if (got.kind === 'bought') account = got.seller;
        else spelling = got.from;
      }
      return { name, steps, owners, registered, end: { kind: 'cut', at: account, why: 'hops' } };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
