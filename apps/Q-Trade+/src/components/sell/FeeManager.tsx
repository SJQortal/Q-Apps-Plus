import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import gameContext from "../../contexts/gameContext";
import {
  Alert,
  Box,
  ButtonBase,
  Snackbar,
  SnackbarCloseReason,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle";
import { ReusableModal } from "../common/reusable-modal/ReusableModal";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import {
  CoinActionContainer,
  CoinActionRow,
  HeaderRow,
} from "../header/Header-styles";
import { CustomInput, CustomLabel } from "./CreateSell";
import { Spacer } from "../common/Spacer";
import { usePublish, Service, QortalGetMetadata } from "qapp-core";
import { SetLeftFeature } from "ag-grid-community";
import { formatTimestampForum } from "../../utils/formatTime";
import { useAtom } from "jotai/react";
import {
  isEnabledCustomLockingFeeAtom,
  selectedFeePublisherAtom,
} from "../../global/state";
import { useRecommendedFees } from "../../hooks/useRecommendedFees";

type FeeEstimate = {
  height: number;
  time: number;
  low_fee_per_kb: number;
  medium_fee_per_kb: number;
  high_fee_per_kb: number;
};
export function isValidFeeEstimate(obj: any): obj is FeeEstimate {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.height === "number" &&
    typeof obj.time === "number" &&
    typeof obj.low_fee_per_kb === "number" &&
    typeof obj.medium_fee_per_kb === "number" &&
    typeof obj.high_fee_per_kb === "number"
  );
}

function calculateFeeFromRate(feePerKb, sizeInBytes) {
  const fee = (feePerKb / 1000) * sizeInBytes;
  return fee?.toFixed(0);
}

export function calculateRateFromFee(totalFee, sizeInBytes) {
  const fee = (totalFee / sizeInBytes) * 1000;
  return fee.toFixed(0);
}

