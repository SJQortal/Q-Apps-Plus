/**
 * The Q-Assets an account holds, for the Explorer's Assets tab and the
 * Overview's quick list (Simon, 2026-10-21). What each asset is, its price
 * and its avatar come from rules/explorer/assets.ts. The reads, each kept a
 * while (none polls; the account page's Refresh reads them again):
 *
 * - its holdings: `/assets/balances?address=<a>&excludeZero=true`, 100 a
 *   page, up to 10 pages (`xholdings:<a>`);
 * - Core's asset list without each asset's data: `/assets`, 100 a page, up
 *   to 20 (`xassetlist`): every asset's owner, quantity and description in
 *   a read or two (93 assets on Qortal on 21 October 2026);
 * - their last trades with QORT: `/assets/trades/recent`, both ways round
 *   (Core files a trade under the initiating order's have-asset), 40
 *   assets a read (`xassetprices:<a>`);
 * - the asset avatars the Q-Assets app published: one search of IMAGE
 *   identifiers starting `asset`, 100 a page, up to 5 (`xassetavatars`);
 * - what buyers would pay now: each held asset's open buy orders,
 *   `/assets/openorders/0/<id>`, the best price first, the first 100
 *   (`xbids:<id>`), 4 assets at a time (`xassetsales:<a>`);
 * - when an asset is opened: its biggest holders, the first 100
 *   (`xholders:<id>`), its latest trades with QORT, both ways round, 10
 *   each (`xassetdeals:<id>`), and its cheapest sell offers, by price, the
 *   first 5 (`xasks:<id>`).
 *
 * Nothing here writes.
 */
import { getJson, getPaged, query, seg } from '../core';
import { fetchQuery } from '../query';
import { parseAtomic } from '../../rules/explorer/money';
import {
  assetMetaOf,
  avatarAssetId,
  buyOrderOf,
  dealOf,
  holdingOf,
  orderLevelOf,
  pricesFrom,
  QORT_ASSET_ID,
  recentTradeOf,
  saleNow,
  type AssetDeal,
  type AssetMeta,
  type AssetPrice,
  type AvatarResource,
  type BuyOrder,
  type Holding,
  type OrderLevel,
  type SaleNow,
} from '../../rules/explorer/assets';
import { runPool } from './sets';

const PAGE = 100;
const HOLDINGS_PAGES = 10;
const LIST_PAGES = 20;
const AVATAR_PAGES = 5;
/** Assets priced in one read of recent trades (each id is a parameter of the URL). */
const PRICE_CHUNK = 40;
/** An asset's biggest holders read when it is opened. */
export const HOLDERS_READ = 100;
/** An asset's latest trades read each way round when it is opened. */
export const DEALS_READ = 10;
/** An asset's open buy orders read, the best first; past these a sale says "at least". */
export const BIDS_READ = 100;
/** Sell offers shown when an asset is opened, by price level. */
export const ASKS_READ = 5;
const BOOKS_AT_ONCE = 4;
const TWO_MINUTES = 2 * 60_000;

const FIVE_MINUTES = 5 * 60_000;
const HALF_HOUR = 30 * 60_000;

export const holdingsKey = (address: string) => `xholdings:${address}`;
export const pricesKey = (address: string) => `xassetprices:${address}`;
export const holdersKey = (assetId: number) => `xholders:${assetId}`;
export const dealsKey = (assetId: number) => `xassetdeals:${assetId}`;
export const bidsKey = (assetId: number) => `xbids:${assetId}`;
export const asksKey = (assetId: number) => `xasks:${assetId}`;
export const salesKey = (address: string) => `xassetsales:${address}`;
export const ASSET_LIST_KEY = 'xassetlist';
export const ASSET_AVATARS_KEY = 'xassetavatars';

export interface Holdings {
  /** In Core's order (by asset); QORT left out. */
  rows: Holding[];
  /** It holds more than were read (over 1,000 assets). */
  truncated: boolean;
}

