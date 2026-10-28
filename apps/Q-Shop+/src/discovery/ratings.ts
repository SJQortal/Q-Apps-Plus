/**
 * Shop ratings for the home page, from one paged search of every review's
 * identifier: `q-store-review-<shortStoreId>-<uid>-<rating×10>` carries the
 * shop and the rating, so no review is fetched (docs/apps/Q-Shop+.md → Data
 * contract). Loaded on every home visit once the shop index is in, so the
 * cards show their stars (Simon, 2026-10-22: one search of up to 100 review
 * ids, about 10–20 kB with today's 44 reviews).
 *
 * Trusted reviews (Missing features 11, Bugs 12):
 * - one rating per reviewer per shop: their latest review;
 * - the shop owner's own reviews don't count;
 * - a review names the shop by its short id only, and two owners can have
 *   shops with the same short id, so a review counts for each of them (as
 *   the original's shop page does).
 */
import { ratingFromReviewIdentifier, REVIEW_BASE, shortStoreIdOfReview } from "../qdn/identifiers";
import { searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { shopKey } from "./shopIndex";

export const REVIEWS_INDEX_PAGE_SIZE = 100;
export const REVIEWS_INDEX_MAX_PAGES = 5;

export interface ShopRating {
  /** 0.5–5 */
  average: number;
  count: number;
}

export interface RatingsIndex {
  /** The shop's rating, or null when nobody but its owner has reviewed it. */
  get: (owner: string, shortStoreId: string) => ShopRating | null;
  /** False when there were more reviews than the index holds. */
  complete: boolean;
}

/**
 * Top rated blends each shop's reviews with RATING_PRIOR_WEIGHT imaginary
 * reviews of RATING_PRIOR stars, so one 5★ review doesn't beat fifty
 * averaging 4.9 (a Bayesian average; Simon, 2026-10-22). The prior is the
 * middle of the scale, not the network's mean: with today's few, mostly
 * 5★ reviews that mean is about 4.9 and would let a single 5 still win.
 * The cards keep showing the plain average and the count.
 */
export const RATING_PRIOR = 3;
export const RATING_PRIOR_WEIGHT = 3;

/** The score Top rated sorts by. */
export function weightedRating(rating: ShopRating): number {
  return (RATING_PRIOR_WEIGHT * RATING_PRIOR + rating.average * rating.count) / (RATING_PRIOR_WEIGHT + rating.count);
}

export function buildRatingsIndex(rows: QdnResourceSummary[], complete = true): RatingsIndex {
  // short shop id → reviewer → their latest rating
  const byShop = new Map<string, Map<string, { rating: number; at: number }>>();
  for (const row of rows) {
    if (!row?.name || !row.identifier) continue;
    const short = shortStoreIdOfReview(row.identifier);
    if (!short) continue;
    const rating = ratingFromReviewIdentifier(row.identifier, short);
    if (rating === null) continue;
    const at = row.updated ?? row.created ?? 0;
    let reviewers = byShop.get(short);
    if (!reviewers) {
      reviewers = new Map();
      byShop.set(short, reviewers);
    }
    const previous = reviewers.get(row.name);
    if (!previous || at > previous.at) reviewers.set(row.name, { rating, at });
  }

  const memo = new Map<string, ShopRating | null>();
  return {
    complete,
    get(owner, shortStoreId) {
      const key = shopKey(owner, shortStoreId);
      const known = memo.get(key);
      if (known !== undefined) return known;
      let sum = 0;
      let count = 0;
      byShop.get(shortStoreId)?.forEach((review, reviewer) => {
        if (reviewer === owner) return;
        sum += review.rating;
        count += 1;
      });
      const result = count > 0 ? { average: sum / count, count } : null;
      memo.set(key, result);
      return result;
    },
  };
}

/** "4.5": one decimal, as the stars show it. */
export function formatRating(average: number): string {
  return (Math.round(average * 10) / 10).toFixed(1);
}

let lastRatings: RatingsIndex | null = null;

/** The ratings this session already loaded, if any. */
export function peekRatings(): RatingsIndex | null {
  return lastRatings;
}

export async function loadRatings(options: { fresh?: boolean } = {}): Promise<RatingsIndex> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: `${REVIEW_BASE}-`, prefix: true, excludeblocked: true },
    { pageSize: REVIEWS_INDEX_PAGE_SIZE, maxPages: REVIEWS_INDEX_MAX_PAGES, fresh: options.fresh }
  );
  lastRatings = buildRatingsIndex(rows, complete);
  return lastRatings;
}

/** For tests. */
export function resetRatingsMemory(): void {
  lastRatings = null;
}
