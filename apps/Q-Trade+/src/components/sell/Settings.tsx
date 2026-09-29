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
  Button,
  ButtonBase,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Snackbar,
  SnackbarCloseReason,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ChangeCircleIcon from "@mui/icons-material/ChangeCircle";
import { ReusableModal } from "../common/reusable-modal/ReusableModal";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  CoinActionContainer,
  CoinActionRow,
  CoinSelectRow,
  HeaderRow,
} from "../header/Header-styles";
import { CustomInput, CustomLabel } from "./CreateSell";
import { Spacer } from "../common/Spacer";
import { usePublish, Service, QortalGetMetadata, useGlobal } from "qapp-core";
import { SetLeftFeature } from "ag-grid-community";
import { formatTimestampForum } from "../../utils/formatTime";
import { SelectRow } from "../header/Header";
import { useAtom } from "jotai/react";
import {
  isEnabledCustomLockingFeeAtom,
  selectedFeePublisherAtom,
} from "../../global/state";
import { useRecommendedFees } from "../../hooks/useRecommendedFees";

export const Settings = () => {
  const saveDataLocal = useGlobal().persistentOperations.saveData;
  const getDataLocal = useGlobal().persistentOperations.getData;
  const [openModal, setOpenModal] = useState(false);
  const [lockingFee, setLockingFee] = useState("");
  const [recommendedFee, setRecommendedFee] = useState("medium_fee_per_kb");
  const [selectedCoin, setSelectedCoin] = useState("LITECOIN");
 const {
    isUsingGateway
  } = useContext(gameContext);
  const { hideRecommendations, recommendedFeeDisplay, coin } =
    useRecommendedFees({
      selectedCoin,
      recommendedFee,
    });

  const [editLockingFee, setEditLockingFee] = useState("");
  const [openAlert, setOpenAlert] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [selectedFeePublisher, setSelectedFeePublisher] = useAtom(
    selectedFeePublisherAtom
  );
  const [isEnabledCustomLockingFee, setIsEnabledCustomLockingFee] = useAtom(
    isEnabledCustomLockingFeeAtom
  );
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

  const updateLockingFee = async () => {
    const typeRequest = "feekb";

    try {
      let feeToSave = editLockingFee;
      if (recommendedFee !== "custom") {
        feeToSave = recommendedFeeDisplay;
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

      if (response && !isNaN(+response)) {
        setLockingFee(response);
        setEditLockingFee(response);
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

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsEnabledCustomLockingFee(event.target.checked);
    saveDataLocal("isEnabledCustomLockingFee", event.target.checked);
  };

  const handleChangeRecommended = (
    event: React.MouseEvent<HTMLElement>,
    newAlignment: string
  ) => {
    if (newAlignment) {
      setRecommendedFee(newAlignment);
    }
  };

  const establishUpdateFeeForm = useCallback(async (coin) => {
    setLockingFee("");
    setEditLockingFee("");
    // if the coin or type is not set, then abort
    if (!coin) {
      return;
    }
    // const coinRequest = coin.current.toLowerCase();
    const typeRequest = "feekb";

    try {
      const response = await qortalRequestWithTimeout(
        {
          action: "GET_FOREIGN_FEE",
          coin: coin.toLowerCase(),
          type: typeRequest,
        },
        1800000
      );
      if (response !== null && response !== undefined && !isNaN(+response)) {
        setLockingFee(response);
        setEditLockingFee(response);
      }
    } catch (error) {
      setLockingFee("");
      setEditLockingFee("");
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!openModal) return;
    establishUpdateFeeForm(coin);
  }, [coin, establishUpdateFeeForm, openModal]);

  useEffect(() => {
    const getSavedSelectedPublisher = async () => {
      try {
        const res = await getDataLocal("selectedFeePublisher");
        if (res) {
          setSelectedFeePublisher(res);
        }
        const res2 = await getDataLocal("isEnabledCustomLockingFee");
        if (res2) {
          setIsEnabledCustomLockingFee(res);
        }
      } catch (error) {
        console.error(error);
      }
    };
    getSavedSelectedPublisher();
  }, []);

  useEffect(() => {
    if (hideRecommendations) {
      setRecommendedFee("custom");
    }
  }, [hideRecommendations]);

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => {
          setOpenModal(true);
          setEditLockingFee(lockingFee);
        }}
      >
        <SettingsIcon
          sx={{
            color: "white",
          }}
        />
      </Button>
      {openModal && (
        <ReusableModal
          onClickClose={() => {
            setOpenModal(false);
            setEditLockingFee(lockingFee);
          }}
          backdrop
          styles={{
            width: "450px",
            maxWidth: "95vw",
            padding: "15px",
          }}
          open={openModal}
        >
          {!isUsingGateway && (
               <CoinActionContainer
               sx={{
                 border: "1px solid #3F3F3F",
                 borderRadius: "5px",
                 padding: "5px",
               }}
             >
               <Typography>Locking fees</Typography>
               <FormControlLabel
                 control={
                   <Checkbox
                     checked={isEnabledCustomLockingFee}
                     onChange={handleChange}
                   />
                 }
                 label="Enable custom locking fee"
               />
   
               {isEnabledCustomLockingFee && (
                 <>
                   <CoinSelectRow
                     sx={{
                       gap: "20px",
                       width: "100%",
                       justifyContent: "center",
                     }}
                   >
                     <Select
                       size="small"
                       value={selectedCoin}
                       onChange={(e) => {
                         setLockingFee("");
                         setEditLockingFee("");
                         setSelectedCoin(e.target.value);
                       }}
                     >
                       <MenuItem value={"LITECOIN"}>
                         <SelectRow coin="LTC" />
                       </MenuItem>
                       <MenuItem value={"DOGECOIN"}>
                         <SelectRow coin="DOGE" />
                       </MenuItem>
                       <MenuItem value={"BITCOIN"}>
                         <SelectRow coin="BTC" />
                       </MenuItem>
                       <MenuItem value={"DIGIBYTE"}>
                         <SelectRow coin="DGB" />
                       </MenuItem>
                       <MenuItem value={"RAVENCOIN"}>
                         <SelectRow coin="RVN" />
                       </MenuItem>
                     </Select>
                   </CoinSelectRow>
                   <CoinSelectRow>
                     <Box
                       sx={{
                         width: "100%",
                         display: "flex",
                         flexDirection: "column",
                         alignItems: "center",
                       }}
                     >
                       <Typography>current fee: {lockingFee}</Typography>
                     </Box>
                   </CoinSelectRow>
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
                             Recommended fee selection (in sats per kb)
                           </CustomLabel>
   
                           <Spacer height="10px" />
                           <ToggleButtonGroup
                             color="primary"
                             value={recommendedFee}
                             exclusive
                             onChange={handleChangeRecommended}
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
                                 {recommendedFeeDisplay} sats per kb
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
                             value={editLockingFee}
                             onChange={(e) => setEditLockingFee(e.target.value)}
                             autoComplete="off"
                           />
                         </Box>
                       </HeaderRow>
                     </CoinActionRow>
                   )}
                 </>
               )}
   
               <ButtonBase
                 onClick={updateLockingFee}
                 disabled={recommendedFee === "custom" && !editLockingFee}
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
                 <Typography>Update locking fee</Typography>
               </ButtonBase>
             </CoinActionContainer>
          )}
          <Spacer height="20px" />
          <CoinActionContainer
            sx={{
              border: "1px solid #3F3F3F",
              borderRadius: "5px",
              padding: "5px",
            }}
          >
            <Typography>Fee publisher</Typography>
            <Select
              size="small"
              value={selectedFeePublisher}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedFeePublisher(e.target.value);
                  saveDataLocal("selectedFeePublisher", e.target.value);
                }
              }}
            >
              <MenuItem value={"Foreign-Fee-Publisher"}>
                <SelectRow coin="Foreign-Fee-Publisher" />
              </MenuItem>
              <MenuItem value={"JSON.Bridge"}>
                <SelectRow coin="JSON.Bridge" />
              </MenuItem>
            </Select>
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
