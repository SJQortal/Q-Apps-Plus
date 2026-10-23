/**
 * Placing a bid: the latest bids first (someone may have bid meanwhile, or it
 * may have ended), then the bidder's publish, which Hub asks them to confirm.
 * A decline is quiet. After a timeout QDN is asked whether the bid landed
 * before saying it failed, so a retry never places it twice.
 */
import { errorMessage, isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { invalidateQdnSearches, resourceExists } from "../qdn/search";
import { buildBidPublish } from "./bids";
import { roundQort, type AuctionState, type Bid } from "./rules";
import { BID_BASE } from "../qdn/identifiers";

export const BID_PUBLISH_TIMEOUT_MS = 5 * 60_000;
const EPSILON = 1e-9;

export type BidOutcome =
  | { kind: "placed"; bid: Bid }
  | { kind: "declined" }
  /** Someone bid meanwhile: the least is now `state.minNext`. */
  | { kind: "outbid"; state: AuctionState }
  /** It ended (or hasn't started) by the latest bids. */
  | { kind: "closed"; state: AuctionState }
  | { kind: "failed"; message: string };

export async function placeBid(args: {
  name: string;
  productId: string;
  storeId: string;
  seller: string;
  amount: number;
  uid: string;
  /** The latest result from QDN (useAuction's refresh), or null when the node didn't answer. */
  latest: () => Promise<AuctionState | null>;
  send?: (request: Record<string, unknown>, timeout: number) => Promise<unknown>;
  clock?: () => number;
}): Promise<BidOutcome> {
  const send = args.send ?? ((r, t) => qortalRequestWithTimeout(r as never, t));
  const clock = args.clock ?? Date.now;
  const state = await args.latest();
  if (!state) return { kind: "failed", message: "Couldn't read the latest bids from your node. Try again in a moment." };
  if (state.phase !== "live") return { kind: "closed", state };
  if (args.amount + EPSILON < state.minNext) return { kind: "outbid", state };
  const now = clock();
  const built = buildBidPublish({ name: args.name, productId: args.productId, storeId: args.storeId, seller: args.seller, amount: args.amount, uid: args.uid, now });
  const bid: Bid = { id: built.identifier, bidder: args.name, amount: roundQort(args.amount), created: now };
  const placed = (): BidOutcome => {
    invalidateQdnSearches((url) => url.includes(BID_BASE));
    return { kind: "placed", bid };
  };
  try {
    await send(built.request, BID_PUBLISH_TIMEOUT_MS);
    return placed();
  } catch (error) {
    if (isHubDecline(error)) return { kind: "declined" };
    if (isHubTimeout(error)) {
      const there = await resourceExists("DOCUMENT", args.name, built.identifier, { fresh: true }).catch(() => false);
      if (there) return placed();
      return { kind: "failed", message: "Hub didn't finish placing the bid in time, and it isn't on QDN. Try again." };
    }
    return { kind: "failed", message: errorMessage(error, "Couldn't place the bid. Try again.") };
  }
}
