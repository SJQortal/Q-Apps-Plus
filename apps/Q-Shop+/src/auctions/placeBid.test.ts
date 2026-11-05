import { afterEach, describe, expect, it, vi } from "vitest";
import { resetQdnCaches } from "../qdn/search";
import { placeBid } from "./placeBid";
import { auctionState, type AuctionTerms } from "./rules";

const PRODUCT = "q-store-product-my-shop-AbCdEf1234";
const T0 = 1_800_000_000_000;
const terms: AuctionTerms = { v: 1, start: T0, end: T0 + 3_600_000, startingBid: 10, extendMinutes: 5 };
const live = auctionState(terms, [], T0 + 60_000, "Seller");
const args = (overrides: Partial<Parameters<typeof placeBid>[0]> = {}): Parameters<typeof placeBid>[0] => ({
  name: "Ann",
  productId: PRODUCT,
  storeId: "q-store-general-my-shop",
  seller: "Seller",
  amount: 12,
  uid: "UID123",
  latest: async () => ({ state: live, complete: true }),
  clock: () => T0 + 120_000,
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

describe("placing a bid", () => {
  it("publishes it once the latest bids allow it, as the bid Core will list", async () => {
    const send = vi.fn(async () => ({}));
    const outcome = await placeBid(args({ send }));
    expect(outcome).toEqual({ kind: "placed", bid: { id: "q-store-bid-my-shop-AbCdEf1234-UID123", bidder: "Ann", amount: 12, created: T0 + 120_000 } });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]).toEqual([expect.objectContaining({ identifier: "q-store-bid-my-shop-AbCdEf1234-UID123", description: "bid:12;to:Seller" }), 300_000]);
  });

  it("publishes nothing when the latest bids are beyond it, it has closed, or the node can't say", async () => {
    const send = vi.fn(async () => ({}));
    const beaten = auctionState(terms, [{ id: "x", bidder: "Cy", amount: 20, created: T0 + 30_000 }], T0 + 60_000, "Seller");
    expect(await placeBid(args({ send, latest: async () => ({ state: beaten, complete: true }) }))).toEqual({ kind: "outbid", state: beaten });
    const ended = auctionState(terms, [], T0 + 7_200_000, "Seller");
    expect(await placeBid(args({ send, latest: async () => ({ state: ended, complete: true }) }))).toEqual({ kind: "closed", state: ended });
    // More bids than the app reads: the result can't be checked, so no bid.
    expect(await placeBid(args({ send, latest: async () => ({ state: live, complete: false }) }))).toMatchObject({ kind: "failed", message: expect.stringMatching(/more bids than the app can read/) });
    expect(await placeBid(args({ send, amount: 20_000_000 }))).toMatchObject({ kind: "failed", message: expect.stringMatching(/at most 10,000,000 QORT/) });
    expect(await placeBid(args({ send, latest: async () => null }))).toMatchObject({ kind: "failed" });
    expect(send).not.toHaveBeenCalled();
  });

  it("is quiet on a decline, and after a timeout asks QDN before it says it failed", async () => {
    expect(await placeBid(args({ send: async () => Promise.reject({ error: { cancelled: true } }) }))).toEqual({ kind: "declined" });
    const timeout = async () => Promise.reject(new Error("Request timed out after 300000 ms"));
    const listed = (rows: unknown[]) =>
      vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) }));
    listed([{ name: "Ann", service: "DOCUMENT", identifier: "q-store-bid-my-shop-AbCdEf1234-UID123", created: 1 }]);
    expect(await placeBid(args({ send: timeout }))).toMatchObject({ kind: "placed" });
    resetQdnCaches();
    listed([]);
    expect(await placeBid(args({ send: timeout }))).toMatchObject({ kind: "failed", message: expect.stringMatching(/isn't on QDN/) });
  });
});
