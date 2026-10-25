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
 *
 * Once it has ended (and settled), its winner is checked against the chain
 * (auctions/confirm.ts): a bid Core confirmed later than it claims is left
 * out, and the next one is checked. Until then the result is "being
 * confirmed" and can't be paid.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNow } from "../hooks/useNow";
import { fetchBids } from "./bids";
import { lateWinningBids } from "./confirm";
import { auctionState, type AuctionState, type AuctionTerms, type Bid } from "./rules";

export const POLL_MS = 30_000;
export const POLL_NEAR_END_MS = 10_000;
export const NEAR_END_MS = 5 * 60_000;
export const SETTLE_MS = 3 * 60_000;
const MAX_BACKOFF_MS = 120_000;
const NONE: string[] = [];

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
  /** It has ended, and its winner is being checked against the chain. */
  confirming: boolean;
  /** Bids left out because the chain confirmed them later than they claim. */
  late: number;
  /** More bids than were read (over 1,000). */
  incomplete: boolean;
  /** Asking the node again failed; what's shown may be behind. */
  stale: boolean;
  /** How many bids were read, counted or not. */
  read: number;
  /** Bids published from here that the node doesn't list yet. */
  placed: Bid[];
  /** Reads the bids again past the cache: the result then (and whether every bid was read), or null when the node didn't answer. */
  refresh: () => Promise<{ state: AuctionState; complete: boolean } | null>;
  /** A bid just published from here. */
  notePlaced: (bid: Bid) => void;
}

/** How the bids are read: a product's by default; a name auction passes its own (names/auctions.ts). */
export type BidReader = (options: { fresh?: boolean }) => Promise<{ bids: Bid[]; complete: boolean }>;

/** `productId` keys the auction (a name auction's key is its own). */
export function useAuction(productId: string, terms: AuctionTerms, seller: string, reader?: BidReader): Auction {
  const now = useNow(1000);
  const [loaded, setLoaded] = useState<Loaded>({ key: "", status: "loading", bids: [], complete: true, stale: false });
  const [placed, setPlaced] = useState<Bid[]>([]);
  const current: Loaded = loaded.key === productId ? loaded : { key: productId, status: "loading", bids: [], complete: true, stale: false };

  const readBids = useMemo<BidReader>(() => reader ?? ((options) => fetchBids(productId, seller, options)), [reader, productId, seller]);
  const load = useCallback(
    async (fresh: boolean): Promise<{ bids: Bid[]; complete: boolean } | null> => {
      try {
        const read = await readBids({ fresh });
        setLoaded({ key: productId, status: "ready", bids: read.bids, complete: read.complete, stale: false });
        return read;
      } catch {
        setLoaded((prev) =>
          prev.key === productId && prev.status === "ready"
            ? { ...prev, stale: true }
            : { key: productId, status: "failed", bids: [], complete: true, stale: false }
        );
        return null;
      }
    },
    [productId, readBids]
  );

  // The first read may come from the session's cache (2 minutes); polls and refreshes don't.
  useEffect(() => {
    let cancelled = false;
    readBids({}).then(
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
  }, [productId, readBids]);

  // Winners the chain shows were placed late (checked once the auction has ended and settled).
  const [late, setLate] = useState<{ bids: Bid[] | null; ids: string[] }>({ bids: null, ids: [] });
  const lateIds = late.bids === current.bids ? late.ids : NONE;
  const checked = useMemo(() => (lateIds.length ? { ...terms, voided: [...(terms.voided ?? []), ...lateIds] } : terms), [terms, lateIds]);
  const state = auctionState(checked, current.bids, now, seller);
  const settling = state.phase === "ended" && now - state.end < SETTLE_MS;
  const checkWinner = state.phase === "ended" && !settling && current.status === "ready" && current.complete;
  const confirming = checkWinner && late.bids !== current.bids;
  useEffect(() => {
    if (!checkWinner) return;
    let alive = true;
    const bids = current.bids;
    lateWinningBids(terms, bids, seller, Date.now()).then(
      (ids) => alive && setLate({ bids, ids }),
      () => alive && setLate({ bids, ids: [] })
    );
    return () => {
      alive = false;
    };
  }, [checkWinner, current.bids, terms, seller]);
  // Past 1,000 rows the result can't be trusted (bidding and paying stop): no polling either.
  const watching = (state.phase === "live" || settling) && current.complete;
  const fast = settling || (state.phase === "live" && state.end - now < NEAR_END_MS);

  const lastRead = useRef(0);
  useEffect(() => {
    if (!watching) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reading = false;
    let failures = 0;
    let stopped = false;
    const every = fast ? POLL_NEAR_END_MS : POLL_MS;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    // One timer at a time: a read in flight schedules the next itself.
    const schedule = () => {
      clear();
      if (stopped || document.hidden) return;
      timer = setTimeout(tick, Math.min(MAX_BACKOFF_MS, every * 2 ** failures));
    };
    const tick = async () => {
      timer = undefined;
      reading = true;
      lastRead.current = Date.now();
      const read = await load(true);
      reading = false;
      failures = read ? 0 : failures + 1;
      schedule();
    };
    const onVisibility = () => {
      if (document.hidden) return clear();
      if (timer !== undefined || reading) return;
      // Back on the tab: read now if the last read is older than a poll, else wait for the next one.
      if (Date.now() - lastRead.current >= every) void tick();
      else schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [watching, fast, load]);

  const refresh = useCallback(async () => {
    lastRead.current = Date.now();
    const read = await load(true);
    return read ? { state: auctionState(checked, read.bids, Date.now(), seller), complete: read.complete } : null;
  }, [load, checked, seller]);

  const notePlaced = useCallback((bid: Bid) => setPlaced((prev) => [...prev.filter((b) => b.id !== bid.id), bid]), []);

  return {
    state,
    now,
    status: current.status,
    settling,
    confirming,
    late: lateIds.length,
    incomplete: !current.complete,
    stale: current.stale,
    read: current.bids.length,
    placed: placed.filter((p) => !current.bids.some((b) => b.id === p.id)),
    refresh,
    notePlaced,
  };
}
