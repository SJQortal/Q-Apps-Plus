import CSS from "csstype";
import moment from "moment";

import React, { useEffect, useState } from "react";
import {
  BountyData,
  DayTime,
  getATaddress,
  getATAmount,
  getCrowdfundEndDate,
  getDaySummary,
  getDurationFromBlocks,
  getHasQFundEnded,
} from "../../utils/qortalRequests.js";
import { CoinIcon } from "./CoinIcon.js";

type TimeDisplay = "TIME" | "AMOUNT" | "BOTH";
interface BountyDataProps {
  bountyData?: BountyData;
  timeDisplay?: TimeDisplay;
  fontStyle?: CSS.Properties;
  divStyle?: CSS.Properties;
}
export const BountyDisplay = ({
  bountyData,
  timeDisplay = "TIME",
  divStyle,
  fontStyle,
}: BountyDataProps) => {
  const emptyTime: DayTime = { days: 0, hours: 0, minutes: 0 };
  const [timeRemaining, setTimeRemaining] = useState<DayTime>(emptyTime);
  const [hasQfundEnded, setHasQfundEnded] = useState<boolean>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [amount, setAmount] = useState<number>(bountyData?.amount);
  const setTimeRemainingState = () => {
    getCrowdfundEndDate(crowdfundLink).then(endDate => {
      if (!endDate) return;
      const blocksRemaining = moment
        .duration(endDate.diff(moment()))
        .asMinutes();
      getDaySummary().then(response => {
        const blockCount = response.blockCount;
        const timeCount = getDurationFromBlocks(blocksRemaining, blockCount);
        setTimeRemaining(timeCount);
      });
    });
  };

  const initializeBountyDisplay = async () => {
    if (!crowdfundLink) {
      setIsLoading(false);
      return;
    }

    setTimeRemainingState();
    const address = await getATaddress(crowdfundLink);
    const QfundState = await getHasQFundEnded(address);
    setAmount(await getATAmount(crowdfundLink));
    setHasQfundEnded(QfundState);
    setIsLoading(false);
  };
  useEffect(() => {
    initializeBountyDisplay();
    setInterval(initializeBountyDisplay, 60_001);
  }, []);

  const padDigits = (num: number) => {
    let output = "";
    if (num < 10) output += "0";
    return output + num.toString();
  };
  if (!bountyData) return <></>;

  const { coinType, crowdfundLink } = bountyData;
  const hasCrowdfund = !!crowdfundLink;
  const { days, hours, minutes } = timeRemaining;

  const defaultDivStyle = {
    display: "flex",
    alignItems: "center",
  };

  const timeIsEmpty = days === 0 && hours === 0 && minutes === 0;
  const shortTimeDisplay = `${padDigits(days)}:${padDigits(hours)}:${padDigits(minutes)}`;
  const longTimeDisplay = `${days} Days ${hours} Hours ${minutes} Minutes left\n`;
  const timeJSX = timeIsEmpty ? (
    <></>
  ) : (
    <span style={{ ...divStyle, ...fontStyle }}>
      {timeDisplay === "BOTH" ? longTimeDisplay : shortTimeDisplay}
    </span>
  );

  const amountJSX = (
    <div style={{ ...defaultDivStyle, ...divStyle }}>
      {(amount > 0 || hasCrowdfund) && !isLoading && (
        <>
          <CoinIcon
            coinType={coinType}
            style={{
              marginRight: "10px",
              width: "40px",
              height: "40px",
            }}
            isQfund={hasCrowdfund}
          />
          <span style={fontStyle}>{Math.round(amount)}</span>
        </>
      )}
    </div>
  );

  switch (timeDisplay) {
    case "AMOUNT":
      return amountJSX;
    case "TIME":
      return hasQfundEnded ?? hasQfundEnded === undefined ? amountJSX : timeJSX;
    case "BOTH":
      return (
        <>
          <div style={{ display: "flex" }}>
            {amountJSX}
            <div style={{ width: "10px", marginLeft: "10%" }} />
            {timeJSX}
          </div>
        </>
      );
  }
};
