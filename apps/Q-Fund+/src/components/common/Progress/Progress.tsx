import { useTheme } from "@mui/material";
import {
  CustomCircularProgress,
  FundAmount,
  FundAmountNumber,
  FundAmountsCol,
  FundAmountsRow,
  ProgressRow,
} from "./Progress-styles";
import { QortalSVG } from "../../../assets/svgs/QortalSVG";

interface CrowdfundProgressProps {
  achieved?: number | null;
  raised: number;
  goal: number;
}

export const CrowdfundProgress: React.FC<CrowdfundProgressProps> = ({
  achieved,
  raised,
  goal,
}) => {
  const theme = useTheme();
  const progress = achieved
    ? (+achieved / +goal) * 100
    : (+raised / +goal) * 100;

  return (
    <ProgressRow>
      <FundAmountsCol>
        <FundAmountsRow>
          <FundAmount>{achieved ? "Achieved:" : "Raised:"}</FundAmount>
          <FundAmountNumber>
            <QortalSVG
              height={"22"}
              width={"22"}
              color={theme.palette.text.primary}
            />
            <span>
              {achieved ? +Math.round(achieved) : +Math.round(raised)}
            </span>
          </FundAmountNumber>
        </FundAmountsRow>
        <FundAmountsRow>
          <FundAmount>Goal:</FundAmount>
          <FundAmountNumber>
            <QortalSVG
              height={"22"}
              width={"22"}
              color={theme.palette.text.primary}
            />
            <span>{+goal}</span>
          </FundAmountNumber>
        </FundAmountsRow>
      </FundAmountsCol>
      <CustomCircularProgress
        size={115}
        thickness={12}
        variant="determinate"
        // value less than 1 and greater than 0, dispaly 1, else display progress
        value={progress < 1 && progress > 0 ? 1 : progress}
      />
    </ProgressRow>
  );
};
