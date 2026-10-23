/**
 * Auctions (Simon, 2026-10-23, after the auctions of his Qortal Web Builder's
 * Q-Shop block): a product sold to the highest bidder, in QORT.
 *
 * The terms live on the product, additive (docs/apps/Q-Shop+.md → Data
 * contract): `auction: {v: 1, start, end, startingBid, reserve?, buyNow?,
 * extendMinutes}`. Bids are documents the bidders publish under their own
 * names (auctions/bids.ts). Everyone works out the same result from the same
 * bids with these rules, so there is no auctioneer:
 *
 * - Only what Core vouches for counts: who published the bid (its name) and
 *   when (Core's `created`). A bid changed after it was placed doesn't count
 *   (`edited`), nor one by the seller, one before the start or after the end.
 * - Bids are taken in the order they were placed. Each must reach the
 *   minimum at that moment: the starting bid, then the leading bid plus a
 *   step (`bidStep`). A lower one doesn't count.
 * - A bid in the last `extendMinutes` moves the end to that many minutes
 *   after it (no last-second sniping). 0 turns this off.
 * - A bid at or above the buy-now price wins at once: the auction ends there.
 * - At the end the leading bid wins, if it reaches the reserve (when there is
 *   one; the reserve's amount isn't shown to bidders, only whether it's met).
 */

export interface AuctionTerms {
  v: 1;
  /** When bidding opens (ms). */
  start: number;
  /** When it closes, before any extension (ms). */
  end: number;
  /** The lowest first bid, in QORT. */
  startingBid: number;
  /** The least the seller sells for, in QORT; none: any bid wins. */
  reserve?: number;
  /** A bid of at least this wins at once, in QORT. */
  buyNow?: number;
  /** Late bids move the end this many minutes past them; 0: off. */
  extendMinutes: number;
}

export interface Bid {
  /** Its QDN identifier. */
  id: string;
  /** The name that published it. */
  bidder: string;
  amount: number;
  /** Core's time for it (ms). */
  created: number;
  /** Changed since it was placed: it doesn't count. */
  edited?: boolean;
}

export type AuctionPhase = "upcoming" | "live" | "ended";

export interface AuctionState {
  phase: AuctionPhase;
  /** When it ends (or ended), with every extension and a buy-now. */
  end: number;
  /** The bids that count, in the order they were placed. */
  accepted: Bid[];
  /** The leading bid. */
  high: Bid | null;
  /** The least the next bid can be. */
  minNext: number;
  /** A buy-now bid ended it. */
  boughtNow: boolean;
  /** The leading bid reaches the reserve (true when there is none). */
  reserveMet: boolean;
  /** Who won, once it ended (null: no bids, or the reserve wasn't met). */
  winner: Bid | null;
}

export const DEFAULT_EXTEND_MINUTES = 5;
export const MAX_AUCTION_DAYS = 60;
const EPSILON = 1e-9;

/** QORT amounts kept to 8 decimals, as payments are. */
export function roundQort(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

/** The least a bid must beat the leading one by: a step that grows with the price. */
export function bidStep(high: number): number {
  if (high < 1) return 0.01;
  if (high < 10) return 0.1;
  if (high < 100) return 0.5;
  if (high < 1000) return 1;
  if (high < 10000) return 5;
  return 10;
}

/** The least the next bid can be after `high` (none yet: the starting bid). */
export function minimumBid(terms: Pick<AuctionTerms, "startingBid">, high: number | null): number {
  if (high === null) return roundQort(terms.startingBid);
  return roundQort(high + bidStep(high));
}

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** A product's auction terms, when it has usable ones (anyone can publish a product). */
export function auctionTermsOf(product: unknown): AuctionTerms | null {
  const raw = (product as { auction?: unknown } | null)?.auction as Partial<AuctionTerms> | undefined;
  if (!raw || typeof raw !== "object") return null;
  if (!positive(raw.start) || !positive(raw.end) || raw.end <= raw.start || !positive(raw.startingBid)) return null;
  const extend = typeof raw.extendMinutes === "number" && Number.isFinite(raw.extendMinutes) ? Math.max(0, Math.min(60, Math.floor(raw.extendMinutes))) : DEFAULT_EXTEND_MINUTES;
  return {
    v: 1,
    start: raw.start,
    end: raw.end,
    startingBid: roundQort(raw.startingBid),
    ...(positive(raw.reserve) && { reserve: roundQort(raw.reserve) }),
    ...(positive(raw.buyNow) && raw.buyNow > raw.startingBid && { buyNow: roundQort(raw.buyNow) }),
    extendMinutes: extend,
  };
}

/** The result so far (see above). `seller`'s own bids never count. */
export function auctionState(terms: AuctionTerms, bids: readonly Bid[], now: number, seller: string): AuctionState {
  const ordered = [...bids].sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
  const extendMs = terms.extendMinutes * 60_000;
  let end = terms.end;
  let high: Bid | null = null;
  let boughtNow = false;
  const accepted: Bid[] = [];
  for (const bid of ordered) {
    if (boughtNow) break;
    if (bid.edited || bid.bidder === seller || !positive(bid.amount)) continue;
    if (bid.created < terms.start || bid.created > end) continue;
    if (bid.amount + EPSILON < minimumBid(terms, high ? high.amount : null)) continue;
    accepted.push(bid);
    high = bid;
    if (terms.buyNow !== undefined && bid.amount + EPSILON >= terms.buyNow) {
      boughtNow = true;
      end = bid.created;
      break;
    }
    if (extendMs > 0 && bid.created >= end - extendMs) end = bid.created + extendMs;
  }
  const phase: AuctionPhase = now < terms.start ? "upcoming" : now < end && !boughtNow ? "live" : "ended";
  const reserveMet = terms.reserve === undefined || (high !== null && high.amount + EPSILON >= terms.reserve);
  return {
    phase,
    end,
    accepted,
    high,
    minNext: minimumBid(terms, high ? high.amount : null),
    boughtNow,
    reserveMet,
    winner: phase === "ended" && high && reserveMet ? high : null,
  };
}

/** Problems with terms a seller typed (the form's checks), or null. */
export function auctionTermsProblem(terms: { start: number; end: number; startingBid: number; reserve?: number; buyNow?: number }, now: number): string | null {
  if (!positive(terms.startingBid)) return "Set a starting bid above 0";
  if (!(terms.end > terms.start)) return "The auction must end after it starts";
  if (terms.end <= now) return "The end must be in the future";
  if (terms.end - terms.start > MAX_AUCTION_DAYS * 86_400_000) return `An auction runs at most ${MAX_AUCTION_DAYS} days`;
  if (terms.reserve !== undefined && terms.reserve > 0 && terms.reserve < terms.startingBid) return "The reserve can't be below the starting bid";
  if (terms.buyNow !== undefined && terms.buyNow > 0 && terms.buyNow <= terms.startingBid) return "Buy now must be above the starting bid";
  if (terms.buyNow !== undefined && terms.buyNow > 0 && terms.reserve !== undefined && terms.reserve > 0 && terms.buyNow < terms.reserve) {
    return "Buy now can't be below the reserve";
  }
  return null;
}

/** "2d 4h", "3h 12m", "45m", "30s": time left, for countdowns. */
export function timeLeft(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** An auction product's phase from its terms only (lists, without bids): a buy-now can end it earlier. */
export function scheduledPhase(terms: Pick<AuctionTerms, "start" | "end">, now: number): AuctionPhase {
  if (now < terms.start) return "upcoming";
  if (now < terms.end) return "live";
  return "ended";
}
