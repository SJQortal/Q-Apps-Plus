import { CheckBox } from "@mui/icons-material";
import { Box } from "@mui/material";
import React from "react";
import { StateCheckBox } from "../../utils/StateCheckBox.tsx";
import { useTestIdentifiers } from "../Identifiers.ts";
import {
  FeePrice,
  fetchCurrentPriceData,
} from "./FeePricePublish/FeePricePublish.ts";

export const appName = "Q-Support";
export const feeDestinationName = "Q-Support";

export const FEE_BASE = useTestIdentifiers
  ? "MYTEST_support_fees"
  : "q_support_fees";
export const feeDataDefault = await fetchCurrentPriceData("default", "QORT");
export const feePriceToString = (feePrice: FeePrice) => {
  return `${feePrice?.feeAmount} ${feePrice?.coinType}`;
};

export const supportedCoins = [
  "QORT",
  "BTC",
  "LTC",
  "DOGE",
  "DGB",
  "RVN",
  "ARRR",
].sort((a, b) => {
  return a.localeCompare(b);
});
export const maxFeePublishTimeDiff = 10; // time in minutes before/after publish when fee is considered valid
export type FeeType = "default" | "comment" | "like" | "dislike" | "superlike";

// use wherever the fee is communicated to the user
const feeCheckBox = (
  <StateCheckBox
    label={`I agree to pay a fee of ${feePriceToString(feeDataDefault)} to support further development of ${appName}`}
    defaultChecked
  />
);

// // Test senderName removal on Publish
// export const feeDisclaimerString = `When Publishing (but not editing) Issues ${feeAmountBase} \n
// QORT is requested to fund continued development of Q-Support.`;
//
// export const feeDisclaimer = (
//   <Box
//     sx={{
//       fontSize: "28px",
//       color: "#f44336",
//       fontWeight: 600,
//     }}
//   >
//     {feeDisclaimerString}
//   </Box>
// );
