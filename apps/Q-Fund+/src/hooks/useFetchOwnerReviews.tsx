import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapOwnerReviews } from "../state/features/globalSlice";
import { RootState } from "../state/store";
import { fetchAndEvaluateOwnerReviews } from "../utils/fetchOwnerReviews";

interface Resource {
  id: string;
  updated?: number;
}

export const useFetchOwnerReviews = () => {
  const dispatch = useDispatch();
  const hashMapOwnerReviews = useSelector(
    (state: RootState) => state.global.hashMapOwnerReviews
  );

  // Get the review raw data from QDN
  const getReview = async (owner: string, reviewId: string, content: any) => {
    const res = await fetchAndEvaluateOwnerReviews({
      owner,
      reviewId,
      content,
    });

    dispatch(addToHashMapOwnerReviews(res));
  };

  // Make sure that raw data isn't already present in Redux hashmap
  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // Check if the post exists in hashMapPosts
      const existingResource = hashMapOwnerReviews[resource.id];
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
    [hashMapOwnerReviews]
  );

  return {
    getReview,
    checkAndUpdateResource,
  };
};
