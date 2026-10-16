/**
 * Core's own sponsorship report (`/addresses/sponsorship/{a}`): 1 to 5
 * seconds a read, so only on request, through the heavy-read limiter, and
 * kept for the session (`xsponsor:<a>`). What its numbers really count is
 * said in rules/explorer/connections.ts sponsorReportLines: Core counts
 * names, not accounts, and its transfer counts include what was received.
 */
import { getJson, seg } from '../core';
import { heavyQuery } from './heavy';

export interface SponsorshipReport {
  address: string;
  level: number;
  blocksMinted: number;
  adjustments: number;
  penalties: number;
  /** It sent or received a minting level (Core doesn't say which). */
  transfer: boolean;
  /** Every name of every sponsee, in no order. */
  names: string[];
  /** Distinct accounts it ever made a reward share to (removed ones included). */
  sponseeCount: number;
  /** Core's sponseeCount minus the number of names: not a count of accounts. */
  nonRegisteredCount: number;
  /** Average QORT balance of the sponsees that have one, whole QORT. */
  avgBalance: number;
  arbitraryCount: number;
  transferAssetCount: number;
  transferPrivsCount: number;
  sellCount: number;
  sellAmount: number;
  buyCount: number;
  buyAmount: number;
}

export const sponsorKey = (address: string) => `xsponsor:${address}`;

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function parseSponsorshipReport(body: unknown, address: string): SponsorshipReport {
  const row = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    address: typeof row.address === 'string' ? row.address : address,
    level: num(row.level),
    blocksMinted: num(row.blocksMinted),
    adjustments: num(row.adjustments),
    penalties: num(row.penalties),
    transfer: row.transfer === true,
    names: Array.isArray(row.names)
      ? row.names.filter((name): name is string => typeof name === 'string')
      : [],
    sponseeCount: num(row.sponseeCount),
    nonRegisteredCount: num(row.nonRegisteredCount),
    avgBalance: num(row.avgBalance),
    arbitraryCount: num(row.arbitraryCount),
    transferAssetCount: num(row.transferAssetCount),
    transferPrivsCount: num(row.transferPrivsCount),
    sellCount: num(row.sellCount),
    sellAmount: num(row.sellAmount),
    buyCount: num(row.buyCount),
    buyAmount: num(row.buyAmount),
  };
}

/** Core's report on the accounts `address` sponsored (heavy; on request only). */
export function getSponsorshipReport(
  address: string,
  options: { force?: boolean } = {}
): Promise<SponsorshipReport> {
  return heavyQuery(
    address,
    sponsorKey(address),
    async () =>
      parseSponsorshipReport(
        await getJson<unknown>(`/addresses/sponsorship/${seg(address)}`),
        address
      ),
    { ttlMs: 30 * 60_000, force: options.force }
  );
}
