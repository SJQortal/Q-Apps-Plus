import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_CONCURRENCY, fetchCatalogue } from "./fetchCatalogues";
import { fetchAndEvaluateStoreReviews, fetchReview } from "./fetchStoreReviews";
import { catalogue, SELLER } from "../test/fixtures/shop";

afterEach(() => {
  vi.unstubAllGlobals();
});

const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

describe("fetchCatalogue", () => {
  it("reads a catalogue once per session, with the id and owner asked for", async () => {
    const fetchMock = vi.fn(async (_url: string) => ok({ ...catalogue, id: "spoofed", user: "Someone else" }));
    vi.stubGlobal("fetch", fetchMock);
    const loaded = await fetchCatalogue(SELLER, catalogue.id);
    expect(loaded.id).toBe(catalogue.id);
    expect(loaded.user).toBe(SELLER);
    expect(loaded.isValid).toBe(true);
    expect(Object.keys(loaded.products)).toEqual(Object.keys(catalogue.products));
    expect(fetchMock.mock.calls[0][0]).toBe(`/arbitrary/DOCUMENT/Seller%20Name/${catalogue.id}`);
    await fetchCatalogue(SELLER, catalogue.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects what isn't a catalogue", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ok({ hello: "world" })));
    await expect(fetchCatalogue(SELLER, "q-store-catalogue-x-1")).rejects.toThrow();
  });

  it(`never has more than ${CATALOGUE_CONCURRENCY} catalogue fetches in flight`, async () => {
    let inFlight = 0;
    let most = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return ok({ products: {} });
      })
    );
    await Promise.all(Array.from({ length: 12 }, (_, i) => fetchCatalogue(SELLER, `q-store-catalogue-my-shop-C${i}`)));
    expect(most).toBe(CATALOGUE_CONCURRENCY);
  });
});

describe("reviews", () => {
  it("reads a review's full text, or null for something else", async () => {
    const review = { title: "Great", description: "Lovely mug", rating: 4.5, created: 1 };
    vi.stubGlobal("fetch", vi.fn(async () => ok(review)));
    expect(await fetchReview("Ann", "q-store-review-my-shop-AAAAAAAAAA-45")).toEqual({
      ...review,
      id: "q-store-review-my-shop-AAAAAAAAAA-45",
      name: "Ann",
      isValid: true,
    });
    vi.stubGlobal("fetch", vi.fn(async () => ok({ nope: true })));
    expect(await fetchReview("Ann", "q-store-review-my-shop-BBBBBBBBBB-45")).toBeNull();
    expect(await fetchAndEvaluateStoreReviews({ owner: "Ann", reviewId: "q-store-review-my-shop-BBBBBBBBBB-45" })).toEqual({
      isValid: false,
    });
  });
});
