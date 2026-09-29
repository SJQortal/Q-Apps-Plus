import { useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { AppContainer } from "../../App-styles";
import { Header } from "../../components/header/Header";
import gameContext from "../../contexts/gameContext";
import { NotificationContext } from "../../contexts/notificationContext";
import { TradeOffers } from "../../components/Grids/TradeOffers";
import { OngoingTrades } from "../../components/Grids/OngoingTrades";
import { Box } from "@mui/material";
import { TextTableTitle } from "../../components/Grids/Table-styles";
import { Spacer } from "../../components/common/Spacer";
import { PageHeader } from "../../components/layout/PageHeader";
import { PageBody } from "../../components/layout/PageBody";
import { CreateSell } from "../../components/sell/CreateSell";
import { History } from "../../components/history/History";

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  buy: { title: "Buy QORT", subtitle: "Open sell orders on the market" },
  sell: { title: "Sell QORT", subtitle: "Your sell orders and trade bots" },
  history: { title: "Trade history", subtitle: "Completed trades" },
};

export const HomePage = () => {
  const {
    qortBalance,
    foreignCoinBalance,
    userInfo,
    setIsAuthenticated,
    setOAuthLoading,
    onGoingTrades,
    selectedCoin,
  } = useContext(gameContext);
  const { setNotification } = useContext(NotificationContext);
  const { pathname } = useLocation();
  const mode = pathname.startsWith("/sell")
    ? "sell"
    : pathname.startsWith("/history")
      ? "history"
      : "buy";
  const [fee, setFee] = useState("");

  const filteredOngoingTrades = useMemo(() => {
    return onGoingTrades?.filter(
      (item) => item?.tradeInfo?.foreignBlockchain === selectedCoin
    );
  }, [onGoingTrades, selectedCoin]);
  const checkIfAuthenticated = async () => {
    try {
      setOAuthLoading(true);

      setIsAuthenticated(true);
    } catch (error) {
      console.error(error);
    } finally {
      setOAuthLoading(false);
    }
  };
  useEffect(() => {
    if (!userInfo?.address) return;
    checkIfAuthenticated();
  }, [userInfo?.address]);

  return (
    <>
      <PageHeader title={PAGE_TITLES[mode].title} subtitle={PAGE_TITLES[mode].subtitle} />
      <PageBody $maxWidth={1200}>
      <Header
        qortBalance={qortBalance}
        foreignCoinBalance={foreignCoinBalance}
        qortAddress={userInfo?.address}
        fee={fee}
        setFee={setFee}
      />

      <AppContainer>
        <div
          style={{
            width: "100%",
            display: mode === "buy" ? "block" : "none",
          }}
        >
          <Spacer height="10px" />
          <Box
            sx={{
              width: "100%",
            }}
          >
            <TextTableTitle
              sx={{
                fontSize: "16px",
              }}
            >
              {`My Pending Orders: ${filteredOngoingTrades?.length}`}
            </TextTableTitle>
          </Box>
          <Spacer height="10px" />
          <OngoingTrades />
          <Spacer height="10px" />
          <Box
            sx={{
              width: "100%",
            }}
          >
            <TextTableTitle
              sx={{
                fontSize: "16px",
              }}
            >
              Open Market Sell Orders
            </TextTableTitle>
          </Box>
          <Spacer height="10px" />
          <TradeOffers setFee={setFee} fee={fee}
         foreignCoinBalance={foreignCoinBalance} />
        </div>

        <CreateSell show={mode === "sell"} qortAddress={userInfo?.address} />
        <History show={mode === "history"} qortAddress={userInfo?.address} userPublicKey={userInfo?.publicKey} />
      </AppContainer>
      </PageBody>
    </>
  );
};
