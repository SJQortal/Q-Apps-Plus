import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapStoreReviews } from "../state/features/storeSlice";
import type { RootState } from "../state/store";
import { fetchReview } from "../utils/fetchStoreReviews";

interface Resource {
  id: string;
  updated?: number;
}

/**
 * Full reviews by id (`store.hashMapStoreReviews`), read once each. The
 * original also stored failed reads, which crashed the reducer on
 * `undefined`; only real reviews are kept now.
 */
export const useFetchStoreReviews = () => {
  const dispatch = useDispatch();
  const hashMapStoreReviews = useSelector((state: RootState) => state.store.hashMapStoreReviews);

  /** Reads the review's JSON and keeps it. Rejects when the node can't give it (yet); null when it isn't a review. */
  const getReview = useCallback(
    async (owner: string, reviewId: string) => {
      const review = await fetchReview(owner, reviewId);
      if (review) dispatch(addToHashMapStoreReviews(review));
      return review;
    },
    [dispatch]
  );

  /** True when the review isn't kept yet, or the search says it changed since. */
  const checkAndUpdateResource = useCallback(
    (resource: Resource) => {
      const existing = hashMapStoreReviews[resource.id];
      if (!existing) return true;
      return !!(resource.updated && existing.updated && resource.updated > existing.updated);
    },
    [hashMapStoreReviews]
  );

  return { getReview, checkAndUpdateResource, hashMapStoreReviews };
};
