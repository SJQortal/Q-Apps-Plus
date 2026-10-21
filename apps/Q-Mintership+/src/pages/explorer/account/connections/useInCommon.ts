/**
 * What Connections → In common reads, once it nears the screen: where the
 * account's first QORT came from (xfirst:<a>), how busy a payer that
 * account is (xbusy:<a>), and its sponsor's own links (xlinks:<sponsor>,
 * heavy, scoped to this page so leaving drops it if not started), for the
 * accounts the same sponsor sponsored.
 */
import { getFirstSeen, getPayerBand } from '../../../../data/explorer/account';
import { getLinks } from '../../../../data/explorer/links';
import { useQuery } from '../../../../hooks/useQuery';
import { monthRange, sponseesOf, type Links } from '../../../../rules/explorer/connections';

export function useInCommon(address: string, links: Links | null, on: boolean) {
  const first = useQuery(on ? `xfirst:${address}` : null, () => getFirstSeen(address));
  const sponsor = links?.sponsors[0]?.sponsor ?? null;
  const sponsorLinks = useQuery(on && sponsor ? `xlinks:${sponsor}` : null, (force) =>
    getLinks(sponsor as string, { force, scope: address })
  );
  const funder = first.data?.funding?.from ?? null;
  const band = useQuery(funder?.startsWith('Q') ? `xbusy:${funder}` : null, () =>
    getPayerBand(funder as string)
  );
  const all = sponsor && sponsorLinks.data ? sponseesOf(sponsorLinks.data.rows, sponsor) : null;
  const siblings = all ? all.filter((s) => s.address !== address).length : null;
  const starts = (all ?? []).map((s) => s.start.timestamp);
  return {
    first,
    sponsor,
    sponsorLinks,
    /** The other accounts its sponsor sponsored (null until read). */
    siblings,
    /** When the sponsor's shares started, first to last ("May 2023 – Mar 2025"). */
    siblingsSpan: starts.length ? monthRange(Math.min(...starts), Math.max(...starts)) : '',
    /** The sponsor's links were capped, so there may be more. */
    siblingsCapped: Boolean(sponsorLinks.data?.truncated),
    band: band.data,
  };
}

export type InCommonData = ReturnType<typeof useInCommon>;
