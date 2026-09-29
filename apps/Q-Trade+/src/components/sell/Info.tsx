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


export const Info = () => {
  const [openModal, setOpenModal] = useState(false)
  
  return (
    <>
      <ButtonBase
        onClick={() => {
          setOpenModal(true);
      
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

        <QuestionMarkIcon
                          sx={{
                            color: "white",
                          }}
                        />
      </ButtonBase>
      {openModal && (
        <ReusableModal
          onClickClose={() => {
            setOpenModal(false);
          }}
          backdrop
          styles={{
            width: '450px',
            maxWidth: '95vw',
            padding: '15px'
          }}
          open={openModal}
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
                  Information on fees
                </Typography>
              </HeaderRow>
            </CoinActionRow>

          </CoinActionContainer>
        </ReusableModal>
      )}

    </>
  );
};
