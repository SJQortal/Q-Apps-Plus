import moment from "moment";
import { CoinType } from "../constants/PublishFees/FeePricePublish/FeePricePublish.ts";
import { NameData } from "../constants/PublishFees/SendFeeFunctions.ts";
import {
  getUserAccount,
  getUserAccountNames,
} from "../constants/PublishFees/VerifyPayment-Functions.ts";
import { Issue } from "../state/features/fileSlice.ts";
import { isNumber } from "./utilFunctions.ts";

export const getNameData = async (name: string) => {
  return (await qortalRequest({
    action: "GET_NAME_DATA",
    name: name,
  })) as NameData;
};

export const sendQchatDM = async (
  recipientName: string,
  message: string,
  allowSelfAsRecipient = false
) => {
  if (!allowSelfAsRecipient) {
    const userAccountNames = await getUserAccountNames();
    const userNames = userAccountNames.map(name => name.name);
    if (userNames.includes(recipientName)) return;
  }

  const address = await getNameData(recipientName);
  try {
    return await qortalRequest({
      action: "SEND_CHAT_MESSAGE",
      destinationAddress: address.owner,
      message,
    });
  } catch (e) {
    console.log(e);
    return false;
  }
};

export interface BountyData {
  amount: number;
  coinType: CoinType;
  crowdfundLink?: string;
  sourceCodeLink?: string;
}

export const getATAmount = async crowdfundLink => {
  const crowdfund = await getCrowdfund(crowdfundLink);
  const atAddress = crowdfund?.deployedAT?.aTAddress;
  if (!atAddress) return 0;
  try {
    const res = await qortalRequest({
      action: "SEARCH_TRANSACTIONS",
      txType: ["PAYMENT"],
      confirmationStatus: "CONFIRMED",
      address: atAddress,
      limit: 0,
      reverse: true,
    });
    if (res?.length > 0) {
      const totalAmount: number = res.reduce(
        (total: number, transaction) => total + parseFloat(transaction.amount),
        0
      );
      return totalAmount;
    }
  } catch (e) {
    console.log(e);
    return 0;
  }
};

export const getCrowdfund = async (crowdfundLink: string) => {
  const splitLink = crowdfundLink.split("/");
  const name = splitLink[5];
  const identifier = splitLink[6];

  return await qortalRequest({
    action: "FETCH_QDN_RESOURCE",
    service: "DOCUMENT",
    name,
    identifier,
  });
};

export const getATInfo = async (atAddress: string) => {
  try {
    const url = `/at/${atAddress}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (response.status === 200) {
      return await response.json();
    }
  } catch (error) {
    console.log(error);
    return undefined;
  }
};

export const getNodeInfo = async () => {
  try {
    const url = `/blocks/height`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const responseDataSearch = await response.json();
    return { height: responseDataSearch };
  } catch (error) {
    console.log(error);
  }
};

export const getCrowdfundEndDate = async (crowdfundLink: string) => {
  const { deployedAT } = await getCrowdfund(crowdfundLink);

  const ATinfo = await getATInfo(deployedAT.aTAddress);
  const nodeInfo = await getNodeInfo();
  if (!ATinfo?.sleepUntilHeight || !nodeInfo?.height) return null;

  const blocksRemaining = +ATinfo?.sleepUntilHeight - +nodeInfo.height;
  return moment().add(blocksRemaining, "minutes");
};

export type DayTime = { days: number; hours: number; minutes: number };
export const getDurationFromBlocks = (blocks: number, blockCount: number) => {
  const minutesPerDay = 60 * 24;
  const blocksPerMinute = blockCount / minutesPerDay;
  const duration = blocks / blocksPerMinute;

  const days = Math.floor(duration / minutesPerDay);
  const hours = Math.floor((duration % minutesPerDay) / 60);
  const minutes = Math.floor(duration % 60);

  return { days, hours, minutes } as DayTime;
};

export const getATaddress = async (crowdfundLink: string) => {
  const { deployedAT } = await getCrowdfund(crowdfundLink);
  return deployedAT?.aTAddress;
};

export const getHasQFundEnded = async (atAddress: string) => {
  const url = `/at/${atAddress}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (response.status === 200) {
    const responseDataSearch = await response.json();
    return !!(
      Object.keys(responseDataSearch).length > 0 &&
      responseDataSearch?.isFinished
    );
  }
};
export interface SummaryTransactionCounts {
  arbitrary: number;
  AT: number;
  deployAt: number;
  groupInvite: number;
  joinGroup: number;
  message: number;
  payment: number;
  registerName: number;
  rewardShare: number;
  updateName: number;
  voteOnPoll: number;
}

export interface DaySummaryResponse {
  assetsIssued: number;
  blockCount: number;
  namesRegistered: number;
  totalTransactionCount: number;
  transactionCountByType: SummaryTransactionCounts;
}

export const getDaySummary = async () => {
  return (await qortalRequest({
    action: "GET_DAY_SUMMARY",
  })) as DaySummaryResponse;
};

export const validateBountyInput = async (input: string) => {
  if (isNumber(input)) return true;

  try {
    const crowdfund = await getCrowdfund(input);
    const ATaddress = crowdfund.aTAddress;

    return ATaddress !== "";
  } catch (e) {
    console.log(e);
    return false;
  }
};

export const appendBountyAmount = (issue: Issue, bountyAmount: number) => {
  return {
    ...issue,
    bountyData: {
      amount: bountyAmount || undefined,
      coinType: issue?.bountyData?.coinType,
    },
  };
};
export const getBountyAmounts = async (issues: Issue[]) => {
  const issuePromises = issues.map(issue => {
    if (!issue?.bountyData?.crowdfundLink) {
      const numberAsPromise = async (num: number) => num;
      return numberAsPromise(Number(issue?.bountyData?.amount) || undefined);
    }

    return getATAmount(issue?.bountyData?.crowdfundLink);
  });

  const bountyAmounts = await Promise.all(issuePromises);
  return issues.map((issue, index) => {
    return appendBountyAmount(issue, bountyAmounts[index]);
  });
};

export const getBalance = async (address: string) => {
  return (await qortalRequest({
    action: "GET_BALANCE",
    address,
  })) as number;
};

export const getUserBalance = async () => {
  const accountInfo = await getUserAccount();
  return (await getBalance(accountInfo.address)) as number;
};

export const getAvatarFromName = async (name: string) => {
  return await qortalRequest({
    action: "GET_QDN_RESOURCE_URL",
    name,
    service: "THUMBNAIL",
    identifier: "qortal_avatar",
  });
};
