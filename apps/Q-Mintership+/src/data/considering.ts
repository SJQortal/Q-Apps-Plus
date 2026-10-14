/**
 * Considering records, as everyone sees them: one paged prefix search for
 * `qmp-considering-` shared by every card (newest first, at most 3 pages of
 * 100), then each candidate's small JSON body (cached per version; one
 * slower than a few seconds counts on the next read, so it never holds the
 * others up).
 *
 * Only rows that can still matter are read: published within the last two
 * signing windows (a nomination waits at most one, then its invite collects
 * signatures for at most one), keyed by a decision still pending or by an
 * address, and published under the name of a current Minter Admin. The
 * publisher is re-checked on every read; names that aren't an admin's
 * primary name are looked up once (cached 30 minutes).
 */
import type { ChainAnswer, ConsideringEntry } from '../rules/considering';
import type { Tally } from '../rules/tally';
import { getNameOwner, isAddress } from './accounts';
import { loadDecisions } from './decisions';
import { fetchQdnJson, mapLimit, quick, rowTime, searchQdn } from './qdn';
import { fetchQuery } from './query';
import {
  CONSIDERING_PREFIX,
  RECORD_SERVICE,
  consideringKey,
  consideringKeyOf,
  parseConsidering,
} from './records';

export interface ConsideringData {
  entries: ConsideringEntry[];
  /** The search hit its ceiling (shown, never silent). */
  truncated: boolean;
  loadedAt: number;
}

/** Pages of 100 rows read at most, newest first. */
export const CONSIDERING_MAX_PAGES = 3;

export function loadConsidering(options: { force?: boolean } = {}): Promise<ConsideringData> {
  return fetchQuery(
    'considering:all',
    async () => {
      const force = options.force;
      const [search, decisions] = await Promise.all([
        searchQdn(
          {
            service: RECORD_SERVICE,
            identifier: CONSIDERING_PREFIX,
            maxPages: CONSIDERING_MAX_PAGES,
          },
          { force }
        ),
        loadDecisions(),
      ]);
      const { now, group, admins } = decisions;
      const cutoff = now.timestamp - 2 * (group.maximumBlockDelay + 1) * now.msPerBlock;
      const pendingKeys = new Set(
        decisions.decisions.map((d) => consideringKey({ pendingSignature: d.signature }))
      );
      const candidates = search.rows.filter((row) => {
        if (rowTime(row) < cutoff) return false;
        const key = consideringKeyOf(row.identifier);
        return key !== null && (isAddress(key) || pendingKeys.has(key));
      });

      // Current Minter Admins who can publish (the null owner can't).
      const adminSet = new Set(admins.signers.map((a) => a.member));
      const byPrimaryName = new Map<string, string>();
      for (const a of admins.signers) if (a.primaryName) byPrimaryName.set(a.primaryName, a.member);
      const publisherOf = new Map<string, string | null>();
      await mapLimit([...new Set(candidates.map((r) => r.name))], 6, async (name) => {
        const address = byPrimaryName.get(name) ?? (await getNameOwner(name).catch(() => null));
        publisherOf.set(name, address && adminSet.has(address) ? address : null);
      });

      const valid = candidates.filter((row) => publisherOf.get(row.name));
      const read = await mapLimit(valid, 6, async (row): Promise<ConsideringEntry | null> => {
        try {
          const body = await quick(
            fetchQdnJson(
              RECORD_SERVICE,
              row.name,
              row.identifier,
              row.latestSignature ?? rowTime(row)
            )
          );
          // A slow one counts on the next read (it is cached by then).
          if (body.value === null) return null;
          const record = parseConsidering(body.value, row.identifier);
          if (!record) return null;
          return {
            publisher: { name: row.name, address: publisherOf.get(row.name) as string },
            record,
            publishedAt: rowTime(row),
          };
        } catch {
          return null;
        }
      });
      return {
        entries: read.filter((e): e is ConsideringEntry => e !== null),
        truncated: search.truncated,
        loadedAt: Date.now(),
      };
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** Each admin's latest answer on a decision, from its tally (confirmed and on its way). */
export function answersFromTally(tally: Tally | null | undefined): ChainAnswer[] {
  if (!tally) return [];
  return [...tally.approvals, ...tally.rejections, ...tally.inFlight].map((d) => ({
    address: d.address,
    timestamp: d.timestamp,
  }));
}
