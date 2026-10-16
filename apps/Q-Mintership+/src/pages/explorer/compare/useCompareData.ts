/**
 * Every read Compare makes, per account and per pair, and what the rules
 * make of them. Shared with the account pages wherever the read is the
 * same (the same keys), so an account already explored costs nothing more.
 *
 * - At once, per account: the account (xacct), its primary name, its
 *   MINTER status (status:, not polled), where its first QORT came from
 *   (xfirst), its groups (xgroups), its newest 100 QORT payments each way
 *   (xpay, light), its Q-Mintership+ records (xmade), its trade-portal
 *   sales (xtrades, by public key), and two heavy searches through the
 *   limiter with the scope 'compare' (xlinks, xassets); per pair, the
 *   payments each way (xpair); once, who mints now (xonline).
 * - When the timeline or In common nears the screen: MINTER's member list
 *   (joined), for an account outside MINTER its newest join request (asked:)
 *   and nominations (nominations:for:, both already read by its status),
 *   its primary name's record (xnamedata, registered),
 *   the links of a sponsor two of them share (xlinks, heavy), and how busy
 *   each shared payer is (xbusy).
 * - When Side by side nears the screen: names (xnames), balance, the last
 *   transaction sent (xlastsent) and the primary name's QDN count
 *   (xqdnname).
 *
 * Accounts Core doesn't know (never used, or a bad checksum) get no reads
 * beyond the first. Nothing here polls.
 */
import { getBalance, getPrimaryName } from '../../../data/accounts';
import {
  exploreAccount,
  getFirstSeen,
  getGroupsOf,
  getNameData,
  getNamesOf,
  getOnline,
  onlineSharesOf,
  type ExploredAccount,
  type PayerBand,
} from '../../../data/explorer/account';
import {
  getPairPayments,
  getTradesAsSeller,
  pairKey,
  tradesKey,
  type PairPayments,
} from '../../../data/explorer/compare';
import { getLastSent, lastSentKey } from '../../../data/explorer/lastSent';
import { getLinks, linksKey } from '../../../data/explorer/links';
import { loadMadeBy } from '../../../data/explorer/madeBy';
import { assetsKey, getAssetTransfers, getPayments, payKey } from '../../../data/explorer/money';
import { getQdnOfName, qdnNameKey } from '../../../data/explorer/qdnBy';
import { getMembers } from '../../../data/group';
import { loadMyStatus } from '../../../data/me';
import { loadNominationsFor } from '../../../data/nominations';
import { askedKey, getAskedAt } from '../../../data/readyToMint';
import type { AccountInfo } from '../../../data/types';
import { useQuery, type UseQueryResult } from '../../../hooks/useQuery';
import { sponseesOf } from '../../../rules/explorer/connections';
import {
  letterOf,
  pairFindings,
  pairsOf,
  sameFirstPayers,
  sameSponsors,
  sharedCounterparties,
  sharedGroups,
  sponsorOf,
  timelineEvents,
  timingRows,
  type CompareSide,
  type PairRef,
  type PairResult,
  type TimelineSide,
} from '../../../rules/explorer/compare';
import { usePayerBands } from '../account/connections/hooks';
import { useQueries } from './useQueries';

/** The heavy-read scope of the Compare page: leaving it drops what it queued. */
export const COMPARE_SCOPE = 'compare';

/** Shared payers whose band is read (each a few ms): the first ones listed. */
const BANDS_READ = 40;

export interface CompareFlags {
  /** The timeline or In common is near the screen. */
  below: boolean;
  /** Side by side is near the screen. */
  side: boolean;
}

export interface PairData {
  pair: PairRef;
  x: string;
  y: string;
  xy: UseQueryResult<PairPayments>;
  yx: UseQueryResult<PairPayments>;
  result: PairResult;
}

/** One entry per address, or null where `on` is false. */
function each<T>(
  addresses: ReadonlyArray<string | null>,
  key: (address: string, i: number) => string | null,
  load: (address: string, force: boolean, i: number) => Promise<T>
) {
  return addresses.map((address, i) => {
    if (!address) return null;
    const k = key(address, i);
    return k ? { key: k, load: (force: boolean) => load(address, force, i) } : null;
  });
}

