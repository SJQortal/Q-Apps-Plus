import { ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { autoSizeStrategy, baseLocalHost } from "../Grids/TradeOffers";
import {
  Alert,
  Box,
  Snackbar,
  SnackbarCloseReason,
  Typography,
} from "@mui/material";
import gameContext from "../../contexts/gameContext";
import { BuyContainerDivider } from "../Grids/Table-styles";

const defaultColDef = {
  resizable: true, // Make columns resizable by default
  sortable: true, // Make columns sortable by default
  suppressMovable: true, // Prevent columns from being movable
};

export default function TradeBotList({ qortAddress, failedTradeBots }) {
  const [tradeBotList, setTradeBotList] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const tradeBotListRef = useRef([]);
  const offeringTrades = useRef<any[]>([]);
  const qortAddressRef = useRef(null);
  const gridRef = useRef<any>(null);
  const {
    updateTemporaryFailedTradeBots,
    fetchTemporarySellOrders,
    deleteTemporarySellOrder,
    getCoinLabel,
    selectedCoin,
  } = useContext(gameContext);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const filteredOutTradeBotListWithoutFailed = useMemo(() => {
    const list = tradeBotList.filter(
      (item) =>
        !failedTradeBots.some(
          (failedItem) => failedItem.atAddress === item.atAddress
        )
    );
    return list;
  }, [failedTradeBots, tradeBotList]);

  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit(); // Adjust columns to fit the grid width
    const allColumnIds = params.columnApi
      .getAllColumns()
      .map((col: any) => col.getColId());
    params.columnApi.autoSizeColumns(allColumnIds); // Automatically adjust the width to fit content
  }, []);

  const columnDefs: ColDef[] = useMemo(() => {
    return [
      {
        headerCheckboxSelection: false, // Adds a checkbox in the header for selecting all rows
        checkboxSelection: true, // Adds checkboxes in each row for selection
        headerName: "Select", // You can customize the header name
        width: 50, // Adjust the width as needed
        pinned: "left", // Optional, to pin this column on the left
        resizable: false,
      },
      {
        headerName: "QORT AMOUNT",
        field: "qortAmount",
        flex: 1, // Flex makes this column responsive
        minWidth: 150, // Ensure it doesn't shrink too much
        resizable: true,
      },
      {
        headerName: `${getCoinLabel()}/QORT`,
        valueGetter: (params) =>
          +params.data.foreignAmount / +params.data.qortAmount,
        sortable: true,
        sort: "asc",
        flex: 1, // Flex makes this column responsive
        minWidth: 150, // Ensure it doesn't shrink too much
        resizable: true,
      },
      {
        headerName: `Total ${getCoinLabel()} Value`,
        field: "foreignAmount",
        flex: 1, // Flex makes this column responsive
        minWidth: 150, // Ensure it doesn't shrink too much
        resizable: true,
      },
      {
        headerName: "Status",
        field: "status",
        flex: 1, // Flex makes this column responsive
        minWidth: 300, // Ensure it doesn't shrink too much
        resizable: true,
      },
    ];
  }, [selectedCoin, getCoinLabel]);
  useEffect(() => {
    if (qortAddress) {
      qortAddressRef.current = qortAddress;
    }
  }, [qortAddress]);

  const restartTradeOffersWebSocket = () => {
    setTimeout(() => initTradeOffersWebSocket(true), 50);
  };

  const processTradeBotState = (state) => {
    if (state.creatorAddress === qortAddressRef.current) {
      switch (state.tradeState) {
        case "BOB_WAITING_FOR_AT_CONFIRM":
          return "PENDING";

        case "BOB_WAITING_FOR_MESSAGE":
          return "LISTED";

        case "BOB_WAITING_FOR_AT_REDEEM":
          return "TRADING";

        case "BOB_DONE":
        case "BOB_REFUNDED":
        case "ALICE_DONE":
        case "ALICE_REFUNDED":
          return null;

        case "ALICE_WAITING_FOR_AT_LOCK":
          return "BUYING";

        case "ALICE_REFUNDING_A":
          return "REFUNDING";

        default:
          return null; // Return null or a default value if no tradeState matches
      }
    }
    return null; // Return null if creatorAddress doesn't match qortAddressRef.current
  };

  const processTradeBots = (tradeBots) => {
    let sellTrades = [...tradeBotListRef.current]; // Start with the existing trades

    tradeBots.forEach((trade) => {
      const status = processTradeBotState(trade);

      if (status) {
        // Check if the trade is already in the list
        const existingIndex = sellTrades.findIndex(
          (existingTrade) => existingTrade.atAddress === trade.atAddress
        );

        if (existingIndex > -1) {
          // Replace the existing trade if it exists
          sellTrades[existingIndex] = { ...trade, status };
        } else {
          // Add new trade if it doesn't exist
          sellTrades.push({ ...trade, status });
        }
      }
    });
    setTradeBotList(sellTrades);
    tradeBotListRef.current = sellTrades;
  };
  const restartTradeOffers = () => {
    if (socketRef.current) {
      socketRef.current.close(1000, "forced"); // Close with a custom reason
      socketRef.current = null;
    }
    offeringTrades.current = [];
    setTradeBotList([]);
    tradeBotListRef.current = [];
  };

  const socketRef = useRef(null);

  const initTradeOffersWebSocket = (restarted = false) => {
    let tradeOffersSocketCounter = 0;
    let socketTimeout: any;
    // let socketLink = `ws://127.0.0.1:12391/websockets/crosschain/tradebot?foreignBlockchain=LITECOIN`;
    let socketLink = `${
      window.location.protocol === "https:" ? "wss:" : "ws:"
    }//${baseLocalHost}/websockets/crosschain/tradebot?foreignBlockchain=${selectedCoin}`;
    socketRef.current = new WebSocket(socketLink);
    socketRef.current.onopen = () => {
      setTimeout(pingSocket, 50);
      tradeOffersSocketCounter += 1;
    };
    socketRef.current.onmessage = (e) => {
      tradeOffersSocketCounter += 1;
      restarted = false;
      processTradeBots(JSON.parse(e.data));
    };
    socketRef.current.onclose = (event) => {
      clearTimeout(socketTimeout);
      if (event.reason === "forced") {
        return;
      }
      restartTradeOffersWebSocket();
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
    if (selectedCoin === null) return;
    restartTradeOffers();

    setTimeout(() => {
      initTradeOffersWebSocket();
    }, 500);
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "forced");
      }
    };
  }, [qortAddress, selectedCoin]);

  const onSelectionChanged = (event: any) => {
    const selectedRows = event.api.getSelectedRows();
    if (selectedRows[0]) {
      setSelectedTrade(selectedRows[0]);
    } else {
      setSelectedTrade(null);
    }
  };

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
    setInfo(null);
  };

  const cancelSell = async () => {
    try {
      if (!selectedTrade) return;
      setOpen(true);

      setInfo({
        type: "info",
        message: "Attempting to cancel sell order",
      });
      const res = await qortalRequestWithTimeout(
        {
          action: "CANCEL_TRADE_SELL_ORDER",
          qortAmount: selectedTrade.qortAmount,
          foreignBlockchain: selectedTrade.foreignBlockchain,
          foreignAmount: selectedTrade.foreignAmount,
          atAddress: selectedTrade.atAddress,
        },
        900000
      );
      if (res?.signature) {
        await deleteTemporarySellOrder(selectedTrade.atAddress);

        setSelectedTrade(null);
        setOpen(true);
        setInfo({
          type: "success",
          message:
            "Sell order canceled. Please wait a couple of minutes for the network to propogate the changes",
        });
      }
      if (res?.error && res?.failedTradeBot) {
        setOpen(true);
        setInfo({
          type: "error",
          message: "Unable to cancel sell order. Please try again.",
        });
      }
    } catch (error) {
      if (error?.error && error?.failedTradeBot) {
        setOpen(true);
        setInfo({
          type: "error",
          message: "Unable to cancel sell order. Please try again.",
        });
      }
    }
  };

  const CancelButton = () => {
    return (
      <button
        disabled={!selectedTrade || selectedTrade?.status === "PENDING"}
        onClick={cancelSell}
        style={{
          borderRadius: "8px",
          width: "150px",
          height: "auto",
          minHeight: "30px",
          background:
            !selectedTrade || selectedTrade?.status === "PENDING"
              ? "gray"
              : "#4D7345",
          color: "white",
          cursor:
            !selectedTrade || selectedTrade?.status === "PENDING"
              ? "default"
              : "pointer",
          border: "1px solid #375232",
          boxShadow: "0px 2.77px 2.21px 0px #00000005",
          marginRight: "15px",
        }}
      >
        Cancel sell order
      </button>
    );
  };

  return (
    <div
      style={{
        width: "100%",
      }}
    >
      <div
        className="ag-theme-alpine-dark"
        style={{ height: 400, width: "100%" }}
      >
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={filteredOutTradeBotListWithoutFailed}
          // onRowClicked={onRowClicked}
          onSelectionChanged={onSelectionChanged}
          // getRowStyle={getRowStyle}
          autoSizeStrategy={autoSizeStrategy}
          rowSelection="single" // Enable multi-select
          suppressHorizontalScroll={false} // Allow horizontal scroll on mobile if needed
          suppressCellFocus={true} // Prevents cells from stealing focus in mobile
          // pagination={true}
          // paginationPageSize={10}
          onGridReady={onGridReady}
          //  domLayout='autoHeight'
          // getRowId={(params) => params.data.qortalAtAddress} // Ensure rows have unique IDs
        />
        {/* {selectedOffer && (
        <Button onClick={buyOrder}>Buy</Button>

      )} */}
      </div>
      <div
        style={{
          height: "120px",
        }}
      />
      <Box
        sx={{
          width: "calc(100% - 14px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "fixed",
          bottom: "0px",
          height: "100px",
          padding: "7px",
          background: "#323336",
        }}
      >
      <BuyContainerDivider />
        <Box
          sx={{
            display: "flex",
            gap: "5px",
            flexDirection: "column",
            width: "100%",
          }}
        >
          {/* <Typography sx={{
          fontSize: '16px',
          color: 'white',
          width: 'calc(100% - 75px)'
        }}>{selectedTotalQORT?.toFixed(3)} QORT</Typography>  */}
          <Box
            sx={{
              display: "flex",
              gap: "20px",
              alignItems: "center",
              width: "calc(100% - 75px)",
            }}
          >
            {/* <Typography sx={{
          fontSize: '16px',
          color: selectedTotalLTC > foreignCoinBalance ? 'red' : 'white',
        }}><span>{selectedTotalLTC?.toFixed(4)}</span> <span style={{
          marginLeft: 'auto'
        }}>LTC</span></Typography> */}
          </Box>
          {/* <Typography sx={{
          fontSize: '16px',
          color: 'white',
          
        }}><span>{foreignCoinBalance?.toFixed(4)}</span> <span style={{
          marginLeft: 'auto'
        }}>LTC balance</span></Typography> */}
        </Box>
        {CancelButton()}
      </Box>
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        open={open}
        onClose={handleClose}
      >
        <Alert
          onClose={handleClose}
          severity={info?.type}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {info?.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
