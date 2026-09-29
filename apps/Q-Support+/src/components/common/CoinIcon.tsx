import React, { CSSProperties } from "react";
import ARRRicon from "../../../src/assets/icons/CoinIcons/arrr.png";
import BTCicon from "../../../src/assets/icons/CoinIcons/btc.png";
import DGBicon from "../../../src/assets/icons/CoinIcons/dgb.png";
import DOGEicon from "../../../src/assets/icons/CoinIcons/doge.png";
import LTCicon from "../../../src/assets/icons/CoinIcons/ltc.png";
import QfundIcon from "../../../src/assets/icons/CoinIcons/Q-FundIcon.png";
import QORTicon from "../../../src/assets/icons/CoinIcons/qort.png";
import RVNicon from "../../../src/assets/icons/CoinIcons/rvn.png";
import { CoinType } from "../../constants/PublishFees/FeePricePublish/FeePricePublish.ts";
import { IssueIcon } from "./IssueIcon.tsx";

interface CoinIconProps {
  coinType: CoinType;
  showBackupIcon?: boolean;
  style?: CSSProperties;
  isQfund: boolean;
}

export const CoinIcon = ({
  coinType = "QORT",
  showBackupIcon,
  style,
  isQfund,
}: CoinIconProps) => {
  const getIcon = () => {
    if (isQfund) return QfundIcon;
    switch (coinType) {
      case "QORT":
        return QORTicon;
      case "LTC":
        return LTCicon;
      case "BTC":
        return BTCicon;
      case "DOGE":
        return DOGEicon;
      case "DGB":
        return DGBicon;
      case "RVN":
        return RVNicon;
      case "ARRR":
        return ARRRicon;
    }
  };
  return (
    <IssueIcon
      iconSrc={getIcon()}
      style={style}
      showBackupIcon={showBackupIcon}
    />
  );
};
