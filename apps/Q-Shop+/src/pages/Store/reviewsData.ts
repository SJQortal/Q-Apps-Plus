/**
 * A shop's reviews, read the way the original stores them (docs/apps/
 * Q-Shop+.md → Data contract): DOCUMENT `q-store-review-<shortStoreId>-<uid>-
 * <rating×10>` by the reviewer, the rating in the identifier and a short copy
 * of the title and text in the metadata, the full text in the JSON.
 *
 * One search serves both the shop header's average and the reviews panel:
 * identifier prefix + metadata, newest first, at most 300 rows (the
 * original sent `query=` searches of 100 and of 10 per page). Then, unlike
 * the original's average (bug 12):
 * - the exact shop is re-checked (the prefix of `my-shop` also matches
 *   `my-shop-2`'s reviews);
 * - the owner's own reviews don't count;
 * - each reviewer counts once, with their latest review.
 */
import { REVIEW_BASE, ratingFromReviewIdentifier, shopOrdersPrefix, shopReviewsPrefix, shortStoreIdOfOrder } from "../../qdn/identifiers";
import { searchQdn, searchQdnAll, type QdnResourceSummary } from "../../qdn/search";

/** Rows one shop's review search reads at most (3 pages of 100). */
export const REVIEW_SEARCH_CAP = 300;
const REVIEW_PAGE = 100;
/** Reviews the panel shows per page. */
export const REVIEWS_PAGE = 20;

export interface ShopReview {
  id: string;
  name: string;
  created: number;
  updated?: number;
  /** From the metadata (at most 60 characters) until the full review is read. */
  title: string;
  /** From the metadata (at most 150 characters) until the full review is read. */
  description: string;
  rating: number;
}

export interface ReviewSummary {
  /** The plain mean of the counted ratings, or null without reviews. */
  average: number | null;
  count: number;
  /** How many reviews give 1…5 stars (index 0 is one star); half stars round up. */
  distribution: [number, number, number, number, number];
}

function timeOf(review: { created?: number; updated?: number }): number {
  return Math.max(review.created ?? 0, review.updated ?? 0);
}

/** A search row as a review of this shop, or null when it isn't one. */
export function reviewFromRow(row: QdnResourceSummary, shortStoreId: string): ShopReview | null {
  if (!row?.identifier || !row.name) return null;
  const rating = ratingFromReviewIdentifier(row.identifier, shortStoreId);
  if (rating === null) return null;
  return {
    id: row.identifier,
    name: row.name,
    created: row.created ?? 0,
    updated: row.updated,
    title: typeof row.metadata?.title === "string" ? row.metadata.title : "",
    description: typeof row.metadata?.description === "string" ? row.metadata.description : "",
    rating,
  };
}

/**
 * The reviews that count: this shop's only, not the owner's, one per
 * reviewer (their latest), newest first. `extra` (reviews just published
 * here, which the node may not list yet) join the same rules.
 */
export function shopReviewsFrom(
  rows: QdnResourceSummary[],
  shortStoreId: string,
  owner: string | null | undefined,
  extra: ShopReview[] = []
): ShopReview[] {
  const latest = new Map<string, ShopReview>();
  const consider = (review: ShopReview | null) => {
    if (!review) return;
    if (owner && review.name === owner) return;
    const prev = latest.get(review.name);
    if (!prev || timeOf(review) > timeOf(prev) || (timeOf(review) === timeOf(prev) && review.id === prev.id)) {
      latest.set(review.name, review);
    }
  };
  rows.forEach((row) => consider(reviewFromRow(row, shortStoreId)));
  extra.filter((review) => ratingFromReviewIdentifier(review.id, shortStoreId) !== null).forEach(consider);
  return [...latest.values()].sort((a, b) => timeOf(b) - timeOf(a));
}

export function summarizeReviews(reviews: ShopReview[]): ReviewSummary {
  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  let total = 0;
  for (const review of reviews) {
    total += review.rating;
    const stars = Math.min(5, Math.max(1, Math.ceil(review.rating)));
    distribution[stars - 1] += 1;
  }
  return { average: reviews.length ? total / reviews.length : null, count: reviews.length, distribution };
}

/** The average for stars: to the nearest half. */
export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** The review search, shared (and cached for the session) by the header and the panel. */
export async function fetchReviewRows(shortStoreId: string, options: { fresh?: boolean } = {}) {
  return searchQdnAll(
    { service: "DOCUMENT", identifier: shopReviewsPrefix(shortStoreId), prefix: true, includemetadata: true, reverse: true },
    { pageSize: REVIEW_PAGE, maxPages: REVIEW_SEARCH_CAP / REVIEW_PAGE, fresh: options.fresh }
  );
}

/**
 * Which of these reviewers have an order at the shop ("Ordered here"): one
 * search for a page of names. A buyer's orders are DOCUMENT_PRIVATE
 * `q-store-order-<shortStoreId>-<uid>` under their own name; the shop is
 * re-checked because the prefix also matches longer shop ids. That is all
 * it shows: the order is encrypted, so neither the payment nor which
 * owner's shop of that short id it was for can be checked here.
 */
export async function fetchReviewersWithOrders(shortStoreId: string, names: string[]): Promise<Set<string>> {
  const wanted = [...new Set(names.filter(Boolean))];
  if (!shortStoreId || wanted.length === 0) return new Set();
  const rows = await searchQdn({
    service: "DOCUMENT_PRIVATE",
    identifier: shopOrdersPrefix(shortStoreId),
    prefix: true,
    names: wanted,
    exactmatchnames: true,
    includemetadata: false,
    limit: 100,
  });
  const ordered = new Set<string>();
  for (const row of rows) {
    if (wanted.includes(row.name) && shortStoreIdOfOrder(row.identifier) === shortStoreId) ordered.add(row.name);
  }
  return ordered;
}

/**
 * Whether `name` may review the shop: the original's rule, an order at the
 * shop under that name. A few rows rather than one, so an order at a shop
 * whose id merely starts the same (`my-shop-2`) can't hide one here.
 */
export async function hasOrderAtShop(shortStoreId: string, name: string, options: { fresh?: boolean } = {}): Promise<boolean> {
  if (!shortStoreId || !name) return false;
  // The prefix also matches longer shop ids ("art" finds "art-prints"), whose
  // newer orders can fill a whole page: look a few pages deep.
  for (let page = 0; page < 5; page++) {
    const rows = await searchQdn(
      {
        service: "DOCUMENT_PRIVATE",
        identifier: shopOrdersPrefix(shortStoreId),
        prefix: true,
        name,
        exactmatchnames: true,
        includemetadata: false,
        limit: 20,
        offset: page * 20,
      },
      options
    );
    if (rows.some((row) => row.name === name && shortStoreIdOfOrder(row.identifier) === shortStoreId)) return true;
    if (rows.length < 20) return false;
  }
  return false;
}

/** After a review is published: drop cached review searches so the next read is fresh. */
export function isReviewSearchUrl(url: string): boolean {
  return url.includes(`identifier=${REVIEW_BASE}-`);
}