export const FeeManager = ({ selectedCoin, setFee, fee }) => {
  const [feeLocation, setFeeLocation] = useState<QortalGetMetadata>({
    name: "",
    identifier: "",
    service: "JSON",
  });
  const { resource } = usePublish(3, "JSON", feeLocation);
  const [selectedFeePublisher, setSelectedFeePublisher] = useAtom(
    selectedFeePublisherAtom
  );
  const [isEnabledCustomLockingFee, setIsEnabledCustomLockingFee] = useAtom(
    isEnabledCustomLockingFeeAtom
  );

  const [editFee, setEditFee] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const [recommendedFee, setRecommendedFee] = useState("medium_fee_per_kb");

  const { hideRecommendations, recommendedFeeDisplay } = useRecommendedFees({
    selectedCoin,
    recommendedFee,
  });

  const [openAlert, setOpenAlert] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const { getCoinLabel } = useContext(gameContext);
  const handleCloseAlert = (
    event?: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpenAlert(false);
    setInfo(null);
  };
  const coin = useMemo(() => {
    const coinLabel = getCoinLabel(selectedCoin);
    if (typeof coinLabel !== "string") return null;
    return coinLabel?.toLowerCase();
  }, [selectedCoin, getCoinLabel]);

  const feeTimestamp = useMemo(() => {
    if (
      !resource?.qortalMetadata?.identifier?.includes(`${coin.toUpperCase()}`)
    )
      return;
    return resource?.data?.time || null;
  }, [resource, coin]);
  const establishUpdateFeeForm = useCallback(async (coin) => {
    setFee("");
    // if the coin or type is not set, then abort
    if (!coin) {
      return;
    }
    // const coinRequest = coin.current.toLowerCase();
    const typeRequest = "feerequired";

    try {
      const response = await qortalRequestWithTimeout(
        {
          action: "GET_FOREIGN_FEE",
          coin: coin,
          type: typeRequest,
        },
        1800000
      );
      if (response !== null && response !== undefined && !isNaN(+response)) {
        setFee(response);
      }
    } catch (error) {
      setFee("");
      console.error(error);
    }
  }, []);

  useEffect(() => {
    establishUpdateFeeForm(coin);
  }, [coin, establishUpdateFeeForm]);

  useEffect(() => {
    if (hideRecommendations) {
      setRecommendedFee("custom");
    }
  }, [hideRecommendations]);

  const updateFee = async () => {
    const typeRequest = "feerequired";
    const typeRequestLocking = "feekb";

    try {
      let feeToSave = editFee;
      if (recommendedFee !== "custom") {
        feeToSave = calculateFeeFromRate(recommendedFeeDisplay, 300);
      }
      if (+fee === +feeToSave) {
        return;
      }
      const response = await qortalRequestWithTimeout(
        {
          action: "UPDATE_FOREIGN_FEE",
          coin: coin,
          type: typeRequest,
          value: feeToSave,
        },
        1800000
      );

      if (!isEnabledCustomLockingFee) {
        await qortalRequestWithTimeout(
          {
            action: "UPDATE_FOREIGN_FEE",
            coin: coin,
            type: typeRequestLocking,
            value: calculateRateFromFee(feeToSave, 300),
          },
          1800000
        );
      }

      if (response && !isNaN(+response)) {
        setFee(response);
        setOpenAlert(true);
        setInfo({
          type: "success",
          message: "Fee updated!",
        });
        setOpenModal(false);
      } else throw new Error("Unable to update fee");
    } catch (error) {
      setOpenAlert(true);
      setInfo({
        type: "error",
        message: error?.message || "Unable to update fee",
      });
    }
  };

  const handleChange = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string
  ) => {
    if (newAlignment) {
      setRecommendedFee(newAlignment);
    }
  };

  if (fee === null || fee === undefined) return;
  return (
    <>
      <ButtonBase
        onClick={() => {
          setOpenModal(true);
          setEditFee(fee);
        }}
        sx={{
          minHeight: "42px",
          border: "1px solid gray",
          color: "white",
          display: "flex",
          alignItems: "center",
          padding: "5px 5px",
          gap: "10px",
          borderRadius: "5px",
          "&:hover": {
            border: "1px solid white", // Border color on hover
          },
        }}
      >
        <Typography>Fee: {fee} sats</Typography>

        <ChangeCircleIcon
          sx={{
            color: "white",
          }}
        />
      </ButtonBase>
      {openModal && (
        <ReusableModal
          onClickClose={() => {
            setOpenModal(false);
            setEditFee(fee);
          }}
          open={openModal}
          backdrop
          styles={{
            width: "450px",
            maxWidth: "95vw",
            padding: "15px",
          }}
        >
          <CoinActionContainer>
            <CoinActionRow>
              <HeaderRow>
                <Typography
                  variant="h4"
                  sx={{
                    color: "white",
                  }}
                >
                  Update unlocking fee for {selectedCoin}
                </Typography>
              </HeaderRow>
            </CoinActionRow>
            <CoinActionRow>
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <Typography>current fee: {fee}</Typography>
              </Box>
            </CoinActionRow>
            <CoinActionRow>
              <HeaderRow>
                <Box
                  sx={{
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <CustomLabel
                      sx={{
                        fontSize: "16px",
                      }}
                      htmlFor="standard-adornment-name"
                    >
                      Recommended fee selection (in sats)
                    </CustomLabel>

                    <Spacer height="10px" />
                    <ToggleButtonGroup
                      color="primary"
                      value={recommendedFee}
                      exclusive
                      onChange={handleChange}
                      aria-label="Platform"
                    >
                      {!hideRecommendations && (
                        <>
                          <ToggleButton value="low_fee_per_kb">
                            Low
                          </ToggleButton>
                          <ToggleButton value="medium_fee_per_kb">
                            Medium
                          </ToggleButton>
                          <ToggleButton value="high_fee_per_kb">
                            High
                          </ToggleButton>
                        </>
                      )}

                      <ToggleButton value="custom">Custom</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  {recommendedFeeDisplay && (
                    <>
                      <Spacer height="15px" />
                      <Box
                        sx={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <Typography
                          sx={{
                            color: "white",
                            fontSize: "18px",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: "bold",
                            }}
                          >
                            {" "}
                            New fee:
                          </span>{" "}
                          {calculateFeeFromRate(
                            recommendedFeeDisplay,
                            300
                          )}{" "}
                          sats
                        </Typography>
                      </Box>
                      <Spacer height="10px" />
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: "20px",
                        }}
                      >
                        <QuestionMarkIcon
                          sx={{
                            color: "white",
                          }}
                        />

                        <Typography
                          sx={{
                            color: "white",
                          }}
                        >
                          This recommended fee is derived from{" "}
                          {recommendedFeeDisplay} per kb, for a transaction that
                          is approximately 300 bytes in size.
                        </Typography>
                      </Box>
                      <Spacer height="10px" />
                    </>
                  )}
                </Box>
              </HeaderRow>
            </CoinActionRow>
            {recommendedFee === "custom" && (
              <CoinActionRow>
                <HeaderRow>
                  <Box>
                    <CustomLabel htmlFor="standard-adornment-name">
                      Custom fee
                    </CustomLabel>
                    <Spacer height="5px" />
                    <CustomInput
                      id="standard-adornment-name"
                      type="number"
                      value={editFee}
                      onChange={(e) => setEditFee(e.target.value)}
                      autoComplete="off"
                    />
                  </Box>
                </HeaderRow>
              </CoinActionRow>
            )}

            <ButtonBase
              onClick={updateFee}
              disabled={recommendedFee === "custom" && !editFee}
              sx={{
                minHeight: "42px",
                border: "1px solid gray",
                color: "white",
                display: "flex",
                alignItems: "center",
                padding: "5px 20px",
                gap: "10px",
                borderRadius: "5px",
                "&:hover": {
                  border: "1px solid white", // Border color on hover
                },
              }}
            >
              <ChangeCircleIcon
                sx={{
                  color: "white",
                }}
              />
              <Typography>Update fee</Typography>
            </ButtonBase>
            {!hideRecommendations && feeTimestamp && (
              <CustomLabel
                sx={{
                  textAlign: "center",
                }}
              >
                *Recommended fees last updated:{" "}
                {formatTimestampForum(feeTimestamp)}
              </CustomLabel>
            )}
          </CoinActionContainer>
        </ReusableModal>
      )}
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={openAlert}
        onClose={handleCloseAlert}
        autoHideDuration={6000}
      >
        <Alert
          onClose={handleCloseAlert}
          severity={info?.type}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {info?.message}
        </Alert>
      </Snackbar>
    </>
  );
};
