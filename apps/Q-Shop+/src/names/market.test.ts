import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchListingTimes, fetchNamesForSale, FOR_SALE_PAGE, listingOf, resetNameCaches } from "./market";
import { auctionDescription, auctionFromRow, buildNameAuctionEnd, buildNameAuctionPublish, buildNameBidPublish, NAME_AUCTION_ID } from "./auctions";
import { buyName, cancelNameSale, isSettled, pendingNames, resetPendingNames, sellName } from "./actions";
import { marketItems } from "./useNamesMarket";
import { installQortalMock } from "../test/qortalMock";
import { decodeData64 } from "../test/fixtures/shop";

const OWNER = "QSeLLerAddressxxxxxxxxxxxx9f3c2a";

afterEach(() => {
  vi.unstubAllGlobals();
  resetNameCaches();
  resetPendingNames();
});

describe("names for sale on chain", () => {
  it("reads Core's listings: a name with a price, for sale", () => {
    expect(listingOf({ name: "alpha", owner: OWNER, salePrice: "12.50000000", isForSale: true, registered: 5 })).toEqual({ name: "alpha", owner: OWNER, price: 12.5, registered: 5 });
    expect(listingOf({ name: "alpha", owner: OWNER, salePrice: "0" })).toBeNull();
    expect(listingOf({ name: "alpha", owner: OWNER, salePrice: "3", isForSale: false })).toBeNull();
    expect(listingOf({ owner: OWNER, salePrice: "3" })).toBeNull();
  });

  it("pages the listings 100 at a time (never limit=0), each name once, cached for the session", async () => {
    const all = Array.from({ length: 150 }, (_, i) => ({ name: `n${i}`, owner: OWNER, salePrice: "1" }));
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        const offset = Number(new URL(url, "http://n").searchParams.get("offset"));
        return { ok: true, json: async () => all.slice(offset, offset + FOR_SALE_PAGE) };
      })
    );
    const read = await fetchNamesForSale();
    expect(read.listings).toHaveLength(150);
    expect(read.complete).toBe(true);
    expect(urls).toEqual(["/names/forsale?limit=100&offset=0&reverse=true", "/names/forsale?limit=100&offset=100&reverse=true"]);
    await fetchNamesForSale();
    expect(urls).toHaveLength(2);
  });

  it("knows when each name was listed from the latest SELL_NAME transactions (the newest one for a name)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [{ name: "zed", timestamp: 30 }, { name: "zed", timestamp: 10 }, { name: "alpha", timestamp: 20 }] })));
    expect([...(await fetchListingTimes())]).toEqual([
      ["zed", 30],
      ["alpha", 20],
    ]);
  });

  it("sells, takes off and buys as the Names app asks Hub, each pending until Core shows it", async () => {
    const q = installQortalMock({ SELL_NAME: async () => ({ signature: "S1" }), CANCEL_SELL_NAME: async () => ({ signature: "S2" }), BUY_NAME: async () => ({ signature: "S3" }) });
    expect(await sellName("spare", 4.5)).toEqual({ kind: "sent" });
    expect(await cancelNameSale("old")).toEqual({ kind: "sent" });
    expect(await buyName("alpha", "QBuyer")).toEqual({ kind: "sent" });
    expect(q.calls.map(({ action, ...rest }) => [action, rest])).toEqual([
      ["SELL_NAME", { nameForSale: "spare", salePrice: 4.5 }],
      ["CANCEL_SELL_NAME", { nameForSale: "old" }],
      ["BUY_NAME", { nameForSale: "alpha" }],
    ]);
    expect([...pendingNames().keys()]).toEqual(["spare", "old", "alpha"]);
    const sell = pendingNames().get("spare")!;
    expect(isSettled(sell, { name: "spare", owner: OWNER, forSale: true, price: 4.5 })).toBe(true);
    expect(isSettled(sell, { name: "spare", owner: OWNER, forSale: false, price: null })).toBe(false);
    expect(isSettled(pendingNames().get("alpha")!, { name: "alpha", owner: "QBuyer", forSale: false, price: null })).toBe(true);
    // A decline in Hub is quiet, and nothing is pending.
    q.on("SELL_NAME", async () => {
      throw { error: "User declined request" };
    });
    expect(await sellName("other", 1)).toEqual({ kind: "declined" });
    expect(pendingNames().has("other")).toBe(false);
  });
});

