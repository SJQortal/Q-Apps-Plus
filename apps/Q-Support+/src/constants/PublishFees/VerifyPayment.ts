import { feeDestinationName, maxFeePublishTimeDiff } from "./FeeData.tsx";
import {
  getAccountNames,
  getTransactionBySignatureResponse,
  objectHasNullValues,
  objectToPublishFeeData,
} from "./VerifyPayment-Functions.ts";
import { verifyFeeAmount } from "./FeePricePublish/FeePricePublish.ts";
import { getNameData, PublishFeeData } from "./SendFeeFunctions.ts";
import { Issue } from "../../state/features/fileSlice.ts";

const getSignature = async (signature: string) => {
  const url = "/transactions/signature/" + signature;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return (await response.json()) as getTransactionBySignatureResponse;
};

const verifySignature = async (feeData: PublishFeeData) => {
  const {
    signature,
    createdTimestamp,
    updatedTimestamp,
    feeType,
    coinType,
    senderName,
  } = feeData;

  const [signatureData, accountData] = await Promise.all([
    getSignature(signature),
    getNameData(senderName),
  ]);

  const namesofFeeRecipient = await getAccountNames(signatureData.recipient);
  const doesFeeAmountMatch = await verifyFeeAmount({
    time: signatureData.timestamp,
    feeAmount: +signatureData.amount,
    feeType,
    coinType,
  });

  const signatureTime = signatureData.timestamp;
  let doesTimeMatch = false;
  if (!updatedTimestamp) {
    const timeDiff = createdTimestamp - signatureTime;
    const timeDiffMinutes = Math.abs(timeDiff) / 1000 / 60;

    doesTimeMatch = timeDiffMinutes <= maxFeePublishTimeDiff;
  } else {
    const minutesPublishDiff = 1000 * 60 * maxFeePublishTimeDiff;
    const startTime = createdTimestamp - minutesPublishDiff;
    const endTime = updatedTimestamp;

    const sigTimeAfterStartTime = signatureTime > startTime;
    const sigTimeBeforeEndTime = signatureTime < endTime;

    doesTimeMatch = sigTimeAfterStartTime && sigTimeBeforeEndTime;
  }

  const doesSignatureMatch = signature === signatureData?.signature;

  const doesSenderMatch = signatureData.creatorAddress === accountData.owner;

  const doesFeeRecipientNameMatch =
    namesofFeeRecipient.findIndex(
      nameData => nameData?.name === feeDestinationName
    ) >= 0;

  if (!doesTimeMatch) console.log("Time does not match");
  if (!doesSignatureMatch) console.log("Signature does not match");
  if (!doesSenderMatch) console.log("Sender does not match");
  if (!doesFeeRecipientNameMatch) console.log("Recipient does not match");
  if (!doesFeeAmountMatch) console.log("FeeAmount does not match");
  return (
    doesTimeMatch &&
    doesSignatureMatch &&
    doesSenderMatch &&
    doesFeeRecipientNameMatch &&
    doesFeeAmountMatch
  );
};

export const verifyPayment = async (publishToVerify: Issue) => {
  if (!publishToVerify) return false;

  const publishFeeData = objectToPublishFeeData(publishToVerify);

  if (objectHasNullValues(publishFeeData)) return false;

  const verifyFunctionsList: Promise<boolean>[] = [];

  verifyFunctionsList.push(verifySignature(publishFeeData));

  const paymentChecks = await Promise.all(verifyFunctionsList);
  return paymentChecks.every(check => check === true);
};

export const appendIsPaidToFeeData = (issue: Issue, isPaid: boolean): Issue => {
  return {
    ...issue,
    feeData: {
      ...(issue?.feeData || { signature: undefined, senderName: "" }),
      isPaid,
    },
  };
};
export const verifyAllPayments = async (issues: Issue[]) => {
  const verifiedPayments = await Promise.all(
    issues.map(issue => verifyPayment(issue))
  );

  return issues.map((issue, index) => {
    return appendIsPaidToFeeData(issue, verifiedPayments[index]);
  });
};
