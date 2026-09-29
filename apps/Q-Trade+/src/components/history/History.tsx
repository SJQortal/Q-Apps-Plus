import {
  Alert,
  Box,
  ButtonBase,
  Snackbar
} from "@mui/material";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import gameContext from "../../contexts/gameContext";
import HistoryList from "./HistoryList";
import { ShowingFont, Refresh, HistoryButtonRow, HistoryButton } from "./History-styles";

export const History = ({ qortAddress, show, userPublicKey }) => {

  const [buyHistory, setBuyHistory] = useState({});
  const [sellHistory, setSellHistory] = useState({});
  const [allHistory, setAllHistory] = useState({});
  const { selectedCoin } = useContext(gameContext);
  const [mode, setMode] = useState("buyHistory");
  const [open, setOpen] = useState(false);

  const selectedHistory = useMemo(() => {
    if (mode === "buyHistory") return buyHistory[selectedCoin] || [];
    if (mode === "sellHistory") return sellHistory[selectedCoin] || [];
    if (mode === "allHistory") return allHistory[selectedCoin] || [];
  }, [selectedCoin, buyHistory, sellHistory, mode, allHistory]);
  const getBuyHistory = useCallback(
    (publicKey, foreignBlockchain, mode, limit = 20) => {
      setOpen(true);
      let historyUrl;
      if (mode === "buyHistory") {
        historyUrl = `/crosschain/trades?foreignBlockchain=${foreignBlockchain}&buyerPublicKey=${publicKey}&limit=${limit}&reverse=true`;
      }
      if (mode === "sellHistory") {
        historyUrl = `/crosschain/trades?foreignBlockchain=${foreignBlockchain}&sellerPublicKey=${publicKey}&limit=${limit}&reverse=true`;
      }
      if(mode === 'allHistory'){
        historyUrl = `/crosschain/trades?foreignBlockchain=${foreignBlockchain}&limit=${limit}&reverse=true`;
      }
      fetch(historyUrl)
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          if (mode === "buyHistory") {
            setBuyHistory((prev) => {
              return {
                ...prev,
                [foreignBlockchain]: data,
              };
            });
          }
          if (mode === "sellHistory") {
            setSellHistory((prev) => {
              return {
                ...prev,
                [foreignBlockchain]: data,
              };
            });
          }
          if (mode === "allHistory") {
            setAllHistory((prev) => {
              return {
                ...prev,
                [foreignBlockchain]: data,
              };
            });
          }
        })
        .catch(() => {})
        .finally(() => {
          setOpen(false);
        });
    },
    []
  );

  useEffect(() => {
    if (!userPublicKey || !selectedCoin) return;
    if (mode === "buyHistory" && buyHistory[selectedCoin]) return;
    if (mode === "sellHistory" && sellHistory[selectedCoin]) return;
    if (mode === "allHistory" && allHistory[selectedCoin]) return;
    getBuyHistory(userPublicKey, selectedCoin, mode);
  }, [userPublicKey, selectedCoin, buyHistory, mode, sellHistory, allHistory]);

  return (
    <Box
      style={{
        width: "100%",
        display: show ? "block" : "none",
      }}
    >
      <HistoryButtonRow sx={{
        flexWrap: 'wrap'
      }}>
        <HistoryButton
          activeBtn={mode === "buyHistory"}
          onClick={() => {
            setMode("buyHistory");
          }}
        >
          My Buy History
        </HistoryButton>
        <HistoryButton
          activeBtn={mode === "sellHistory"}
          onClick={() => {
            setMode("sellHistory");
          }}
        >
          My Sell History
        </HistoryButton>
        <HistoryButton
          activeBtn={mode === "allHistory"}
          onClick={() => {
            setMode("allHistory");
          }}
        >
          Historic Trades
        </HistoryButton>
        <ButtonBase
          onClick={() => {
            getBuyHistory(userPublicKey, selectedCoin, mode);
          }}
        >
          <Refresh />
        </ButtonBase>
      </HistoryButtonRow>
      <ShowingFont>Showing most recent 20 results</ShowingFont>
      <HistoryList qortAddress={qortAddress} historyList={selectedHistory} />
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity="info"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {"Fetching History"}
        </Alert>
      </Snackbar>
    </Box>
  );
};
