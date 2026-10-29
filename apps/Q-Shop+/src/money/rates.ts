/**
 * One shared, cached exchange rate per coin, from the node only
 * (`/crosschain/price/<BLOCKCHAIN>?maxtrades=10&inverse=true`, Core's estimate
 * from recent Trade Portal trades: foreign coin per QORT × 1e8). The original
 * fetched ARRR's rate separately in the shop page, the product page and the
 * always-mounted cart, uncached; here every screen shares one request per
 * coin, kept for a few minutes.
 */
import { COINS, isForeignTicker } from "./coins";

export const RATE_TTL_MS = 5 * 60_000;

const cache = new Map<string, { rate: number; at: number }>();
const inflight = new Map<string, Promise<number>>();

export function rateUrl(blockchain: string): string {
  return `/crosschain/price/${blockchain}?maxtrades=10&inverse=true`;
}

/** Parses the node's answer the way the original does: `+text / 1e8`, NaN rejected. */
export function parseRate(text: string): number {
  const ratio = +text / 100000000;
  if (isNaN(ratio)) throw new Error("Cannot get exchange rate");
  return ratio;
}

/**
 * Foreign coin per QORT for `coin`, from cache when fresh. Rejects for QORT,
 * assets and unknown coins (they have no rate), and when the node can't say;
 * a rate of 0 (no recent trades) also rejects, since nothing can be priced
 * with it.
 */
export async function getRate(coin: string, options: { fresh?: boolean } = {}): Promise<number> {
  if (!isForeignTicker(coin)) throw new Error(`No exchange rate for ${coin}`);
  const blockchain = COINS[coin].blockchain as string;
  const hit = cache.get(coin);
  if (!options.fresh && hit && Date.now() - hit.at < RATE_TTL_MS) return hit.rate;
  const pending = inflight.get(coin);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(rateUrl(blockchain), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const text = await response.text();
    if (!response.ok) throw new Error("Cannot get exchange rate");
    const rate = parseRate(text);
    if (!(rate > 0)) throw new Error("Cannot get exchange rate");
    cache.set(coin, { rate, at: Date.now() });
    return rate;
  })();
  inflight.set(coin, request);
  const forget = () => {
    if (inflight.get(coin) === request) inflight.delete(coin);
  };
  request.then(forget, forget);
  return request;
}

/** The cached rate if one is fresh, without asking the node. */
export function cachedRate(coin: string): number | null {
  const hit = cache.get(coin);
  return hit && Date.now() - hit.at < RATE_TTL_MS ? hit.rate : null;
}

/** For tests. */
export function resetRates(): void {
  cache.clear();
  inflight.clear();
}
