import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapStores } from "../state/features/storeSlice";
import { removeFromHashMapStores } from "../state/features/storeSlice";

import { RootState } from "../state/store";
import { fetchAndEvaluateProducts } from "../utils/fetchPosts";
import { fetchAndEvaluateStores } from "../utils/fetchStores";

interface Resource {
  id: string;
  updated: number;
}
export const useFetchStores = () => {
  const dispatch = useDispatch();
  const hashMapStores = useSelector(
    (state: RootState) => state.store.hashMapStores
  );

  const getStore = async (owner: string, storeId: string, content: any) => {
    const res = await fetchAndEvaluateStores({
      owner,
      storeId,
      content
    });
    if (res?.isValid) {
      dispatch(addToHashMapStores(res));
      return res;
    } else {
      dispatch(removeFromHashMapStores(storeId));
    }
  };

  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // Check if the post exists in hashMapPosts
      const existingResource = hashMapStores[resource.id];
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
    [hashMapStores]
  );

  return {
    getStore,
    checkAndUpdateResource
  };
};
