import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addToHashMap,
  removeFromHashMap,
  upsertCrowdfunds,
  Crowdfund,
} from "../state/features/crowdfundSlice";

import { RootState } from "../state/store";
import { fetchAndEvaluateCrowdfunds } from "../utils/fetchCrowdfunds";
import { CROWDFUND_BASE } from "../constants";

export const useFetchCrowdfunds = () => {
  const dispatch = useDispatch();
  const hashMapCrowdfund = useSelector(
    (state: RootState) => state.crowdfund.hashMapCrowdfunds
  );
  const crowdfunds = useSelector(
    (state: RootState) => state.crowdfund.crowdfunds
  );

  const checkAndUpdateResource = React.useCallback(
    (crowdfund: Crowdfund) => {
      const existingCrowdfund = hashMapCrowdfund[crowdfund.id];
      if (!existingCrowdfund) {
        return true;
      } else if (
        crowdfund?.updated &&
        existingCrowdfund?.updated &&
        (!existingCrowdfund?.updated || crowdfund?.updated) >
          existingCrowdfund?.updated
      ) {
        return true;
      } else {
        return false;
      }
    },
    [hashMapCrowdfund]
  );

  const getCrowdfund = async (
    user: string,
    identifier: string,
    content: any
  ) => {
    const res = await fetchAndEvaluateCrowdfunds({
      user,
      identifier,
      content,
    });
    if (res?.isValid) {
      dispatch(addToHashMap(res));
    } else {
      dispatch(removeFromHashMap(identifier));
    }
  };

  const getCrowdfunds = React.useCallback(async () => {
    try {
      const offset = crowdfunds.length;
      const listLimit = 20;
      const url = `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&query=${CROWDFUND_BASE}&limit=${listLimit}&includemetadata=false&reverse=true&excludeblocked=true&exactmatchnames=true&offset=${offset}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();

      const structureData = responseData.map((resource: any): Crowdfund => {
        return {
          title: resource?.metadata?.title,
          category: resource?.metadata?.category,
          categoryName: resource?.metadata?.categoryName,
          tags: resource?.metadata?.tags || [],
          description: resource?.metadata?.description,
          created: resource?.created,
          updated: resource?.updated,
          user: resource.name,
          id: resource.identifier,
        };
      });
      dispatch(upsertCrowdfunds(structureData));

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdateResource(content);
          if (res) {
            getCrowdfund(content.user, content.id, content);
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [crowdfunds, hashMapCrowdfund]);

  return {
    getCrowdfunds,
    checkAndUpdateResource,
    getCrowdfund,
    hashMapCrowdfund,
  };
};
