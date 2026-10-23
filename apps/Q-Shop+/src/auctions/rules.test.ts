import { describe, expect, it } from "vitest";
import { auctionState, auctionTermsOf, auctionTermsProblem, bidStep, minimumBid, timeLeft, type AuctionTerms, type Bid } from "./rules";

const MIN = 60_000;
const T0 = 1_800_000_000_000;
const terms: AuctionTerms = { v: 1, start: T0, end: T0 + 60 * MIN, startingBid: 10, extendMinutes: 5 };
let n = 0;
const bid = (bidder: string, amount: number, at: number, extra: Partial<Bid> = {}): Bid => ({ id: `b${++n}`, bidder, amount, created: T0 + at * MIN, ...extra });

describe("auction rules", () => {
  it("step up with the price, and start at the starting bid", () => {
    expect([0.5, 5, 50, 500, 5000, 50000].map(bidStep)).toEqual([0.01, 0.1, 0.5, 1, 5, 10]);
    expect(minimumBid(terms, null)).toBe(10);
    expect(minimumBid(terms, 10)).toBe(10.5);
    expect(minimumBid(terms, 0.3)).toBe(0.31);
  });

  it("take bids in the order they were placed, each reaching the minimum at that moment", () => {
    const state = auctionState(terms, [bid("Ann", 12, 10), bid("Bob", 9, 5), bid("Bob", 12.2, 20), bid("Cy", 15, 30), bid("Bob", 15, 31)], T0 + 40 * MIN, "Seller");
    // Bob's 9 is under the starting bid; his 12.2 is under 12 + 0.5; his 15 doesn't beat Cy's 15.
    expect(state.accepted.map((b) => [b.bidder, b.amount])).toEqual([
      ["Ann", 12],
      ["Cy", 15],
    ]);
    expect(state.high?.bidder).toBe("Cy");
    expect(state.minNext).toBe(15.5);
    expect(state.phase).toBe("live");
    expect(state.winner).toBeNull();
  });

  it("leave out the seller's own bids, bids changed after they were placed, and bids outside the window", () => {
    const state = auctionState(
      terms,
      [bid("Seller", 50, 10), bid("Ann", 20, 11, { edited: true }), bid("Bob", 30, -5), bid("Cy", 40, 61), bid("Dee", 11, 12)],
      T0 + 70 * MIN,
      "Seller"
    );
    expect(state.accepted.map((b) => b.bidder)).toEqual(["Dee"]);
    expect(state.phase).toBe("ended");
    expect(state.winner?.bidder).toBe("Dee");
  });

  it("move the end past a late bid, so it can't be sniped", () => {
    const late = bid("Ann", 10, 58);
    const later = bid("Bob", 11, 62);
    const state = auctionState(terms, [late, later], T0 + 64 * MIN, "Seller");
    // Ann's bid at 58 moved the end to 63; Bob's at 62 counts and moves it to 67.
    expect(state.accepted).toEqual([late, later]);
    expect(state.end).toBe(T0 + 67 * MIN);
    expect(state.phase).toBe("live");
    expect(auctionState({ ...terms, extendMinutes: 0 }, [late, later], T0 + 64 * MIN, "Seller").accepted).toEqual([late]);
  });

  it("end at once with a buy-now bid, which wins", () => {
    const state = auctionState({ ...terms, buyNow: 100 }, [bid("Ann", 20, 5), bid("Bob", 100, 10), bid("Cy", 150, 11)], T0 + 15 * MIN, "Seller");
    expect(state.boughtNow).toBe(true);
    expect(state.phase).toBe("ended");
    expect(state.end).toBe(T0 + 10 * MIN);
    expect(state.winner?.bidder).toBe("Bob");
  });

  it("have no winner when the reserve isn't reached", () => {
    const withReserve = { ...terms, reserve: 50 };
    expect(auctionState(withReserve, [bid("Ann", 40, 10)], T0 + 70 * MIN, "Seller")).toMatchObject({ reserveMet: false, winner: null, phase: "ended" });
    expect(auctionState(withReserve, [bid("Ann", 50, 10)], T0 + 70 * MIN, "Seller").winner?.bidder).toBe("Ann");
    expect(auctionState(terms, [], T0 - MIN, "Seller").phase).toBe("upcoming");
  });

  it("read only usable terms from a product anyone can publish", () => {
    expect(auctionTermsOf({ auction: { v: 1, start: T0, end: T0 + MIN, startingBid: 5, buyNow: 3, reserve: -1, extendMinutes: 999 } })).toEqual({
      v: 1,
      start: T0,
      end: T0 + MIN,
      startingBid: 5,
      extendMinutes: 60,
    });
    expect(auctionTermsOf({ auction: { start: T0, end: T0 - 1, startingBid: 5 } })).toBeNull();
    expect(auctionTermsOf({ auction: "yes" })).toBeNull();
    expect(auctionTermsOf({})).toBeNull();
  });

  it("check the terms a seller types", () => {
    const now = T0;
    expect(auctionTermsProblem({ start: now, end: now + MIN, startingBid: 0 }, now)).toMatch(/starting bid/);
    expect(auctionTermsProblem({ start: now, end: now - MIN, startingBid: 1 }, now)).toMatch(/end after it starts/);
    expect(auctionTermsProblem({ start: now, end: now + 61 * 86_400_000, startingBid: 1 }, now)).toMatch(/60 days/);
    expect(auctionTermsProblem({ start: now, end: now + MIN, startingBid: 10, buyNow: 10 }, now)).toMatch(/Buy now/);
    expect(auctionTermsProblem({ start: now, end: now + MIN, startingBid: 10, reserve: 5 }, now)).toMatch(/reserve/);
    expect(auctionTermsProblem({ start: now, end: now + MIN, startingBid: 10, reserve: 20, buyNow: 30 }, now)).toBeNull();
  });

  it("say how long is left", () => {
    expect([2 * 86_400_000 + 4 * 3_600_000, 3 * 3_600_000 + 12 * MIN, 45 * MIN, 30_000, -1].map(timeLeft)).toEqual(["2d 4h", "3h 12m", "45m", "30s", "0s"]);
  });
});
