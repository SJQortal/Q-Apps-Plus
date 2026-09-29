import { Issue } from "../../state/features/fileSlice.ts";
import { PublishFeeData } from "./SendFeeFunctions.ts";

export type AccountName = { name: string; owner: string };

export interface GetRequestData {
  limit?: number;
  offset?: number;
  reverse?: boolean;
}

export interface getTransactionBySignatureResponse {
  type: "string";
  timestamp: number;
  reference: string;
  fee: number;
  signature: string;
  txGroupId: number;
  recipient: string;
  blockHeight: number;
  approvalStatus: string;
  creatorAddress: string;
  senderPublicKey: string;
  amount: string;
}

export const stringIsEmpty = (value: string) => {
  return value === "";
};

export const getAccountNames = async (
  address: string,
  params?: GetRequestData
) => {
  const names = (await qortalRequest({
    action: "GET_ACCOUNT_NAMES",
    address: address,
    ...params,
  })) as AccountName[];

  const namelessAddress = { name: "", owner: address };
  const emptyNamesFilled = names.map(({ name, owner }) => {
    return stringIsEmpty(name) ? namelessAddress : { name, owner };
  });

  const returnValue =
    emptyNamesFilled.length > 0 ? emptyNamesFilled : [namelessAddress];
  return returnValue as AccountName[];
};

export const getUserAccountNames = async () => {
  const account = await getUserAccount();
  return await getAccountNames(account.address);
};

export const userHasName = async (name: string) => {
  const userAccountNames = await getUserAccountNames();
  const userNames = userAccountNames.map(userName => userName.name);
  return userNames.includes(name);
};

export const objectToPublishFeeData = (object: Issue) => {
  const createdTimestamp = +object?.created || 0;
  const updatedTimestamp = +object?.updated || 0;
  return {
    signature: object?.feeData?.signature,
    createdTimestamp,
    updatedTimestamp,
    feeType: object?.feeData?.feeType || "default",
    coinType: object?.feeData?.coinType || "QORT",
    senderName: object?.user,
    isPaid: object?.feeData?.isPaid || false,
  } as PublishFeeData;
};
export const objectHasNullValues = (object: object) => {
  const objectAsArray = Object.values(object);
  return objectAsArray.some(value => value == null);
};

export type AccountInfo = { address: string; publicKey: string };
export const getUserAccount = async () => {
  return (await qortalRequest({
    action: "GET_USER_ACCOUNT",
  })) as AccountInfo;
};
