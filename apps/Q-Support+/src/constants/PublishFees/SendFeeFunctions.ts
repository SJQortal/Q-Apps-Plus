import { feeDestinationName, FeeType } from "./FeeData.tsx";
import {
  CoinType,
  fetchCurrentPriceData,
} from "./FeePricePublish/FeePricePublish.ts";

export interface NameData {
  name: string;
  reducedName: string;
  owner: string;
  data: string;
  registered: number;
  isForSale: boolean;
}
export const getNameData = async (name: string) => {
  return qortalRequest({
    action: "GET_NAME_DATA",
    name: name,
  }) as Promise<NameData>;
};

export interface SendCoinResponse {
  amount: number;
  approvalStatus: string;
  fee: string;
  recipient: string;
  reference: string;
  senderPublicKey: string;
  signature: string;
  timestamp: number;
  txGroupId: number;
  type: string;
}

export const sendCoin = async (
  address: string,
  amount: number,
  coin: CoinType
) => {
  try {
    return (await qortalRequest({
      action: "SEND_COIN",
      coin,
      destinationAddress: address,
      amount,
    })) as SendCoinResponse;
  } catch (e) {
    console.log("sendCoin refused", e);
  }
};

export const sendQORT = async (address: string, amount: number) => {
  return await sendCoin(address, amount, "QORT");
};

export const sendQORTtoName = async (name: string, amount: number) => {
  const address = await getNameData(name);
  if (address) return await sendQORT(address.owner, amount);
  else throw Error("Name Not Found");
};

export interface PublishFeeData {
  signature: string;
  senderName?: string;
  createdTimestamp?: number; //timestamp of the metadata publish, NOT the send feeAmount publish, added after publish is fetched
  updatedTimestamp?: number;
  feeType?: FeeType;
  coinType?: CoinType;
  isPaid?: boolean;
}

export type CommentType = "reply" | "edit" | "comment";

export interface CommentObject {
  text: string;
  feeData: PublishFeeData;
}

export const payPublishFeeQORT = async (
  feeType: FeeType = "default",
  coinType: CoinType = "QORT"
) => {
  const feeData = await fetchCurrentPriceData(feeType, coinType);
  const publish = await sendQORTtoName(feeDestinationName, feeData.feeAmount);
  return publish?.signature;
};
