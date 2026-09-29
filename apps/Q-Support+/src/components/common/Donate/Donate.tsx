import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { QortalSVG } from "../../../assets/svgs/QortalSVG";
import { ThemeButton } from "../../../pages/Home/Home-styles.tsx";
import { setNotification } from "../../../state/features/notificationsSlice";
import BoundedNumericTextField from "../../../utils/BoundedNumericTextField";
import {
  getATaddress,
  getATInfo,
  getUserBalance,
} from "../../../utils/qortalRequests.ts";
import { truncateNumber } from "../../../utils/utilFunctions.ts";
import Portal from "../Portal";
import { DonateModalCol, DonateModalLabel } from "./Donate-styles";

interface DonateProps {
  crowdfundLink: string;
  onSubmit?: () => void;
  onClose?: () => void;
}

export const Donate = ({ crowdfundLink, onSubmit, onClose }: DonateProps) => {
  const dispatch = useDispatch();
  const theme = useTheme();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [amount, setAmount] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<string>("");
  const [disableDonation, setDisableDonation] = useState<boolean>(true);
  const [ATaddress, setATaddress] = useState<string>("");
  const [ATDonationPossible, setATDonationPossible] = useState<boolean>(false);
  const emptyDonationHelperText = "Donation amount must not be empty";

  const [helperText, setHelperText] = useState<string>(emptyDonationHelperText);
  const resetValues = () => {
    setAmount(0);
    setIsOpen(false);
  };

  const sendCoin = async () => {
    try {
      if (!ATaddress) return;
      if (isNaN(amount)) return;

      // Check one last time if the AT has finished and if so, don't send the coin
      const url = `/at/${ATaddress}`;
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
        destinationAddress: ATaddress,
        amount: amount,
      });
      dispatch(
        setNotification({
          msg: "Donation successfully sent",
          alertType: "success",
        })
      );
      resetValues();
      if (onSubmit) onSubmit();
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

  const allowDonationIfSafe = async (value: number) => {
    if (isNaN(value) || value === 0) {
      setDisableDonation(true);
      setHelperText(emptyDonationHelperText);
    } else {
      setDisableDonation(false);
      setHelperText("");
    }
    setAmount(value);
  };

  const initializeState = async () => {
    const [userBalance, ATaddress] = await Promise.all([
      getUserBalance(),
      getATaddress(crowdfundLink),
    ]);

    setCurrentBalance(truncateNumber(userBalance, 2));
    setATaddress(ATaddress);
    const ATinfo = await getATInfo(ATaddress);
    let isDeployed = false;
    if (ATinfo) {
      const ATdeployed1 = ATinfo?.sleepUntilHeight && !ATinfo?.isFinished;
      const ATdeployed2 = !ATinfo.sleepUntilHeight && ATinfo.isFinished;
      if (ATdeployed1 || ATdeployed2) isDeployed = true;
      const ATended = Object.keys(ATinfo).length > 0 && ATinfo?.isFinished;
      setATDonationPossible(isDeployed && !ATended);
    }
  };
  useEffect(() => {
    if (!crowdfundLink) return;
    initializeState();
  }, []);
  if (!crowdfundLink) return <></>;
  return (
    <Box
      sx={{
        position: "relative",
        display: ATDonationPossible ? "flex" : "none",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Tooltip
        title={<Typography fontSize={16}>Support This Crowdfund</Typography>}
        arrow
        disableHoverListener={!ATDonationPossible}
        placement={"right-end"}
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
          <ThemeButton
            onClick={() => setIsOpen(prev => !prev)}
            disabled={!ATDonationPossible}
            variant="contained"
          >
            Donate to Crowdfund
          </ThemeButton>
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
                  maxValue={+truncateNumber(currentBalance, 0)}
                  id="standard-adornment-amount"
                  value={amount}
                  onChange={value => allowDonationIfSafe(+value)}
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
                  error={disableDonation}
                  helperText={helperText}
                  FormHelperTextProps={{ sx: { fontSize: 20 } }}
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
                  if (onClose) onClose();
                }}
              >
                Close
              </Button>
              <Button
                variant="contained"
                onClick={sendCoin}
                sx={{
                  color: "white",
                }}
                disabled={disableDonation}
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
