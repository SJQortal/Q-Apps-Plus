/**
 * The Names page's list: every name for sale on chain (names/market.ts) and
 * every name auction still held by its seller (names/auctions.ts), as one
 * list. A name at a price and in an auction is one item (its auction, with
 * the price beside it). An auction stays listed for a week after it ends,
 * so its winner finds it to buy the name; after that, or once the name has
 * changed hands, it is gone.
 *
 * Reads: the listings (pages of 100), the auctions' search, the latest
 * SELL_NAME transactions (for Newest), and one `/names/<name>` per auction
 * (four at a time) to check its seller still owns it.
 */
import { useCallback, useEffect, useState } from "react";
import { mapWithConcurrency } from "../qdn/search";
import { fetchListingTimes, fetchNameState, fetchNamesForSale, type NameState } from "./market";
import { fetchNameAuctions, type NameAuction } from "./auctions";

export const ENDED_AUCTION_SHOWN_MS = 7 * 86_400_000;

export interface MarketItem {
  name: string;
  /** Its price on chain, when it's for sale at one (BUY_NAME). */
  price: number | null;
  /** The seller's address. */
  owner: string;
  auction: NameAuction | null;
  /** When it was listed, as far as the node says (0: long ago). */
  listedAt: number;
  registered?: number;
}

export interface NamesMarket {
  status: "loading" | "ready" | "error";
  items: MarketItem[];
  /** False when there were more listings than were read (2,000). */
  complete: boolean;
  reload: (fresh?: boolean) => void;
}

/** One list from the listings and the auctions (the auctions already checked against their names' owners). */
export function marketItems(
  listings: { name: string; owner: string; price: number; registered?: number }[],
  auctions: { auction: NameAuction; state: NameState | null }[],
  times: ReadonlyMap<string, number>,
  now: number
): MarketItem[] {
  const items = new Map<string, MarketItem>();
  for (const listing of listings) {
    items.set(listing.name, { name: listing.name, price: listing.price, owner: listing.owner, auction: null, listedAt: times.get(listing.name) ?? 0, ...(listing.registered && { registered: listing.registered }) });
  }
  for (const { auction, state } of auctions) {
    // Only while its seller still holds the name, and for a week after it ends.
    if (!state || state.owner !== auction.owner || now > auction.terms.end + ENDED_AUCTION_SHOWN_MS) continue;
    const listed = items.get(auction.name);
    items.set(auction.name, {
      name: auction.name,
      price: state.forSale ? state.price : null,
      owner: auction.owner,
      auction,
      listedAt: Math.max(auction.created, listed?.listedAt ?? 0),
      ...(listed?.registered && { registered: listed.registered }),
    });
  }
  return [...items.values()];
}

export function useNamesMarket(): NamesMarket {
  const [state, setState] = useState<{ status: NamesMarket["status"]; items: MarketItem[]; complete: boolean }>({ status: "loading", items: [], complete: true });
  const [nonce, setNonce] = useState({ n: 0, fresh: false });

  useEffect(() => {
    let alive = true;
    const fresh = nonce.fresh;
    (async () => {
      const [forSale, auctions, times] = await Promise.all([
        fetchNamesForSale({ fresh }),
        fetchNameAuctions({ fresh }).catch(() => [] as NameAuction[]),
        fetchListingTimes().catch(() => new Map<string, number>()),
      ]);
      const now = Date.now();
      const recent = auctions.filter((a) => now <= a.terms.end + ENDED_AUCTION_SHOWN_MS);
      const states = await mapWithConcurrency(recent, 4, (a) => fetchNameState(a.name));
      if (!alive) return;
      setState({
        status: "ready",
        items: marketItems(forSale.listings, recent.map((auction, i) => ({ auction, state: states[i] ?? null })), times, now),
        complete: forSale.complete,
      });
    })().catch(() => {
      if (alive) setState((prev) => ({ ...prev, status: prev.items.length > 0 ? "ready" : "error" }));
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback((fresh = true) => setNonce((prev) => ({ n: prev.n + 1, fresh })), []);
  return { ...state, reload };
}
