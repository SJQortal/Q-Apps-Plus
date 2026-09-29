// Helpers copied verbatim from qortal-app-utils 1.2.1 (Qortal/Q-Apps-Utils),
// the subset this app uses. The package was dropped because it pulls its own
// MUI 5, react-quill and an npm package named "node" (which shadows Node
// inside npm scripts) into the build. Behaviour is unchanged.
import * as colorsys from "colorsys";

// ---- Colors
export const changeLightness = (hexColor: string, amount: number) => {
  const hsl = colorsys.hex2Hsl(hexColor);
  hsl.l += amount;
  return colorsys.hsl2Hex(hsl);
};

// ---- Numbers
export const setNumberWithinBounds = (
  num: number,
  minValue: number,
  maxValue: number
) => {
  if (num > maxValue) return maxValue;
  if (num < minValue) return minValue;
  return num;
};

// ---- String numbers
export const isIntegerNum = /^-?[0-9]+$/;
export const isFloatNum = /^-?[0-9]*\.?[0-9]*$/;
export const isAllZerosNum = /^0*\.?0*$/;

export const getSigDigits = (number: string) => {
  if (isIntegerNum.test(number)) return 0;
  const decimalSplit = number.split(".");
  return decimalSplit[decimalSplit.length - 1].length;
};

export const sigDigitsExceeded = (number: string, sigDigits: number) => {
  return getSigDigits(number) > sigDigits;
};

export const removeTrailingZeros = (s: string) => {
  return Number(s).toString();
};

export const mathOnStringNumbers = (
  s1: string,
  s2: string,
  operation: (n1: number, n2: number) => number
) => {
  const n1 = Number(s1);
  const n2 = Number(s2);
  if (isNaN(n1) || isNaN(n2)) throw TypeError("String is not a Number!");
  return operation(n1, n2).toString();
};
export const addStringNumbers = (s1: string, s2: string) => {
  return mathOnStringNumbers(s1, s2, (n1, n2) => {
    return n1 + n2;
  });
};

export const stringIsEmpty = (value: string) => {
  return value === "";
};

export const toNumber = (value: string | number) => {
  return Number(value);
};
export const truncateNumber = (value: string | number, sigDigits: number) => {
  const valueNum = toNumber(value);
  return valueNum.toFixed(sigDigits);
};

// ---- Qortal request wrappers
export type ConfirmationStatus = "CONFIRMED" | "UNCONFIRMED" | "BOTH";
export type TransactionType =
  | "GENESIS"
  | "PAYMENT"
  | "REGISTER_NAME"
  | "UPDATE_NAME"
  | "SELL_NAME"
  | "CANCEL_SELL_NAME"
  | "BUY_NAME"
  | "CREATE_POLL"
  | "VOTE_ON_POLL"
  | "ARBITRARY"
  | "ISSUE_ASSET"
  | "TRANSFER_ASSET"
  | "CREATE_ASSET_ORDER"
  | "CANCEL_ASSET_ORDER"
  | "MULTI_PAYMENT"
  | "DEPLOY_AT"
  | "MESSAGE"
  | "CHAT"
  | "PUBLICIZE"
  | "AIRDROP"
  | "AT"
  | "CREATE_GROUP"
  | "UPDATE_GROUP"
  | "ADD_GROUP_ADMIN"
  | "REMOVE_GROUP_ADMIN"
  | "GROUP_BAN"
  | "CANCEL_GROUP_BAN"
  | "GROUP_KICK"
  | "GROUP_INVITE"
  | "CANCEL_GROUP_INVITE"
  | "JOIN_GROUP"
  | "LEAVE_GROUP"
  | "GROUP_APPROVAL"
  | "SET_GROUP"
  | "UPDATE_ASSET"
  | "ACCOUNT_FLAGS"
  | "ENABLE_FORGING"
  | "REWARD_SHARE"
  | "ACCOUNT_LEVEL"
  | "TRANSFER_PRIVS"
  | "PRESENCE";

export interface GetRequestData {
  limit?: number;
  offset?: number;
  reverse?: boolean;
}

export interface TransactionSearchParams extends GetRequestData {
  startBlock?: number;
  blockLimit?: number;
  txGroupId?: number;
  txType: TransactionType[];
  address: string;
  confirmationStatus: ConfirmationStatus;
}

export interface SearchTransactionResponse {
  type: string;
  timestamp: number;
  reference: string;
  fee: string;
  signature: string;
  txGroupId: number;
  blockHeight: number;
  approvalStatus: string;
  creatorAddress: string;
  senderPublicKey: string;
  recipient: string;
  amount: string;
}

type AccountName = { name: string; owner: string };

export const getAccountNames = async (
  address: string,
  params?: GetRequestData
) => {
  const names = (await qortalRequest({
    action: "GET_ACCOUNT_NAMES",
    address,
    ...params,
  })) as AccountName[];

  const namelessAddress = { name: "", owner: address };
  const emptyNamesFilled = names.map(({ name, owner }) => {
    return stringIsEmpty(name) ? namelessAddress : { name, owner };
  });

  return emptyNamesFilled.length > 0 ? emptyNamesFilled : [namelessAddress];
};

export const getBalance = async (address: string) => {
  return (await qortalRequest({
    action: "GET_BALANCE",
    address,
  })) as number;
};

export type AccountInfo = { address: string; publicKey: string };

export const getUserAccount = async () => {
  return (await qortalRequest({
    action: "GET_USER_ACCOUNT",
  })) as AccountInfo;
};

export const getUserBalance = async () => {
  const accountInfo = await getUserAccount();
  return (await getBalance(accountInfo.address)) as number;
};

export const searchTransactions = async (params: TransactionSearchParams) => {
  return (await qortalRequest({
    action: "SEARCH_TRANSACTIONS",
    ...params,
  })) as SearchTransactionResponse[];
};
