/**
 * What a Q-Asset is worth in QORT, so prices and delivery can be paid in it
 * (Simon, 2026-10-26: "make sure user can add to pay delivery in q-asset as
 * well, also add option to fetch the q-asset prices from the q-asset trade
 * portal … or allow user to add those prices manually"). Each accepted asset
 * says, on its own `acceptedAssets` entry (additive `price`):
 * - nothing: buyers pay it only for products the seller priced in it (as before);
 * - `{ from: "market" }`: the trade portal's price, read from the node
 *   (the latest QORT trade, else the lowest offer to sell);
 * - `{ from: "seller", qort }`: the seller's own, one unit = `qort` QORT.
 * Other prices (and delivery) then convert from QORT at that rate. An
 * indivisible asset's converted prices round up to whole units, so Core
 * takes the payment (money/pricing.ts).
 */
import { assetInfo } from "../qdn/assets";

export type AssetPricing = { from: "market" } | { from: "seller"; qort: number };

/** Up to 8 decimals of QORT per unit, as the trade portal quotes them. */
export const MAX_ASSET_QORT = 1e9;

/** A price setting as stored, read tolerantly (anything else: none). */
export function assetPricingOf(raw: unknown): AssetPricing | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { from, qort } = raw as { from?: unknown; qort?: unknown };
  if (from === "market") return { from: "market" };
  if (from === "seller" && typeof qort === "number" && Number.isFinite(qort) && qort > 0 && qort <= MAX_ASSET_QORT) return { from: "seller", qort };
  return undefined;
}

export interface AssetQuote {
  /** QORT for one unit. */
  qort: number;
  /** "trade": the latest trade; "offer": the lowest price someone sells at (no trades yet). */
  source: "trade" | "offer";
  /** When the trade was (ms), for "trade". */
  at?: number;
}

export const QUOTE_TTL_MS = 5 * 60_000;
const quotes = new Map<number, { quote: AssetQuote | null; at: number }>();
const inflight = new Map<number, Promise<AssetQuote | null>>();

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  return response.json();
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The trade portal's price of an asset in QORT, from the node: its latest
 * trade with QORT either way (Core files a trade under the initiating
 * order's asset, so both directions are read), else the lowest ask. Null
 * when it has neither. Cached for a few minutes, one request at a time.
 */
export function fetchAssetQuote(assetId: number, options: { fresh?: boolean } = {}): Promise<AssetQuote | null> {
  const hit = quotes.get(assetId);
  if (!options.fresh && hit && Date.now() - hit.at < QUOTE_TTL_MS) return Promise.resolve(hit.quote);
  const pending = inflight.get(assetId);
  if (pending) return pending;
  const request = (async (): Promise<AssetQuote | null> => {
    const [boughtWithQort, soldForQort] = await Promise.all([
      getJson(`/assets/trades/recent?assetid=0&otherassetid=${assetId}&limit=1`),
      getJson(`/assets/trades/recent?assetid=${assetId}&otherassetid=0&limit=1`),
    ]);
    const trades: { qort: number; at: number }[] = [];
    // The initiator gave `amount` of its asset; the other side gave `otherAmount`.
    for (const t of Array.isArray(boughtWithQort) ? boughtWithQort : []) {
      const qortGiven = num(t?.amount);
      const units = num(t?.otherAmount);
      if (qortGiven && units) trades.push({ qort: qortGiven / units, at: Number(t.timestamp) || 0 });
    }
    for (const t of Array.isArray(soldForQort) ? soldForQort : []) {
      const units = num(t?.amount);
      const qortGiven = num(t?.otherAmount);
      if (qortGiven && units) trades.push({ qort: qortGiven / units, at: Number(t.timestamp) || 0 });
    }
    let quote: AssetQuote | null = null;
    if (trades.length > 0) {
      const latest = trades.reduce((a, b) => (b.at > a.at ? b : a));
      quote = { qort: latest.qort, source: "trade", at: latest.at };
    } else {
      const asks = await getJson(`/assets/orderbook/${assetId}/0?limit=1`);
      const lowest = Array.isArray(asks) ? num(asks[0]?.price) : null;
      if (lowest) quote = { qort: lowest, source: "offer" };
    }
    quotes.set(assetId, { quote, at: Date.now() });
    return quote;
  })();
  inflight.set(assetId, request);
  const forget = () => {
    if (inflight.get(assetId) === request) inflight.delete(assetId);
  };
  request.then(forget, forget);
  return request;
}

/** Indivisible assets seen this session: their converted prices round up to whole units. */
const wholeAssets = new Set<number>();

export function isWholeAsset(assetId: number): boolean {
  return wholeAssets.has(assetId);
}

export interface AssetRate {
  /** Units per QORT, as money/pricing.ts takes a rate. */
  rate: number;
  qort: number;
  source: "trade" | "offer" | "seller";
}

/**
 * The rate to price `assetId` at under `pricing`, once the node has said
 * whether the asset is divisible; null when the setting is none or the
 * trade portal has no price. Rejects when the node can't be asked.
 */
export async function assetRate(assetId: number, pricing: AssetPricing | undefined): Promise<AssetRate | null> {
  if (!pricing) return null;
  const [info, quote] = await Promise.all([
    assetInfo({ id: assetId }).catch(() => null),
    pricing.from === "market" ? fetchAssetQuote(assetId) : Promise.resolve(null),
  ]);
  if (info?.isDivisible === false) wholeAssets.add(assetId);
  const qort = pricing.from === "seller" ? pricing.qort : quote?.qort;
  if (!qort) return null;
  return { rate: 1 / qort, qort, source: pricing.from === "seller" ? "seller" : quote!.source };
}

/** For tests. */
export function resetAssetRates(): void {
  quotes.clear();
  inflight.clear();
  wholeAssets.clear();
}