export function useCompareData(addresses: readonly string[], flags: CompareFlags) {
  const explored = useQueries<ExploredAccount>(
    each(
      addresses,
      (a) => `xacct:${a}`,
      (a, force) => exploreAccount(a, { force })
    )
  );
  const accounts: Array<AccountInfo | null> = explored.map((q) =>
    q.data?.kind === 'account' ? q.data.account : null
  );
  /** The accounts Core knows, by position (null for the others). */
  const live = addresses.map((a, i) => (accounts[i] ? a : null));

  const primary = useQueries<string | null>(
    each(
      live,
      (a) => `name:${a}`,
      (a) => getPrimaryName(a)
    )
  );
  const status = useQueries(
    each(
      live,
      (a) => `status:${a}`,
      (a, force) => loadMyStatus(a, { force })
    )
  );
  const first = useQueries(
    each(
      live,
      (a) => `xfirst:${a}`,
      (a) => getFirstSeen(a)
    )
  );
  const groups = useQueries(
    each(
      live,
      (a) => `xgroups:${a}`,
      (a, force) => getGroupsOf(a, { force })
    )
  );
  const sent = useQueries(
    each(
      live,
      (a) => payKey(a, 'sent'),
      (a, force) => getPayments(a, 'sent', { force, scope: COMPARE_SCOPE })
    )
  );
  const recv = useQueries(
    each(
      live,
      (a) => payKey(a, 'recv'),
      (a, force) => getPayments(a, 'recv', { force, scope: COMPARE_SCOPE })
    )
  );
  const links = useQueries(
    each(
      live,
      (a) => linksKey(a),
      (a, force) => getLinks(a, { force, scope: COMPARE_SCOPE })
    )
  );
  const assets = useQueries(
    each(
      live,
      (a) => assetsKey(a),
      (a, force) => getAssetTransfers(a, { force, scope: COMPARE_SCOPE })
    )
  );
  const made = useQueries(
    each(
      live,
      (a) => `xmade:${a}`,
      (a, force) => loadMadeBy(a, { force })
    )
  );
  const trades = useQueries(
    each(
      live,
      (_, i) => (accounts[i]?.publicKey ? tradesKey(accounts[i].publicKey) : null),
      (_, force, i) => getTradesAsSeller(accounts[i]?.publicKey as string, { force })
    )
  );
  const online = useQuery(live.some(Boolean) ? 'xonline' : null, () => getOnline());

  // ---- pairs ---------------------------------------------------------------------------
  const pairs = pairsOf(addresses.length);
  const pairReads = useQueries(
    pairs.flatMap((pair) => {
      const x = live[pair.i];
      const y = live[pair.j];
      if (!x || !y) return [null, null];
      return [
        {
          key: pairKey(x, y),
          load: (force: boolean) => getPairPayments(x, y, { force, scope: COMPARE_SCOPE }),
        },
        {
          key: pairKey(y, x),
          load: (force: boolean) => getPairPayments(y, x, { force, scope: COMPARE_SCOPE }),
        },
      ];
    })
  );

  // ---- below the fold: the timeline and In common ------------------------------------------
  const below = flags.below ? live : live.map(() => null);
  const members = useQuery(flags.below && live.some(Boolean) ? 'group:members' : null, (force) =>
    getMembers({ force })
  );
  // A join request and nominations only for accounts outside MINTER: their status read
  // already brought both (their MINTER history), so these cost nothing more. A member's
  // joining comes from the member list instead of its history (up to 5 pages for an admin).
  const outside = below.map((a, i) => {
    const standing = status[i].data;
    return a && standing && !standing.isMember && !standing.isAdmin ? a : null;
  });
  const asked = useQueries(
    each(
      outside,
      (a) => askedKey(a),
      (a) => getAskedAt(a)
    )
  );
  const nominations = useQueries(
    each(
      outside,
      (a) => `nominations:for:${a}`,
      (a, force) => loadNominationsFor(a, { force })
    )
  );
  const primaryData = useQueries(
    each(
      below,
      (_, i) => (primary[i].data ? `xnamedata:${primary[i].data}` : null),
      (_, __, i) => getNameData(primary[i].data as string)
    )
  );

  // ---- Side by side ---------------------------------------------------------------------------
  const sideOn = flags.side ? live : live.map(() => null);
  const names = useQueries(
    each(
      sideOn,
      (a) => `xnames:${a}`,
      (a, force) => getNamesOf(a, { force })
    )
  );
  const balance = useQueries(
    each(
      sideOn,
      (a) => `balance:${a}`,
      (a, force) => getBalance(a, { force })
    )
  );
  const lastSent = useQueries(
    each(
      sideOn,
      (a, i) => (accounts[i]?.publicKey ? lastSentKey(a) : null),
      (a, force, i) => getLastSent(a, accounts[i]?.publicKey as string, { force })
    )
  );
  const qdn = useQueries(
    each(
      sideOn,
      (_, i) => (primary[i].data ? qdnNameKey(primary[i].data) : null),
      (_, force, i) => getQdnOfName(primary[i].data as string, { force })
    )
  );

  // ---- what the rules make of it ---------------------------------------------------------------
  const sides: CompareSide[] = addresses.map((address, i) => ({
    address,
    letter: letterOf(i),
    links: links[i].data,
    assets: assets[i].data,
    made: made[i].data,
    trades: accounts[i] ? (accounts[i].publicKey ? trades[i].data : null) : undefined,
    first: first[i].data,
    groups: groups[i].data,
    sent: sent[i].data,
    recv: recv[i].data,
  }));
  const liveSides = sides.filter((_, i) => live[i]);

  const pairData: PairData[] = pairs
    .filter((pair) => live[pair.i] && live[pair.j])
    .map((pair) => {
      const at = pairs.indexOf(pair) * 2;
      const xy = pairReads[at];
      const yx = pairReads[at + 1];
      return {
        pair,
        x: addresses[pair.i],
        y: addresses[pair.j],
        xy,
        yx,
        result: pairFindings({
          x: sides[pair.i],
          y: sides[pair.j],
          xy: xy.data,
          yx: yx.data,
          online: online.data,
        }),
      };
    });

  // Sponsors two or more share: their own links, for how many accounts they sponsored.
  const sharedSponsors = [
    ...new Set(
      sameSponsors(liveSides)
        .map((s) => s.sponsor)
        .filter(Boolean)
    ),
  ];
  const sponsorLinks = useQueries(
    sharedSponsors.map((sponsor) =>
      flags.below
        ? {
            key: linksKey(sponsor),
            load: (force: boolean) => getLinks(sponsor, { force, scope: COMPARE_SCOPE }),
          }
        : null
    )
  );
  const sponsorLinksBy = Object.fromEntries(
    sharedSponsors.map((sponsor, i) => [sponsor, sponsorLinks[i].data])
  );

  // Busy payers are left out once their bands are read; first, which bands to read.
  const counterpartiesAll = sharedCounterparties(liveSides);
  const firstPayers = sameFirstPayers(liveSides);
  const bandAddresses = flags.below
    ? [
        ...firstPayers.map((p) => p.from),
        ...counterpartiesAll.rows.slice(0, BANDS_READ).map((r) => r.address),
      ]
    : [];
  const bands: Record<string, PayerBand | undefined> = usePayerBands(bandAddresses);
  const counterparties = sharedCounterparties(liveSides, bands);

  const joined: Record<string, number | undefined> = {};
  for (const row of members.data?.members ?? [])
    if (live.includes(row.member) && typeof row.joined === 'number')
      joined[row.member] = row.joined;

  const timelineSides: TimelineSide[] = sides
    .filter((_, i) => live[i])
    .map((side) => {
      const i = addresses.indexOf(side.address);
      const name = primary[i].data;
      const record = primaryData[i].data;
      return {
        address: side.address,
        letter: side.letter,
        first: side.first,
        links: side.links,
        primary: name ? { name, registered: record?.registered } : null,
        askedAt: asked[i].data ?? null,
        joinedAt: joined[side.address] ?? null,
        nominatedBy: (nominations[i].data ?? []).flatMap((n) =>
          n.nomination ? [{ by: n.nomination.publisher.address, at: n.nomination.publishedAt }] : []
        ),
      };
    });

  return {
    addresses,
    explored,
    accounts,
    live,
    primary,
    status,
    first,
    groups,
    sent,
    recv,
    links,
    assets,
    made,
    trades,
    online,
    pairData,
    members,
    asked,
    nominations,
    primaryData,
    names,
    balance,
    lastSent,
    qdn,
    sides,
    liveSides,
    sponsors: sameSponsors(liveSides, sponsorLinksBy),
    sponsorLinks,
    firstPayers,
    bands,
    counterparties,
    groupsShared: sharedGroups(liveSides),
    timing: timingRows(liveSides, joined),
    timeline: timelineEvents(timelineSides),
    mintingNow: addresses.map((a, i) =>
      online.data && live[i] ? onlineSharesOf(online.data, a).length > 0 : undefined
    ),
    sponsorOf: sides.map((side) => sponsorOf(side)),
    /** How many accounts each one sponsored (undefined until its links are read). */
    parsedSponsees: sides.map((side) =>
      side.links ? sponseesOf(side.links.rows, side.address).length : undefined
    ),
  };
}

export type CompareData = ReturnType<typeof useCompareData>;
