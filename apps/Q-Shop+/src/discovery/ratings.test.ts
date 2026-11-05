import { describe, expect, it } from "vitest";
import { buildRatingsIndex, RATING_PRIOR, RATING_PRIOR_WEIGHT, weightedRating } from "./ratings";

const review = (name: string, short: string, rating: number, at = 1) => ({
  name,
  service: "DOCUMENT",
  identifier: `q-store-review-${short}-UID${name.replace(/\W/g, "").padEnd(7, "x")}-${rating * 10}`,
  created: at,
  updated: at,
});

describe("Top rated (Simon, 2026-10-22: weighted by the number of reviews)", () => {
  it("ranks fifty reviews averaging 4.9 above a single 5", () => {
    const rows = [review("one", "solo", 5)];
    for (let i = 0; i < 50; i++) rows.push(review(`r${i}`, "busy", i % 10 === 0 ? 4 : 5));
    const index = buildRatingsIndex(rows);
    const solo = index.get("Owner A", "solo")!;
    const busy = index.get("Owner B", "busy")!;
    expect(solo).toEqual({ average: 5, count: 1 });
    expect(busy.average).toBeCloseTo(4.9);
    expect(weightedRating(busy)).toBeGreaterThan(weightedRating(solo));
    // Two 5s still beat one 5, and ten 4.5s beat both.
    expect(weightedRating({ average: 5, count: 2 })).toBeGreaterThan(weightedRating(solo));
    expect(weightedRating({ average: 4.5, count: 10 })).toBeGreaterThan(weightedRating({ average: 5, count: 2 }));
  });

  it("blends a shop's average with RATING_PRIOR_WEIGHT reviews of RATING_PRIOR stars", () => {
    expect(weightedRating({ average: 5, count: 1 })).toBeCloseTo((RATING_PRIOR_WEIGHT * RATING_PRIOR + 5) / (RATING_PRIOR_WEIGHT + 1));
  });
});