/** What the account holds, QORT left out. */
export function getHoldings(address: string, options: { force?: boolean } = {}): Promise<Holdings> {
  return fetchQuery(
    holdingsKey(address),
    async () => {
      const read = await getPaged<unknown>(
        (offset, limit) =>
          `/assets/balances?${query({ address, excludeZero: true, limit, offset })}`,
        { pageSize: PAGE, maxPages: HOLDINGS_PAGES }
      );
      return {
        rows: read.rows.map(holdingOf).filter((h): h is Holding => h !== null),
        truncated: read.truncated,
      };
    },
    { ttlMs: FIVE_MINUTES, force: options.force }
  );
}

/** Every asset on Qortal, by id, without its data. */
export function getAssetList(options: { force?: boolean } = {}): Promise<Map<number, AssetMeta>> {
  return fetchQuery(
    ASSET_LIST_KEY,
    async () => {
      const read = await getPaged<unknown>(
        (offset, limit) => `/assets?${query({ includeData: false, limit, offset })}`,
        { pageSize: PAGE, maxPages: LIST_PAGES }
      );
      const list = new Map<number, AssetMeta>();
      for (const row of read.rows) {
        const asset = assetMetaOf(row);
        if (asset) list.set(asset.assetId, asset);
      }
      return list;
    },
    { ttlMs: HALF_HOUR, force: options.force }
  );
}

/** The last trade with QORT of each of these assets (the account's holdings), by asset id. */
export function getAssetPrices(
  address: string,
  assetIds: readonly number[],
  options: { force?: boolean } = {}
): Promise<Map<number, AssetPrice>> {
  return fetchQuery(
    pricesKey(address),
    async () => {
      const ids = [...new Set(assetIds)].filter((id) => id !== QORT_ASSET_ID);
      const reads: Promise<unknown>[] = [];
      for (let i = 0; i < ids.length; i += PRICE_CHUNK) {
        const chunk = ids.slice(i, i + PRICE_CHUNK);
        // At most two trades per pair: the asset's own sales, then its buys with QORT.
        const limit = chunk.length * 2;
        reads.push(
          getJson(`/assets/trades/recent?${query({ assetid: chunk, otherassetid: 0, limit })}`),
          getJson(`/assets/trades/recent?${query({ assetid: 0, otherassetid: chunk, limit })}`)
        );
      }
      const answers = await Promise.all(reads);
      return pricesFrom(
        answers
          .flatMap((body) => (Array.isArray(body) ? body : []))
          .map(recentTradeOf)
          .filter((trade) => trade !== null)
      );
    },
    { ttlMs: FIVE_MINUTES, force: options.force }
  );
}

/** Every IMAGE that may be an asset's avatar (`asset<id>_<name>_aavatar`), by asset id. */
export function getAssetAvatars(
  options: { force?: boolean } = {}
): Promise<Map<number, AvatarResource[]>> {
  return fetchQuery(
    ASSET_AVATARS_KEY,
    async () => {
      const read = await getPaged<unknown>(
        (offset, limit) =>
          `/arbitrary/resources/search?${query({
            service: 'IMAGE',
            identifier: 'asset',
            prefix: true,
            mode: 'ALL',
            excludeblocked: true,
            limit,
            offset,
          })}`,
        { pageSize: PAGE, maxPages: AVATAR_PAGES }
      );
      const byAsset = new Map<number, AvatarResource[]>();
      for (const row of read.rows) {
        if (!row || typeof row !== 'object') continue;
        const { name, identifier } = row as { name?: unknown; identifier?: unknown };
        if (typeof name !== 'string' || typeof identifier !== 'string') continue;
        const assetId = avatarAssetId(identifier);
        if (assetId === null) continue;
        byAsset.set(assetId, [...(byAsset.get(assetId) ?? []), { publisher: name, identifier }]);
      }
      return byAsset;
    },
    { ttlMs: HALF_HOUR, force: options.force }
  );
}

export interface Holder {
  address: string;
  balance: bigint;
}

export interface Holders {
  /** The biggest first. */
  rows: Holder[];
  /** There are more than were read. */
  truncated: boolean;
}

