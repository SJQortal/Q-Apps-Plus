import { FC } from "react";
import { CircularProgress } from "@mui/material";
import { CrowdfundLoaderRow } from "../../components/Crowdfund/Crowdfund-styles";

interface CrowdfundLoaderProps {
  status: string;
}

export const CrowdfundLoader: FC<CrowdfundLoaderProps> = ({ status }) => {
  return (
    <CrowdfundLoaderRow>
      <CircularProgress />
      {status}
    </CrowdfundLoaderRow>
  );
};
