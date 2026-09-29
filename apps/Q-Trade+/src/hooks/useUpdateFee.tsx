import { useAtom } from 'jotai/react';
import React, { useCallback, useContext, useMemo } from 'react'
import { calculateRateFromFee } from '../components/sell/FeeManager';
import { isEnabledCustomLockingFeeAtom } from '../global/state';
import gameContext from '../contexts/gameContext';

export const useUpdateFee = ({setFee,  selectedCoin}) => {
  const [isEnabledCustomLockingFee, setIsEnabledCustomLockingFee] = useAtom(
    isEnabledCustomLockingFeeAtom
  );

    const {

      getCoinLabel,

    } = useContext(gameContext);


    const coin = useMemo(() => {
      const coinLabel = getCoinLabel(selectedCoin);
      if (typeof coinLabel !== "string") return null;
      return coinLabel?.toLowerCase();
    }, [selectedCoin, getCoinLabel]);
    const updateFee = useCallback(async (suggestedFee ) => {
        const typeRequest = "feerequired";
        const typeRequestLocking = "feekb";
    
     
          
          const feeToSave = +suggestedFee

          const response = await qortalRequestWithTimeout(
            {
              action: "UPDATE_FOREIGN_FEE",
              coin: coin,
              type: typeRequest,
              value: feeToSave,
            },
            1800000
          );
    
          if (!isEnabledCustomLockingFee) {
            await qortalRequestWithTimeout(
              {
                action: "UPDATE_FOREIGN_FEE",
                coin: coin,
                type: typeRequestLocking,
                value: calculateRateFromFee(feeToSave, 300),
              },
              1800000
            );
          }
    
          if (response && !isNaN(+response)) {
            setFee(response);
            return response
          } else throw new Error("Unable to update fee");
      
      }, [coin, isEnabledCustomLockingFee, setFee]);
  return updateFee
}
