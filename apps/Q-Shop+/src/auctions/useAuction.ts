/**
 * An auction as its product page shows it: the bids on QDN (auctions/bids.ts),
 * the result so far by the rules (auctions/rules.ts), and bids placed from
 * here that the node doesn't list yet.
 *
 * While it runs, the bids are read again every 30 s, every 10 s in its last
 * 5 minutes, and for 3 minutes after it ends (`settling`: a bid placed in the
 * last seconds can take that long to be listed, and could still win or
 * extend it). Only while the tab is shown, backing off to 2 minutes while
 * the node doesn't answer. Before and after that, the bids are read once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNow } from "../hooks/useNow";
import { fetchBids } from "./bids";
import { auctionState, type AuctionState, type AuctionTerms, type Bid } from "./rules";

export const POLL_MS = 30_000;
export const POLL_NEAR_END_MS = 10_000;
export const NEAR_END_MS = 5 * 60_000;
export const SETTLE_MS = 3 * 60_000;
const MAX_BACKOFF_MS = 120_000;

type LoadStatus = "loading" | "ready" | "failed";

interface Loaded {
  key: string;
  status: LoadStatus;
  bids: Bid[];
  complete: boolean;
  /** The last read again failed (the bids shown are the ones before). */
  stale: boolean;
}

export interface Auction {
  state: AuctionState;
  now: number;
  status: LoadStatus;
  /** It ended under 3 minutes ago: late bids may still be listed. */
  settling: boolean;
  /** More bids than were read (over 1,000). */
  incomplete: boolean;
  /** Asking the node again failed; what's shown may be behind. */
  stale: boolean;
  /** How many bids were read, counted or not. */
  read: number;
  /** Bids published from here that the node doesn't list yet. */
  placed: Bid[];
  /** Reads the bids again past the cache: the result then, or null when the node didn't answer. */
  refresh: () => Promise<AuctionState | null>;
  /** A bid just published from here. */
  notePlaced: (bid: Bid) => void;
}

export function useAuction(productId: string, terms: AuctionTerms, seller: string): Auction {
  const now = useNow(1000);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", status: "loading", bids: [], complete: true, stale: false });
  const [placed, setPlaced] = useState<Bid[]>([]);
  const current: Loaded = loaded.key === productId ? loaded : { key: productId, status: "loading", bids: [], complete: true, stale: false };

  const load = useCallback(
    async (fresh: boolean): Promise<Bid[] | null> => {
      try {
        const { bids, complete } = await fetchBids(productId, { fresh });
        setLoaded({ key: productId, status: "ready", bids, complete, stale: false });
        return bids;
      } catch {
        setLoaded((prev) =>
          prev.key === productId && prev.status === "ready"
            ? { ...prev, stale: true }
            : { key: productId, status: "failed", bids: [], complete: true, stale: false }
        );
        return null;
      }
    },
    [productId]
  );

  // The first read may come from the session's cache (2 minutes); polls and refreshes don't.
  useEffect(() => {
    let cancelled = false;
    fetchBids(productId).then(
      ({ bids, complete }) => {
        if (!cancelled) setLoaded({ key: productId, status: "ready", bids, complete, stale: false });
      },
      () => {
        if (!cancelled) setLoaded({ key: productId, status: "failed", bids: [], complete: true, stale: false });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const state = auctionState(terms, current.bids, now, seller);
  const settling = state.phase === "ended" && now - state.end < SETTLE_MS;
  const watching = state.phase === "live" || settling;
  const fast = settling || (state.phase === "live" && state.end - now < NEAR_END_MS);

  const lastRead = useRef(0);
  useEffect(() => {
    if (!watching) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;
    const every = fast ? POLL_NEAR_END_MS : POLL_MS;
    const schedule = () => {
      if (stopped || document.hidden) return;
      timer = setTimeout(tick, Math.min(MAX_BACKOFF_MS, every * 2 ** failures));
    };
    const tick = async () => {
      timer = undefined;
      lastRead.current = Date.now();
      const bids = await load(true);
      failures = bids ? 0 : failures + 1;
      schedule();
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
        return;
      }
      if (timer !== undefined) return;
      // Back on the tab: read now if the last read is older than a poll, else wait for the next one.
      if (Date.now() - lastRead.current >= every) void tick();
      else schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [watching, fast, load]);

  const refresh = useCallback(async () => {
    lastRead.current = Date.now();
    const bids = await load(true);
    return bids ? auctionState(terms, bids, Date.now(), seller) : null;
  }, [load, terms, seller]);

  const notePlaced = useCallback((bid: Bid) => setPlaced((prev) => [...prev.filter((b) => b.id !== bid.id), bid]), []);

  return {
    state,
    now,
    status: current.status,
    settling,
    incomplete: !current.complete,
    stale: current.stale,
    read: current.bids.length,
    placed: placed.filter((p) => !current.bids.some((b) => b.id === p.id)),
    refresh,
    notePlaced,
  };
}