/** An asset's biggest holders, the first HOLDERS_READ. */
export function getTopHolders(
  assetId: number,
  options: { force?: boolean } = {}
): Promise<Holders> {
  return fetchQuery(
    holdersKey(assetId),
    async () => {
      const body = await getJson<unknown>(
        `/assets/balances?${query({
          assetid: assetId,
          ordering: 'ASSET_BALANCE_ACCOUNT',
          reverse: true,
          limit: HOLDERS_READ,
        })}`
      );
      const rows = (Array.isArray(body) ? body : [])
        .map((row) => {
          const r = (row ?? {}) as Record<string, unknown>;
          const balance = parseAtomic(r.balance);
          return typeof r.address === 'string' && balance ? { address: r.address, balance } : null;
        })
        .filter((row): row is Holder => row !== null);
      return { rows, truncated: rows.length >= HOLDERS_READ };
    },
    { ttlMs: FIVE_MINUTES, force: options.force }
  );
}

/** An asset's latest trades with QORT, both ways round, newest first. */
export function getAssetDeals(
  assetId: number,
  options: { force?: boolean } = {}
): Promise<AssetDeal[]> {
  return fetchQuery(
    dealsKey(assetId),
    async () => {
      const params = query({ limit: DEALS_READ, reverse: true });
      const [sold, bought] = await Promise.all([
        getJson<unknown>(`/assets/trades/${seg(assetId)}/${QORT_ASSET_ID}?${params}`),
        getJson<unknown>(`/assets/trades/${QORT_ASSET_ID}/${seg(assetId)}?${params}`),
      ]);
      return [sold, bought]
        .flatMap((body) => (Array.isArray(body) ? body : []))
        .map(dealOf)
        .filter((deal): deal is AssetDeal => deal !== null)
        .sort((a, b) => b.at - a.at)
        .slice(0, DEALS_READ);
    },
    { ttlMs: FIVE_MINUTES, force: options.force }
  );
}

export interface BuyOrders {
  /** The best price first. */
  orders: BuyOrder[];
  /** Core has more than were read. */
  truncated: boolean;
}

/** An asset's open buy orders (QORT offered for it), the best price first, the first BIDS_READ. */
export function getBuyOrders(
  assetId: number,
  options: { force?: boolean } = {}
): Promise<BuyOrders> {
  return fetchQuery(
    bidsKey(assetId),
    async () => {
      const body = await getJson<unknown>(
        `/assets/openorders/${QORT_ASSET_ID}/${seg(assetId)}?${query({
          limit: BIDS_READ,
          reverse: true,
        })}`
      );
      const rows = Array.isArray(body) ? body : [];
      return {
        orders: rows.map(buyOrderOf).filter((order): order is BuyOrder => order !== null),
        truncated: rows.length >= BIDS_READ,
      };
    },
    { ttlMs: TWO_MINUTES, force: options.force }
  );
}

/** What buyers would pay now for each holding, by asset id; one book failing fails them all. */
export function getAssetSales(
  address: string,
  holdings: readonly Holding[],
  options: { force?: boolean } = {}
): Promise<Map<number, SaleNow>> {
  return fetchQuery(
    salesKey(address),
    async () => {
      const sales = new Map<number, SaleNow>();
      const held = holdings.filter((h) => h.assetId !== QORT_ASSET_ID);
      await runPool(held, BOOKS_AT_ONCE, async (holding) => {
        const book = await getBuyOrders(holding.assetId, { force: options.force });
        sales.set(holding.assetId, saleNow(holding.balance, book.orders, address, book.truncated));
      });
      return sales;
    },
    { ttlMs: TWO_MINUTES, force: options.force }
  );
}

/** An asset's cheapest sell offers (it offered for QORT), by price level, the first ASKS_READ. */
export function getSellOffers(
  assetId: number,
  options: { force?: boolean } = {}
): Promise<OrderLevel[]> {
  return fetchQuery(
    asksKey(assetId),
    async () => {
      const body = await getJson<unknown>(
        `/assets/orderbook/${seg(assetId)}/${QORT_ASSET_ID}?${query({ limit: ASKS_READ })}`
      );
      return (Array.isArray(body) ? body : [])
        .map(orderLevelOf)
        .filter((level): level is OrderLevel => level !== null);
    },
    { ttlMs: TWO_MINUTES, force: options.force }
  );
}
