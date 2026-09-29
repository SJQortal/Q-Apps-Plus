import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapStoreReviews } from "../state/features/storeSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateStoreReviews } from "../utils/fetchStoreReviews";

interface Resource {
  id: string;
  updated?: number;
}

export const useFetchStoreReviews = () => {
  const dispatch = useDispatch();
  const hashMapStoreReviews = useSelector(
    (state: RootState) => state.store.hashMapStoreReviews
  );

  // Get the review raw data from QDN
  const getReview = async (owner: string, reviewId: string, content: any) => {
    const res = await fetchAndEvaluateStoreReviews({
      owner,
      reviewId,
      content
    });

    dispatch(addToHashMapStoreReviews(res));
  };

  // Make sure that raw data isn't already present in Redux hashmap
  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // Check if the post exists in hashMapPosts
      const existingResource = hashMapStoreReviews[resource.id];
      if (!existingResource) {
        // If the post doesn't exist, add it to hashMapPosts
        return true;
      } else if (
        resource?.updated &&
        existingResource?.updated &&
        resource.updated > existingResource.updated
      ) {
        // If the post exists and its updated is more recent than the existing post's updated, update it in hashMapPosts
        return true;
      } else {
        return false;
      }
    },
    [hashMapStoreReviews]
  );

  return {
    getReview,
    checkAndUpdateResource
  };
};
