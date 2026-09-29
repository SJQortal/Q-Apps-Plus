import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Tooltip,
  useTheme,
} from "@mui/material";
import { useDispatch } from "react-redux";
import Portal from "../Portal";
import { setNotification } from "../../../state/features/notificationsSlice";
import {
  CrowdfundPageDonateButton,
  DonateModalCol,
  DonateModalLabel,
} from "./Donate-styles";
import { QortalSVG } from "../../../assets/svgs/QortalSVG";
import BoundedNumericTextField from "../../../utils/BoundedNumericTextField";
import { getUserBalance, truncateNumber } from "qortal-app-utils";

interface DonateProps {
  atAddress: string;
  ATDonationPossible: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const Donate = ({
  onSubmit,
  onClose,
  atAddress,
  ATDonationPossible,
}: DonateProps) => {
  const dispatch = useDispatch();
  const theme = useTheme();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [amount, setAmount] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<string>("");
  const resetValues = () => {
    setAmount(0);
    setIsOpen(false);
  };

  const sendCoin = async () => {
    try {
      if (!atAddress) return;
      if (isNaN(amount)) return;

      // Check one last time if the AT has finished and if so, don't send the coin
      const url = `/at/${atAddress}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseDataSearch = await response.json();
      if (response.status !== 200 || responseDataSearch?.isFinished) {
        dispatch(
          setNotification({
            msg: "This crowdfund has ended",
            alertType: "error",
          })
        );
        resetValues();
        return;
      }
      // Prevent them from sending a coin if there's 4 blocks left or less to avoid timing issues
      const url2 = `/blocks/height`;
      const blockHeightResponse = await fetch(url2, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const blockHeight = await blockHeightResponse.json();
      const diff = +responseDataSearch?.sleepUntilHeight - +blockHeight;
      if (diff <= 4) {
        dispatch(
          setNotification({
            msg: "This crowdfund has ended",
            alertType: "error",
          })
        );
        resetValues();
        return;
      }
      await qortalRequest({
        action: "SEND_COIN",
        coin: "QORT",
        destinationAddress: atAddress,
        amount: amount,
      });
      dispatch(
        setNotification({
          msg: "Donation successfully sent",
          alertType: "success",
        })
      );
      resetValues();
      onSubmit();
    } catch (error: any) {
      let notificationObj: any = null;
      if (typeof error === "string") {
        notificationObj = {
          msg: error || "Failed to send coin",
          alertType: "error",
        };
      } else if (typeof error?.error === "string") {
        notificationObj = {
          msg: error?.error || "Failed to send coin",
          alertType: "error",
        };
      } else {
        notificationObj = {
          msg: error?.message || "Failed to send coin",
          alertType: "error",
        };
      }
      if (!notificationObj) return;
      dispatch(setNotification(notificationObj));
    }
  };
  useEffect(() => {
    getUserBalance().then(foundBalance => {
      setCurrentBalance(truncateNumber(foundBalance, 2));
    });
  }, []);
  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Tooltip
        title={`Support this crowdfund`}
        arrow
        disableHoverListener={!ATDonationPossible}
      >
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 1,
            cursor: "pointer",
          }}
        >
          <CrowdfundPageDonateButton
            onClick={() => setIsOpen(prev => !prev)}
            disabled={!ATDonationPossible}
            variant="contained"
          >
            Donate Now
          </CrowdfundPageDonateButton>
        </Box>
      </Tooltip>
      {isOpen && (
        <Portal>
          <Dialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title"></DialogTitle>
            <DialogContent>
              <DonateModalCol>
                <DonateModalLabel htmlFor="standard-adornment-amount">
                  Amount
                </DonateModalLabel>
                <BoundedNumericTextField
                  style={{ fontFamily: "Mulish" }}
                  minValue={1}
                  maxValue={Number.MAX_SAFE_INTEGER}
                  id="standard-adornment-amount"
                  value={amount}
                  onChange={value => setAmount(+value)}
                  variant={"standard"}
                  allowDecimals={false}
                  allowNegatives={false}
                  addIconButtons={true}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QortalSVG
                          height="20px"
                          width="20px"
                          color={theme.palette.text.primary}
                        />
                      </InputAdornment>
                    ),
                  }}
                />
              </DonateModalCol>
              {currentBalance ? (
                <div>You have {currentBalance} QORT</div>
              ) : (
                <></>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  setIsOpen(false);
                  resetValues();
                  onClose();
                }}
              >
                Close
              </Button>
              <Button
                variant="contained"
                onClick={sendCoin}
                sx={{ color: "white" }}
              >
                Send Coin
              </Button>
            </DialogActions>
          </Dialog>
        </Portal>
      )}
    </Box>
  );
};
