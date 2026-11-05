import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRatingsIndex, formatRating, loadRatings, peekRatings, resetRatingsMemory } from "./ratings";
import { buildActivityIndex, loadActivity, resetActivityMemory } from "./activity";
import { shopKey } from "./shopIndex";
import type { QdnResourceSummary } from "../qdn/search";

function review(name: string, short: string, uid: string, rating: number, at: number): QdnResourceSummary {
  return {
    name,
    service: "DOCUMENT",
    identifier: `q-store-review-${short}-${uid}-${rating * 10}`,
    created: at,
    updated: at,
  };
}

function container(owner: string, short: string, updated: number | undefined, size: number, created = 100): QdnResourceSummary {
  return {
    name: owner,
    service: "DOCUMENT",
    identifier: `q-store-general-${short}-datacontainer`,
    created,
    updated,
    size,
  };
}

function stubFetch(rows: QdnResourceSummary[]) {
  const fetchMock = vi.fn(async (_input: string) => ({
    ok: true,
    status: 200,
    json: async () => rows,
    text: async () => JSON.stringify(rows),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const paramsOf = (url: string) => new URLSearchParams(url.split("?")[1]);

beforeEach(() => {
  resetRatingsMemory();
  resetActivityMemory();
  vi.unstubAllGlobals();
});

describe("ratings", () => {
  it("averages one rating per reviewer: their latest", () => {
    const index = buildRatingsIndex([
      review("Ann", "my-shop", "A000000001", 2, 10),
      review("Ann", "my-shop", "A000000002", 5, 20),
      review("Bob", "my-shop", "B000000001", 4, 15),
    ]);
    expect(index.get("Seller", "my-shop")).toEqual({ average: 4.5, count: 2 });
  });

  it("leaves out the owner's own reviews of their shop", () => {
    const index = buildRatingsIndex([review("Seller", "my-shop", "S000000001", 5, 10), review("Bob", "my-shop", "B000000001", 3, 15)]);
    expect(index.get("Seller", "my-shop")).toEqual({ average: 3, count: 1 });
  });

  it("counts a review for every owner of that short id (a review names only the short id)", () => {
    const index = buildRatingsIndex([review("Ann", "shared", "A000000001", 4, 10), review("Owner One", "shared", "O000000001", 1, 11)]);
    // Owner One's own review doesn't count for their shop, but does for Owner Two's.
    expect(index.get("Owner One", "shared")).toEqual({ average: 4, count: 1 });
    expect(index.get("Owner Two", "shared")).toEqual({ average: 2.5, count: 2 });
  });

  it("keeps my-shop and my-shop-2 apart, and ignores identifiers that aren't reviews", () => {
    const index = buildRatingsIndex([
      review("Ann", "my-shop", "A000000001", 5, 10),
      review("Ann", "my-shop-2", "A000000002", 1, 10),
      { name: "Eve", service: "DOCUMENT", identifier: "q-store-review-my-shop-X-0", created: 1 },
      { name: "Eve", service: "DOCUMENT", identifier: "q-store-review-my-shop-X-60", created: 1 },
      { name: "Eve", service: "DOCUMENT", identifier: "q-store-review-my-shop-X-abc", created: 1 },
      { name: "Eve", service: "DOCUMENT", identifier: "q-store-reviewer", created: 1 },
    ]);
    expect(index.get("Seller", "my-shop")).toEqual({ average: 5, count: 1 });
    expect(index.get("Seller", "my-shop-2")).toEqual({ average: 1, count: 1 });
    expect(index.get("Seller", "nobody")).toBeNull();
  });

  it("formats the average with one decimal", () => {
    expect(formatRating(4)).toBe("4.0");
    expect(formatRating(3.4666)).toBe("3.5");
  });

  it("loads from one paged search of review identifiers, without metadata", async () => {
    const fetchMock = stubFetch([review("Ann", "my-shop", "A000000001", 4, 10)]);
    const index = await loadRatings();
    const params = paramsOf(fetchMock.mock.calls[0][0]);
    expect(params.get("service")).toBe("DOCUMENT");
    expect(params.get("identifier")).toBe("q-store-review-");
    expect(params.get("prefix")).toBe("true");
    expect(params.get("includemetadata")).toBe("false");
    expect(params.get("excludeblocked")).toBe("true");
    expect(params.get("limit")).toBe("100");
    expect(index.complete).toBe(true);
    expect(index.get("Seller", "my-shop")).toEqual({ average: 4, count: 1 });
    expect(peekRatings()).toBe(index);
  });
});

describe("activity", () => {
  it("keeps product indexes only, by owner and shop, with their last update and size", () => {
    const index = buildActivityIndex([
      container("A", "one", 500, 1500),
      container("A", "two", undefined, 300, 250),
      { name: "A", service: "DOCUMENT", identifier: "q-store-general-one-notes", created: 1, size: 9 },
      { name: "A", service: "DOCUMENT", identifier: "q-store-general--datacontainer", created: 1, size: 9 },
    ]);
    expect([...index.byShop.keys()]).toEqual([shopKey("A", "q-store-general-one"), shopKey("A", "q-store-general-two")]);
    expect(index.byShop.get(shopKey("A", "q-store-general-one"))).toEqual({ updated: 500, size: 1500 });
    expect(index.byShop.get(shopKey("A", "q-store-general-two"))).toEqual({ updated: 250, size: 300 });
  });

  it("loads from one paged search of the shops' DOCUMENTs", async () => {
    const fetchMock = stubFetch([container("A", "one", 500, 1500)]);
    const index = await loadActivity();
    const params = paramsOf(fetchMock.mock.calls[0][0]);
    expect(params.get("service")).toBe("DOCUMENT");
    expect(params.get("identifier")).toBe("q-store-general-");
    expect(params.get("prefix")).toBe("true");
    expect(params.get("excludeblocked")).toBe("true");
    expect(params.get("limit")).toBe("100");
    expect(index.byShop.size).toBe(1);
  });
});
