import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchReviewRows,
  fetchReviewersWithOrders,
  hasOrderAtShop,
  isReviewSearchUrl,
  roundToHalf,
  shopReviewsFrom,
  summarizeReviews,
  type ShopReview,
} from "./reviewsData";
import type { QdnResourceSummary } from "../../qdn/search";

const reviewRow = (name: string, id: string, created: number, meta = { title: "t", description: "d" }): QdnResourceSummary => ({
  name,
  service: "DOCUMENT",
  identifier: id,
  created,
  metadata: meta,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubSearch(rows: QdnResourceSummary[]) {
  const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => rows }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("shopReviewsFrom", () => {
  const rows = [
    reviewRow("Ann", "q-store-review-my-shop-AAAAAAAAA1-50", 10),
    reviewRow("Ann", "q-store-review-my-shop-AAAAAAAAA2-20", 30),
    reviewRow("Bob", "q-store-review-my-shop-BBBBBBBBB1-45", 20),
    reviewRow("Owner", "q-store-review-my-shop-OOOOOOOOO1-50", 40),
    reviewRow("Cat", "q-store-review-my-shop-2-CCCCCCCCC1-10", 50),
    reviewRow("Dan", "q-store-review-MY-SHOP-DDDDDDDDD1-10", 60),
  ];

  it("keeps this shop's reviews only, not the owner's, one per reviewer (the latest), newest first", () => {
    const reviews = shopReviewsFrom(rows, "my-shop", "Owner");
    expect(reviews.map((r) => [r.name, r.rating])).toEqual([
      ["Ann", 2],
      ["Bob", 4.5],
    ]);
    expect(reviews[0]).toEqual({
      id: "q-store-review-my-shop-AAAAAAAAA2-20",
      name: "Ann",
      created: 30,
      updated: undefined,
      title: "t",
      description: "d",
      rating: 2,
    });
  });

  it("adds reviews published here before the node lists them", () => {
    const mine: ShopReview = { id: "q-store-review-my-shop-EEEEEEEEE1-40", name: "Eve", created: 99, title: "x", description: "y", rating: 4 };
    const other: ShopReview = { ...mine, id: "q-store-review-other-EEEEEEEEE1-40", name: "Zed" };
    const reviews = shopReviewsFrom(rows, "my-shop", "Owner", [mine, other]);
    expect(reviews.map((r) => r.name)).toEqual(["Eve", "Ann", "Bob"]);
  });
});

describe("summarizeReviews", () => {
  it("averages the counted ratings and buckets them by stars", () => {
    const reviews = shopReviewsFrom(
      [
        reviewRow("A", "q-store-review-s-AAAAAAAAAA-50", 1),
        reviewRow("B", "q-store-review-s-BBBBBBBBBB-45", 2),
        reviewRow("C", "q-store-review-s-CCCCCCCCCC-5", 3),
        reviewRow("D", "q-store-review-s-DDDDDDDDDD-30", 4),
      ],
      "s",
      null
    );
    const summary = summarizeReviews(reviews);
    expect(summary.count).toBe(4);
    expect(summary.average).toBeCloseTo(3.25);
    expect(summary.distribution).toEqual([1, 0, 1, 0, 2]);
    expect(roundToHalf(summary.average!)).toBe(3.5);
    expect(summarizeReviews([])).toEqual({ average: null, count: 0, distribution: [0, 0, 0, 0, 0] });
  });
});

describe("searches", () => {
  it("reads a shop's reviews with one prefix search with metadata, never unlimited", async () => {
    const fetchMock = stubSearch([reviewRow("A", "q-store-review-my-shop-AAAAAAAAAA-50", 1)]);
    const { rows, complete } = await fetchReviewRows("my-shop");
    expect(rows).toHaveLength(1);
    expect(complete).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://node");
    expect(url.pathname).toBe("/arbitrary/resources/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mode: "ALL",
      service: "DOCUMENT",
      identifier: "q-store-review-my-shop-",
      prefix: "true",
      includemetadata: "true",
      reverse: "true",
      limit: "100",
      offset: "0",
    });
    expect(isReviewSearchUrl(String(fetchMock.mock.calls[0][0]))).toBe(true);
    // The header and the panel share it.
    await fetchReviewRows("my-shop");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks a page of reviewers for orders at the shop in one search", async () => {
    const fetchMock = stubSearch([
      { name: "Ann", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-AAAAAAAAAA" },
      { name: "Bob", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-2-BBBBBBBBBB" },
      { name: "Zed", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-ZZZZZZZZZZ" },
    ]);
    const ordered = await fetchReviewersWithOrders("my-shop", ["Ann", "Bob", "Ann", "Buyer+One"]);
    expect([...ordered]).toEqual(["Ann"]);
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://node");
    expect(url.searchParams.get("service")).toBe("DOCUMENT_PRIVATE");
    expect(url.searchParams.get("identifier")).toBe("q-store-order-my-shop-");
    expect(url.searchParams.get("prefix")).toBe("true");
    expect(url.searchParams.getAll("name")).toEqual(["Ann", "Bob", "Buyer+One"]);
    expect(url.searchParams.get("exactmatchnames")).toBe("true");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(await fetchReviewersWithOrders("my-shop", [])).toEqual(new Set());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets a name review only with an order at this exact shop", async () => {
    stubSearch([{ name: "Ann", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-2-AAAAAAAAAA" }]);
    expect(await hasOrderAtShop("my-shop", "Ann")).toBe(false);
    stubSearch([{ name: "Ann", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-AAAAAAAAAA" }]);
    expect(await hasOrderAtShop("my-shop", "Ann", { fresh: true })).toBe(true);
    expect(await hasOrderAtShop("my-shop", "")).toBe(false);
  });
});
