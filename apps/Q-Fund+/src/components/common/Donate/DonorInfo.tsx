import { DonorDetailsButton } from "./Donate-styles";
import { Tooltip } from "@mui/material";
import {
  addStringNumbers,
  getAccountNames,
  removeTrailingZeros,
  SearchTransactionResponse,
} from "qortal-app-utils";
import React, { useEffect, useState } from "react";
import DonorModal from "./DonorModal";

interface DonorInfoProps {
  rawDonorData: SearchTransactionResponse[];
  aggregateDonorData?: boolean;
}

export type ViewableDonorData = {
  nameIfExists: string;
  address: string;
  amount: string;
};

const DonorInfo = ({
  rawDonorData,
  aggregateDonorData = true,
}: DonorInfoProps) => {
  const [displayModal, setDisplayModal] = useState<boolean>(false);
  const [donorData, setDonorData] = useState<ViewableDonorData[]>([]);

  const processOneDonor = (
    donorArray: ViewableDonorData[],
    donor: ViewableDonorData
  ) => {
    const donorIndex = donorArray.findIndex(d => {
      return d.address === donor.address;
    });

    if (aggregateDonorData && donorIndex >= 0) {
      donorArray[donorIndex].amount = addStringNumbers(
        donorArray[donorIndex].amount,
        donor.amount
      );
    } else {
      donorArray.push(donor);
    }
  };

  const processAllDonors = async () => {
    const processedDonorData: ViewableDonorData[] = [];
    Promise.all(
      rawDonorData.map(({ creatorAddress, amount }) => {
        return getAccountNames(creatorAddress);
      })
    ).then(responseArray => {
      responseArray.map((response, index) => {
        processOneDonor(processedDonorData, {
          nameIfExists: response[0].name,
          address: response[0].owner,
          amount: removeTrailingZeros(rawDonorData[index].amount),
        });
      });
      setDonorData(processedDonorData);
    });
  };

  useEffect(() => {
    processAllDonors();
  }, [rawDonorData]);
  return (
    <>
      <Tooltip title={`Show list of donors`} arrow placement="bottom">
        <DonorDetailsButton
          variant="contained"
          onClick={() => {
            setDisplayModal(true);
          }}
        >
          Donor Details
        </DonorDetailsButton>
      </Tooltip>
      <DonorModal
        donorData={donorData}
        open={displayModal}
        closeModal={() => setDisplayModal(false)}
      />
    </>
  );
};

export default DonorInfo;
