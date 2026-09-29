import { appName } from "../FeeData.tsx";
import { userHasName } from "../VerifyPayment-Functions.ts";
import { DataEditor } from "./DataEditor.tsx";
import { DataTable } from "./DataTable.tsx";
import { FeePrice, fetchFees } from "./FeePricePublish.ts";
import React, { useEffect, useState } from "react";

export interface FeeHistoryModalBodyProps {
  showFeeType?: boolean;
  showCoinType?: boolean;
  filterData?: () => string[][];
}
export const FeeHistoryModalBody = ({
  showFeeType = true,
  showCoinType = true,
}: FeeHistoryModalBodyProps) => {
  const [feeData, setFeeData] = useState<FeePrice[]>([]);
  const [userOwnsApp, setUserOwnsApp] = useState<boolean>(false);

  const fetchFeesOnStartup = () => {
    fetchFees().then(feeResponse => {
      setFeeData(feeResponse);
    });
    userHasName(appName).then(userHasName => setUserOwnsApp(userHasName));
  };

  useEffect(fetchFeesOnStartup, []);

  const columnNames = ["ID", "Date", "Fee Amount"];
  if (showFeeType) columnNames.push("Fee Type");
  if (showCoinType) columnNames.push("Coin Type");

  return userOwnsApp ? (
    <DataEditor columnNames={columnNames} data={feeData} />
  ) : (
    <DataTable columnNames={columnNames} data={feeData} />
  );
};
