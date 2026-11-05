/**
 * A review's full JSON (`{title, description, rating, created}`, DOCUMENT
 * `q-store-review-…` under the reviewer's name), through the session cache.
 * Lists show the metadata's short copy; this is for "Read more".
 */
import { checkStructureStoreReviews } from "./checkStructure";
import { fetchQdnJson } from "../qdn/search";

/** The review, or null when it isn't a review. Rejects when the node can't give it (yet). */
export async function fetchReview(owner: string, reviewId: string, options: { fresh?: boolean } = {}) {
  const json = await fetchQdnJson("DOCUMENT", owner, reviewId, options);
  if (!checkStructureStoreReviews(json)) return null;
  return { ...json, id: reviewId, name: owner, isValid: true as const };
}

/** The original's shape: `{ ...review, id, isValid }`, `isValid: false` when it can't be read. */
export const fetchAndEvaluateStoreReviews = async (data: { owner?: string; reviewId?: string; content?: any }) => {
  const { owner, reviewId, content } = data ?? {};
  const invalid = { ...content, isValid: false };
  if (!owner || !reviewId) return invalid;
  try {
    return (await fetchReview(owner, reviewId)) ?? invalid;
  } catch {
    return invalid;
  }
};
