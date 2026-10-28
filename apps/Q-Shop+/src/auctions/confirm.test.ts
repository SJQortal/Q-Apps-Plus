import { beforeEach, describe, expect, it } from "vitest";
import { bidConfirmedAt, CONFIRM_GRACE_MS, lateWinningBids, resetConfirmCaches } from "./confirm";
import type { AuctionTerms, Bid } from "./rules";

const T0 = 1_800_000_000_000;
const MIN = 60_000;
const terms: AuctionTerms = { v: 1, start: T0, end: T0 + 60 * MIN, startingBid: 10, extendMinutes: 0 };
const bid = (bidder: string, id: string, amount: number, at: number): Bid => ({ id, bidder, amount, created: T0 + at * MIN });

/** A node: names' addresses, their ARBITRARY transactions (newest first), and blocks' times. */
function node(txs: Record<string, { identifier: string; name: string; timestamp: number; blockHeight: number }[]>, blocks: Record<number, number>) {
  const calls: string[] = [];
  const get = async (url: string) => {
    calls.push(url);
    const ok = (body: unknown) => ({ ok: true, json: async () => body });
    let m = url.match(/^\/names\/(.+)$/);
    if (m) return ok({ name: decodeURIComponent(m[1]), owner: `Q${decodeURIComponent(m[1])}` });
    m = url.match(/address=([^&]+).*offset=(\d+)/);
    if (url.startsWith("/transactions/search") && m) return ok((txs[decodeURIComponent(m[1])] ?? []).slice(Number(m[2]), Number(m[2]) + 50));
    m = url.match(/^\/blocks\/byheight\/(\d+)$/);
    if (m) return ok({ height: Number(m[1]), timestamp: blocks[Number(m[1])] });
    return { ok: false, json: async () => null };
  };
  return { get, calls };
}

beforeEach(() => resetConfirmCaches());

describe("checking a winner against the chain", () => {
  it("finds when Core confirmed a bid: its first transaction's block", async () => {
    const ann = bid("Ann", "q-store-bid-s-P-AAA111", 12, 10);
    const { get } = node(
      { QAnn: [{ identifier: "other", name: "Ann", timestamp: T0 + 20 * MIN, blockHeight: 9 }, { identifier: ann.id, name: "Ann", timestamp: ann.created, blockHeight: 7 }] },
      { 7: ann.created + MIN }
    );
    expect(await bidConfirmedAt(ann, T0 - 86_400_000, get)).toBe(ann.created + MIN);
    // Not found (not confirmed yet, say): it can't be told.
    expect(await bidConfirmedAt(bid("Bo", "q-store-bid-s-P-BBB222", 13, 11), T0, get)).toBeNull();
  });

  it("leaves out a winning bid confirmed much later than it claims, and the next one then wins", async () => {
    const honest = bid("Ann", "q-store-bid-s-P-AAA111", 12, 10);
    // Dated inside the auction, confirmed two hours after it ended.
    const late = bid("Mal", "q-store-bid-s-P-MMM999", 20, 50);
    const { get } = node(
      {
        QAnn: [{ identifier: honest.id, name: "Ann", timestamp: honest.created, blockHeight: 7 }],
        QMal: [{ identifier: late.id, name: "Mal", timestamp: late.created, blockHeight: 99 }],
      },
      { 7: honest.created + MIN, 99: terms.end + 120 * MIN }
    );
    expect(await lateWinningBids(terms, [honest, late], "Seller", terms.end + 200 * MIN, get)).toEqual([late.id]);
    // A bid confirmed within the grace counts.
    resetConfirmCaches();
    const { get: onTime } = node({ QMal: [{ identifier: late.id, name: "Mal", timestamp: late.created, blockHeight: 98 }] }, { 98: late.created + CONFIRM_GRACE_MS });
    expect(await lateWinningBids(terms, [honest, late], "Seller", terms.end + 200 * MIN, onTime)).toEqual([]);
  });
});