describe("name auctions", () => {
  const terms = { v: 1 as const, start: 1000, end: 2000, startingBid: 5, reserve: 8, buyNow: 50, extendMinutes: 5 };

  it("lists an auction under the name itself, its terms in the metadata, and reads them back", () => {
    const publish = buildNameAuctionPublish({ name: "spare", owner: OWNER, uid: "AUCxxxx1", terms, now: 900 });
    expect({ ...publish, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "spare",
      service: "DOCUMENT",
      identifier: NAME_AUCTION_ID,
      filename: "auction.json",
      data64: undefined,
      title: "Name auction",
      description: `nameauc:AUCxxxx1;s:1000;e:2000;b:5;r:8;n:50;x:5;o:${OWNER}`,
    });
    expect(decodeData64(publish.data64)).toEqual({ v: 1, name: "spare", owner: OWNER, uid: "AUCxxxx1", terms, created: 900 });
    const row = { name: "spare", service: "DOCUMENT", identifier: NAME_AUCTION_ID, created: 950, metadata: { description: auctionDescription("AUCxxxx1", OWNER, terms) } };
    expect(auctionFromRow(row)).toEqual({ name: "spare", uid: "AUCxxxx1", owner: OWNER, created: 950, terms });
    // A longer identifier, a tombstone or bad terms aren't auctions.
    expect(auctionFromRow({ ...row, identifier: `${NAME_AUCTION_ID}-2` })).toBeNull();
    expect(auctionFromRow({ ...row, metadata: { title: "deleted", description: "deleted" } })).toBeNull();
    expect(auctionFromRow({ ...row, metadata: { description: "nameauc:AUCxxxx1;s:2000;e:1000;b:5;x:5;o:" + OWNER } })).toBeNull();
    expect(buildNameAuctionEnd("spare")).toMatchObject({ name: "spare", identifier: NAME_AUCTION_ID, title: "deleted", tags: ["deleted"] });
  });

  it("publishes a bid under the bidder's name, naming the name for auction", () => {
    const built = buildNameBidPublish({ bidder: "Buyer", auction: { name: "spare", uid: "AUCxxxx1", owner: OWNER, terms, created: 1 }, amount: 6.123456789, uid: "BIDxx1", now: 1500 });
    expect(built.identifier).toBe("q-store-namebid-AUCxxxx1-BIDxx1");
    expect({ ...built.request, data64: undefined }).toMatchObject({ name: "Buyer", service: "DOCUMENT", identifier: built.identifier, title: "Bid", description: "bid:6.12345679;to:spare" });
  });

  it("joins listings and auctions into one list: an auction only while its seller holds the name, and a week after it ends", () => {
    const auction = { name: "spare", uid: "AUCxxxx1", owner: OWNER, terms, created: 1500 };
    const items = marketItems(
      [{ name: "spare", owner: OWNER, price: 99 }, { name: "zed", owner: OWNER, price: 3 }],
      [
        { auction, state: { name: "spare", owner: OWNER, forSale: true, price: 99 } },
        { auction: { ...auction, name: "gone" }, state: { name: "gone", owner: "QSomeoneElsexxxxxxxxxxxxxxxx1", forSale: false, price: null } },
      ],
      new Map([["zed", 1700]]),
      3000
    );
    expect(items.map((i) => [i.name, i.price, !!i.auction, i.listedAt])).toEqual([
      ["spare", 99, true, 1500],
      ["zed", 3, false, 1700],
    ]);
    expect(marketItems([], [{ auction, state: { name: "spare", owner: OWNER, forSale: false, price: null } }], new Map(), 2000 + 8 * 86_400_000)).toEqual([]);
  });
});
