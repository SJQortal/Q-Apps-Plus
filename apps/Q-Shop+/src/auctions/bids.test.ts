import { describe, expect, it } from "vitest";
import { base64ToJson } from "../qdn/payloads";
import { bidDescription, bidPrefix, bidsFromRows, buildBidPublish } from "./bids";

const PRODUCT = "q-store-product-my-shop-AbCdEf1234";

describe("bids on QDN", () => {
  it("are documents of the bidder's, under the product's own prefix, with the amount in the metadata", () => {
    expect(bidPrefix(PRODUCT)).toBe("q-store-bid-my-shop-AbCdEf1234-");
    const longest = buildBidPublish({ name: "Ann", productId: `q-store-product-${"s".repeat(25)}-AbCdEf1234`, storeId: "x", seller: "S", amount: 1, uid: "UID123", now: 1 });
    expect(longest.identifier.length).toBeLessThanOrEqual(64);
    const built = buildBidPublish({ name: "Ann", productId: PRODUCT, storeId: "q-store-general-my-shop", seller: "Seller", amount: 12.123456789, uid: "UID123", now: 1_800_000_000_000 });
    expect({ ...built.request, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Ann",
      service: "DOCUMENT",
      identifier: "q-store-bid-my-shop-AbCdEf1234-UID123",
      filename: "bid.json",
      data64: undefined,
      title: "Bid",
      description: "bid:12.12345679;to:Seller",
    });
    expect(base64ToJson(built.request.data64)).toEqual({
      v: 1,
      productId: PRODUCT,
      storeId: "q-store-general-my-shop",
      seller: "Seller",
      amount: 12.12345679,
      coin: "QORT",
      created: 1_800_000_000_000,
    });
  });

  it("write their amount in plain decimals and name the seller, so the app can always read them back", () => {
    expect(bidDescription(1e-7, "Seller Name")).toBe("bid:0.0000001;to:Seller%20Name");
    expect(bidDescription(10, "Zoë+Co")).toBe("bid:10;to:Zo%C3%AB%2BCo");
    const built = buildBidPublish({ name: "Ann", productId: PRODUCT, storeId: "s", seller: "Seller Name", amount: 12.5, uid: "UID123", now: 1 });
    expect(bidsFromRows([{ name: "Ann", service: "DOCUMENT", identifier: built.identifier, created: 5, metadata: { description: built.request.description } } as never], PRODUCT, "Seller Name")).toEqual([
      { id: built.identifier, bidder: "Ann", amount: 12.5, created: 5 },
    ]);
  });

  it("are read from search rows: the publisher and Core's time, this product's exact prefix, and a changed bid marked", () => {
    const row = (name: string, identifier: string, description: string, created = 100, updated?: number) => ({
      name,
      service: "DOCUMENT",
      identifier,
      created,
      ...(updated !== undefined && { updated }),
      metadata: { title: "Bid", description },
    });
    const bids = bidsFromRows(
      [
        row("Ann", "q-store-bid-my-shop-AbCdEf1234-AAA111", "bid:12.5;to:Seller"),
        row("Bob", "q-store-bid-my-shop-AbCdEf1234-BBB222", "bid:13;to:Seller", 200, 300),
        // Another product whose uid starts the same, another shop whose id goes on, Core's case-blind match, junk amounts.
        row("Cy", "q-store-bid-my-shop-AbCdEf12345-CCC333", "bid:99;to:Seller"),
        row("Dee", "q-store-bid-my-shop-AbCdEf1234-x-DDD444", "bid:99;to:Seller"),
        row("Eve", "Q-STORE-BID-MY-SHOP-ABCDEF1234-EEE555", "bid:99;to:Seller"),
        row("Fay", "q-store-bid-my-shop-AbCdEf1234-FFF666", "bid:-3;to:Seller"),
        row("Gus", "q-store-bid-my-shop-AbCdEf1234-GGG777", "a lot"),
        // For another name's copy of the shop (short shop ids aren't unique), an exponent, no seller at all.
        row("Hal", "q-store-bid-my-shop-AbCdEf1234-HHH888", "bid:99;to:Copycat"),
        row("Ivy", "q-store-bid-my-shop-AbCdEf1234-III999", "bid:1e+30;to:Seller"),
        row("Jo", "q-store-bid-my-shop-AbCdEf1234-JJJ000", "bid:99"),
      ],
      PRODUCT,
      "Seller"
    );
    expect(bids).toEqual([
      { id: "q-store-bid-my-shop-AbCdEf1234-AAA111", bidder: "Ann", amount: 12.5, created: 100 },
      { id: "q-store-bid-my-shop-AbCdEf1234-BBB222", bidder: "Bob", amount: 13, created: 200, edited: true },
    ]);
  });
});
