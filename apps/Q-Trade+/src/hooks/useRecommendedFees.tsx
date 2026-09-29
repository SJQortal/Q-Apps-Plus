import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import gameContext from '../contexts/gameContext';
import { QortalGetMetadata, usePublish } from 'qapp-core';
import { useAtom } from 'jotai/react';
import { selectedFeePublisherAtom } from '../global/state';
import { isValidFeeEstimate } from '../components/sell/FeeManager';

export const useRecommendedFees = ({selectedCoin, recommendedFee}) => {
const { getCoinLabel } = useContext(gameContext);
 const [selectedFeePublisher, setSelectedFeePublisher] = useAtom(
    selectedFeePublisherAtom
  );
  
const [feeLocation, setFeeLocation] = useState<QortalGetMetadata>({
    name: "",
    identifier: "",
    service: "JSON",
  });
  const { resource } = usePublish(3, "JSON", feeLocation);

    const coin = useMemo(() => {
      const coinLabel = getCoinLabel(selectedCoin);
      if (typeof coinLabel !== "string") return null;
      return coinLabel?.toLowerCase();
    }, [selectedCoin, getCoinLabel]);

     const getLatestFees = useCallback(async () => {
        try {
          const coinLabel = getCoinLabel(selectedCoin);
          if (typeof coinLabel !== "string") return;
          const coin = coinLabel?.toUpperCase();
          const identifier = `coinInfo-${coin}`;
          const res = await fetch(
            `/arbitrary/resources/searchsimple?service=JSON&identifier=${identifier}&name=${selectedFeePublisher}&prefix=true&limit=1&reverse=true`
          );
          const data = await res.json();
          if (data && data?.length > 0) {
            setFeeLocation(data[0]);
          }
        } catch (error) {
          console.error(error);
        }
      }, [selectedFeePublisher, selectedCoin]);
    
      useEffect(() => {
        getLatestFees();
      }, [getLatestFees]);

        const recommendedFeeData = useMemo(() => {
          if (
            !resource?.qortalMetadata?.identifier?.includes(`${coin.toUpperCase()}`)
          )
            return;
          if (!resource?.data) return null;
          const isValid = isValidFeeEstimate(resource.data);
          if (!isValid) return null;
          return resource.data;
        }, [resource, coin]);
      
        const recommendedFeeDisplay = useMemo(() => {
          if (!recommendedFeeData) return null;
      
          if (!recommendedFeeData) return null;
          return recommendedFeeData[recommendedFee] || null;
        }, [recommendedFeeData, recommendedFee]);
      
        const hideRecommendations = useMemo(() => {
          if (recommendedFeeData) return false;
          return true;
        }, [recommendedFeeData]);
  return {
    hideRecommendations,
    recommendedFeeDisplay,
    coin
  }
}
