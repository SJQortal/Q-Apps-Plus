import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { baseLocalHost } from "../Grids/TradeOffers";
import {
  Alert,
  Box,
  ButtonBase,
  Snackbar,
  SnackbarCloseReason,
  Typography,
} from "@mui/material";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import { ReusableModal } from "../common/reusable-modal/ReusableModal";
import {
  CoinActionContainer,
  CoinActionRow,
  CoinConfirmSendBtn,
  HeaderRow,
} from "../header/Header-styles";

export default function UnsignedFees({ qortAddress }) {
  const [isPositive, setIsPositive] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [openAlert, setOpenAlert] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const qortAddressRef = useRef(null);

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

  useEffect(() => {
    if (qortAddress) {
      qortAddressRef.current = qortAddress;
    }
  }, [qortAddress]);

    const getUnsignedFees = useCallback(async (address)=> {
   try {
    const url = `/crosschain/unsignedfees/${address}`
    const res = await fetch(url)
    const data = await res.json()
    if(data && data.length > 0){
      setIsPositive(true)
    } else {
      setIsPositive(false)
    }
   } catch (error) {
    console.error(error)
   }
  }, [])


  const restartUnsignedFeeSocket = (address) => {
    getUnsignedFees(address)
    setTimeout(() => initUnsignedFeeSocket(true), 50);
  };

  const restartFeeData = () => {
    if (socketRef.current) {
      socketRef.current.close(1000, "forced"); // Close with a custom reason
      socketRef.current = null;
    }

    setIsPositive(null);
  };

  const socketRef = useRef(null);

  const initUnsignedFeeSocket = (restarted = false) => {
    let socketTimeout: any;
    const socketLink = `${
      window.location.protocol === "https:" ? "wss:" : "ws:"
    }//${baseLocalHost}/websockets/crosschain/unsignedfees`;
    socketRef.current = new WebSocket(socketLink);
    socketRef.current.onopen = () => {
      setTimeout(pingSocket, 50);
    };
    socketRef.current.onmessage = (e) => {
      restarted = false;
      const data = JSON.parse(e.data);
      if (qortAddressRef.current === data.address) {
        if (data.positive) {
          setIsPositive(true);
          setOpenModal(true);
        } else {
          setIsPositive(false);
        }
      }
    };
    socketRef.current.onclose = (event) => {
      clearTimeout(socketTimeout);
      if (event.reason === "forced") {
        return;
      }
      restartUnsignedFeeSocket(qortAddressRef.current);
    };
    socketRef.current.onerror = (e) => {
      clearTimeout(socketTimeout);
    };
    const pingSocket = () => {
      socketRef.current.send("ping");
      socketTimeout = setTimeout(pingSocket, 295000);
    };
  };


  useEffect(() => {
    if (!qortAddress) return;
    restartFeeData();
    getUnsignedFees(qortAddress)
    setTimeout(() => {
      initUnsignedFeeSocket();
    }, 500);
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "forced");
      }
    };
  }, [qortAddress, getUnsignedFees]);

  const signForeignFees = async () => {
    try {
      await qortalRequest({
        action: "SIGN_FOREIGN_FEES",
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (!isPositive) return null;
  return (
    <>
      <ButtonBase
        onClick={signForeignFees}
        sx={{
          minHeight: "42px",
          background: "red",
          color: "white",
          display: "flex",
          alignItems: "center",
          padding: "5px 20px",
          gap: "20px",
          borderRadius: "5px",
          "&:hover": {
            background: "darkred", // Border color on hover
          },
        }}
      >
        <TouchAppIcon
          sx={{
            color: "white",
          }}
        />
        <Typography>Action required! You have unsigned fees</Typography>
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
                  variant="h2"
                  sx={{
                    color: "white",
                  }}
                >
                  Action required!
                </Typography>
              </HeaderRow>
            </CoinActionRow>
            <CoinActionRow>
              <HeaderRow>
                <Typography
                  variant="h4"
                  sx={{
                    color: "white",
                  }}
                >
                  In order for buyers to use the correct unlocking fee, please
                  sign your fees.
                </Typography>
              </HeaderRow>
            </CoinActionRow>
            <ButtonBase
              onClick={signForeignFees}
              sx={{
                minHeight: "42px",
                background: "red",
                color: "white",
                display: "flex",
                alignItems: "center",
                padding: "5px 20px",
                gap: "20px",
                borderRadius: "5px",
                "&:hover": {
                  background: "darkred", // Border color on hover
                },
              }}
            >
              <TouchAppIcon
                sx={{
                  color: "white",
                }}
              />
              <Typography>Sign Fees</Typography>
            </ButtonBase>
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
}
