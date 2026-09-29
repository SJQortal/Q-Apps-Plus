import { setFeeData } from "../../../state/features/globalSlice.ts";
import { store } from "../../../state/store.js";
import { objectToFile } from "../../../utils/PublishFormatter.ts";
import { appName, FEE_BASE, FeeType } from "../FeeData.tsx";

export type CoinType = "QORT" | "BTC" | "LTC" | "DOGE" | "DGB" | "RVN" | "ARRR";

export interface FeePrice {
  time: number;
  feeAmount: number;
  feeType: FeeType; // used to differentiate different types of fees such as comments, likes, data, etc.
  coinType: CoinType;
}

export const feesPublishService = "DOCUMENT";

export const fetchFees = async () => {
  const feeData = store.getState().global.feeData;
  if (feeData.length > 0) {
    return feeData;
  }

  try {
    const response = await qortalRequest({
      action: "FETCH_QDN_RESOURCE",
      identifier: FEE_BASE,
      name: "Q-Support",
      service: feesPublishService,
    });

    return (await response) as FeePrice[];
  } catch (e) {
    console.log("fetch current fees error: ", e);
    return [] as FeePrice[];
  }
};

export const fetchFeesRedux = () => {
  const feeData = store.getState().global.feeData;
  if (feeData.length > 0) {
    return feeData;
  }

  fetchFees().then(feeData => store.dispatch(setFeeData(feeData)));
};

export const fetchCurrentPriceData = async (
  feeType: FeeType = "default",
  coinType: CoinType = "QORT"
) => {
  const fees = await fetchFees();
  if (fees?.length === 0 || !fees) return undefined;

  const filteredFees = fees.filter(
    price => price.feeType === feeType && price.coinType === coinType
  );

  return filteredFees.at(-1) as FeePrice;
};

const feeFilter = (fee: FeePrice, feeToVerify: FeePrice) => {
  const nameCheck = fee.feeType === feeToVerify.feeType;
  const coinTypeCheck = fee.coinType === feeToVerify.coinType;
  const timeCheck = fee.time <= feeToVerify.time;
  const filter = nameCheck && coinTypeCheck && timeCheck;

  return filter;
};

export const verifyFeeAmount = async (feeToVerify: FeePrice) => {
  const fees = await fetchFees();
  const filteredFees = fees.filter(fee => feeFilter(fee, feeToVerify));
  if (filteredFees.length === 0) {
    console.log("no filtered fees");
    return false;
  }
  // gets fee that applies at the time of feeToVerify
  const feeToCheck = filteredFees.at(-1);
  const isFeeAmountValid = feeToVerify.feeAmount >= feeToCheck.feeAmount;

  return isFeeAmountValid;
};
