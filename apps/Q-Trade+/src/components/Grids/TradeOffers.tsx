import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ColDef,
  RowClassParams,
  RowNode,
  RowStyle,
  SizeColumnsToContentStrategy,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import InfoOutlineIcon from "@mui/icons-material/InfoOutline";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  Snackbar,
  SnackbarCloseReason,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import gameContext from "../../contexts/gameContext";
import { subscribeToEvent, unsubscribeFromEvent } from "../../utils/events";
import { useModal } from "../common/useModal";
import FileSaver from "file-saver";
import { Spacer } from "../common/Spacer";
import { FallingLines, Hourglass } from "react-loader-spinner";
import ErrorIcon from "@mui/icons-material/Error";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import {
  BuyContainer,
  BuyContainerDivider,
  BuyOrderBtn,
  MainContainer,
} from "./Table-styles";

export const baseLocalHost = window.location.host;
// export const baseLocalHost = "devnet-nodes.qortal.link:11111";
// export const baseLocalHost = "127.0.0.1:12391";

import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import moment from "moment";
import { RequestQueueWithPromise } from "qapp-core";
import { useUpdateFee } from "../../hooks/useUpdateFee";
import { useSetAtom } from "jotai/react";
import { stuckTradesAtom } from "../../global/state";

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

interface RowData {
  amountQORT: number;
  priceUSD: number;
  totalUSD: number;
  seller: string;
}

export const saveFileToDisk = async (data) => {
  const dataString = JSON.stringify(data);
  const blob = new Blob([dataString], { type: "application/json" });
  const fileName = "traderecord_" + Date.now() + "_" + ".json";

  await FileSaver.saveAs(blob, fileName);
};

export const autoSizeStrategy: SizeColumnsToContentStrategy = {
  type: "fitCellContents",
};

 const requestQueueGetNames = new RequestQueueWithPromise(4);


export const TradeOffers: React.FC<any> = ({
  foreignCoinBalance,
  fee,
  setFee
}: any) => {
  const [offers, setOffers] = useState<any[]>([]);
  const [signedUnlockingFees, setSignedUnlockingFees] = useState(null);
  const [qortalNames, setQortalNames] = useState({});
  const setStuckTrades = useSetAtom(stuckTradesAtom)
  const selectedCoinRef = useRef(null)
  const {
    fetchOngoingTransactions,
    onGoingTrades,
    updateTransactionInDB,
    isUsingGateway,
    getCoinLabel,
    selectedCoin,
  } = useContext(gameContext);
  const controllerRef = useRef(null)
  const isRemoveOrdersWithoutUnlockingFees = useRef(false);
  const [isRemoveOrders, setIsRemoveOrders] = useState('remove');
  const updateFee = useUpdateFee({setFee, selectedCoin})
  const listOfOngoingTradesAts = useMemo(() => {
    return (
      onGoingTrades
        ?.filter((item) => item?.status !== "trade-failed")
        ?.map((trade) => trade?.qortalAtAddress) || []
    );
  }, [onGoingTrades]);
  const {
    isShow: isShowInfo,
    onCancel: onCancelInfo,
    onOk: onOkInfo,
    show: showInfo,
    message: messageInfo,
  } = useModal();

  const {
    isShow: isShowTradesUnknownFee,
    onCancel: onCancelTradesUnknownFee,
    onOk: onOkTradesUnknownFee,
    show: showTradesUnknownFee,
    message: messageTradesUnknownFee,
  } = useModal();

  const {
    isShow: isShowAskToUpdateFee,
    onCancel: onCancelAskToUpdateFee,
    onOk: onOkAskToUpdateFee,
    show: showAskToUpdateFee,
    message: messageAskToUpdateFee,
  } = useModal();
  
  const offersWithoutOngoing = useMemo(() => {
    return offers.filter(
      (item) => !listOfOngoingTradesAts.includes(item.qortalAtAddress)
    );
  }, [listOfOngoingTradesAts, offers]);
  const initiatedFetchPresence = useRef(false);
  const initiatedFetchPresenceSocket = useRef(false);
  const [isShowBuyInProgress, setIsShowBuyInProgress] = useState(null);
  const socketRef = useRef(null);
  const socketPresenceRef = useRef(null);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [selectedOffers, setSelectedOffers] = useState<any>([]);
  const [record, setRecord] = useState(null);
  const tradePresenceTxns = useRef<any[]>([]);
  const offeringTrades = useRef<any[]>([]);
  const blockedTradesList = useRef([]);
  const gridRef = useRef<any>(null);
  const [openShowOfferDetails, setOpenShowOfferDetails] = useState(null);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [hasTradePresence, setHasTradePresence] = useState(false)
  const [isLoadingTrades, setIsLoadingTrades] = useState(true)
  const BuyButton = () => {
    return <BuyOrderBtn disabled={selectedOffers?.length === 0} sx={{
      transition: '0.3s background-color',
      '&:hover': {
        backgroundColor: '#1b5e20',
      },
    }} onClick={buyOrder}>BUY</BuyOrderBtn>;
  };

  const intervalGetSignedUnlockingFees = useRef<number | null>(null);

  const signedUnlockingFeesRef = useRef(signedUnlockingFees);
  const feeRef = useRef(fee);

  const knownFees = useMemo(() => {


    const lengthOfOffers = selectedOffers.length
    const totalKnownFees = lengthOfOffers * fee
    const feeInLtc = totalKnownFees / 1e8;
    return +feeInLtc.toFixed(8);
  }, [selectedOffers, fee]);


  const defaultColDef = {
    resizable: true, // Make columns resizable by default
    sortable: true, // Make columns sortable by default
    suppressMovable: true, // Prevent columns from being movable
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value
    isRemoveOrdersWithoutUnlockingFees.current = val === 'remove' ? true : false
    setIsRemoveOrders(val);
  };

  const isFetchingName = useRef({})

  const getName = async (address) => {
    try {
      if(isFetchingName.current[address]) return
      isFetchingName.current[address] = true
     const response = await requestQueueGetNames.enqueue(
        () => {
          return fetch("/names/primary/" + address);
        }
      );
      const nameData = await response.json();
      if (nameData?.name) {
        setQortalNames((prev) => {
          return {
            ...prev,
            [address]: nameData.name,
          };
        });
      } else {
        setQortalNames((prev) => {
          return {
            ...prev,
            [address]: null,
          };
        });
      }
    } catch (error) {
      // error
    }
  };

  const restartTradeOffers = () => {
    if (socketRef.current) {
      socketRef.current.close(1000, "forced"); // Close with a custom reason
      socketRef.current = null;
    }
    offeringTrades.current = [];
    setOffers([]);
    setSelectedOffer(null);
    if(gridRef.current){
   gridRef.current?.api?.refreshCells({ force: true });
}
  };

  useEffect(()=> {
selectedCoinRef.current = selectedCoin
if(gridRef.current){
   gridRef.current?.api?.refreshCells({ force: true });
}

  }, [selectedCoin])

  const restartPresence = () => {
    if (socketPresenceRef.current) {
      socketPresenceRef.current.close(1000, "forced"); // Close with a custom reason
      socketPresenceRef.current = null;
    }
  };

  const rowTooltip = (params) => {
    let selectable = true;
    const hasSignedFee = signedUnlockingFees?.find(
      (item) => item?.atAddress === params.data.qortalAtAddress
    );
    if (!hasSignedFee) selectable = true;
    if (hasSignedFee && hasSignedFee?.fee > feeRef.current && selectedCoin !== "PIRATECHAIN")
      selectable = false;
    if(!selectable)return  'Your unlocking fee is to low to buy this order, Increase your fee to purchase'

    return ''
  };

const columnDefs: ColDef[] = useMemo(() => {
  const baseColumns: ColDef[] = [
    {
      headerCheckboxSelection: true,
      checkboxSelection: true,
      headerName: "",
      width: 100,
      pinned: "left",
      resizable: false,
      // @ts-ignore
      suppressRowClickSelection: true,
      tooltipValueGetter: rowTooltip,
      cellRenderer: (params) => (
        <SelectWithInfoCell
          {...params}
          selectTradeForDetails={() => {
            const hasSignedFee = signedUnlockingFees?.find(
              (item) =>
                item?.atAddress === params?.node?.data?.qortalAtAddress
            );
            let fee = null;
            if (hasSignedFee) {
              fee = hasSignedFee.fee;
            }

            setOpenShowOfferDetails({ ...(params?.node?.data || {}), fee });
          }}
        />
      ),
    },
    {
      headerName: "QORT AMOUNT",
      field: "qortAmount",
      flex: 1,
      minWidth: 150,
      resizable: true,
      tooltipValueGetter: rowTooltip
    },
    {
      headerName: `${getCoinLabel()}/QORT`,
      valueGetter: (params) =>
        +params.data.foreignAmount / +params.data.qortAmount,
      sortable: true,
      sort: "asc",
      flex: 1,
      minWidth: 150,
      resizable: true,
      tooltipValueGetter: rowTooltip
    },
    {
      headerName: `Total ${getCoinLabel()} Value`,
      field: "foreignAmount",
      flex: 1,
      minWidth: 150,
      resizable: true,
      tooltipValueGetter: rowTooltip
    },
  ];

  // Conditionally insert the "Unlocking fee" column
  if (selectedCoinRef.current !== 'PIRATECHAIN') {
    baseColumns.push({
      headerName: `Unlocking fee`,
      flex: 1,
      minWidth: 150,
      resizable: true,
      tooltipValueGetter: rowTooltip,
      valueGetter: (params) => {
        if (params?.data?.qortalAtAddress) {
          const hasSignedFee = signedUnlockingFees?.find(
            (item) => item?.atAddress === params.data.qortalAtAddress
          );
          if (!hasSignedFee) return "Unknown";
          return hasSignedFee.fee;
        } else return "Unknown";
      },
    });
  }

  // Final column (Seller)
  baseColumns.push({
    headerName: "Seller",
    field: "qortalCreator",
    flex: 1,
    minWidth: 300,
    resizable: true,
    tooltipValueGetter: rowTooltip,
    valueGetter: (params) => {
      if (params?.data?.qortalCreator) {
        if (qortalNames[params?.data?.qortalCreator]) {
          return qortalNames[params?.data?.qortalCreator];
        } else if (qortalNames[params?.data?.qortalCreator] === undefined) {
          getName(params?.data?.qortalCreator);
          return params?.data?.qortalCreator;
        } else {
          return params?.data?.qortalCreator;
        }
      }
    },
  });

  return baseColumns;
}, [qortalNames, getCoinLabel, signedUnlockingFees, selectedCoinRef.current]);


  // const onRowClicked = (event: any) => {
  //   if(listOfOngoingTradesAts.includes(event.data.qortalAtAddress)) return
  //   setSelectedOffer(event.data)

  // };

  const restartTradePresenceWebSocket = () => {
    restartPresence();
    setTimeout(() => initTradePresenceWebSocket(true), 50);
  };

  const getNewBlockedTrades = async () => {
    const unconfirmedTransactionsList = async () => {
      const unconfirmedTransactionslUrl = `/transactions/unconfirmed?txType=MESSAGE&limit=0&reverse=true`;

      var addBlockedTrades = JSON.parse(
        localStorage.getItem("failedTrades") || "[]"
      );

      await fetch(unconfirmedTransactionslUrl)
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          data.map((item: any) => {
            const unconfirmedNessageTimeDiff = Date.now() - item.timestamp;
            const timeOneHour = 60 * 60 * 1000;
            if (Number(unconfirmedNessageTimeDiff) > Number(timeOneHour)) {
              const addBlocked = {
                timestamp: item.timestamp,
                recipient: item.recipient,
              };
              addBlockedTrades.push(addBlocked);
            }
          });
          localStorage.setItem(
            "failedTrades",
            JSON.stringify(addBlockedTrades)
          );
          blockedTradesList.current = JSON.parse(
            localStorage.getItem("failedTrades") || "[]"
          );
        });
    };

    await unconfirmedTransactionsList();

    const filterUnconfirmedTransactionsList = async () => {
      let cleanBlockedTrades = blockedTradesList.current.reduce(
        (newArray, cut: any) => {
          if (
            cut &&
            !newArray.some((obj: any) => obj.recipient === cut.recipient)
          ) {
            newArray.push(cut);
          }
          return newArray;
        },
        [] as any[]
      );
      localStorage.setItem("failedTrades", JSON.stringify(cleanBlockedTrades));
      blockedTradesList.current = JSON.parse(
        localStorage.getItem("failedTrades") || "[]"
      );
    };

    await filterUnconfirmedTransactionsList();
    processOffersWithPresence();
  };

  const executeGetNewBlockTrades = useCallback(() => {
    getNewBlockedTrades();
  }, []);

  useEffect(() => {
    subscribeToEvent("execute-get-new-block-trades", executeGetNewBlockTrades);

    return () => {
      unsubscribeFromEvent(
        "execute-get-new-block-trades",
        executeGetNewBlockTrades
      );
    };
  }, []);

  const processOffersWithPresence = useCallback(() => {
    if (offeringTrades.current === null) return;
    async function asyncForEach(array: any, callback: any) {
      for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
      }
    }

    const filterOffersUsingTradePresence = (offeringTrade: any) => {
      return offeringTrade.tradePresenceExpiry > Date.now();
    };

    const filterForStuckDrades = (offeringTrade: any) => {
      return (!offeringTrade?.tradePresenceExpiry || offeringTrade.tradePresenceExpiry < Date.now());
    };

    const startOfferPresenceMapping = async () => {
      if (tradePresenceTxns.current) {
        for (const tradePresence of tradePresenceTxns.current) {
          const offerIndex = offeringTrades.current.findIndex(
            (offeringTrade) =>
              offeringTrade.qortalCreatorTradeAddress ===
              tradePresence.tradeAddress
          );
          if (offerIndex !== -1) {
            offeringTrades.current[offerIndex].tradePresenceExpiry =
              tradePresence.timestamp;
          }
        }
      }
      offeringTrades.current = Object.values(
  offeringTrades.current.reduce((acc, trade) => {
    const key = trade.qortalAtAddress;
    if (!acc[key] || trade.timestamp > acc[key].timestamp) {
      acc[key] = trade;
    }
    return acc;
  }, {} as Record<string, typeof offeringTrades.current[number]>)
);
      let filteredOffers =
        offeringTrades.current?.filter((offeringTrade) =>
          filterOffersUsingTradePresence(offeringTrade)
        ) || [];

      const stuckTrades = offeringTrades.current?.filter((offeringTrade) =>
        filterForStuckDrades(offeringTrade)
      ) || [];
      setStuckTrades(stuckTrades?.sort((a, b) => b.timestamp - a.timestamp))
      let tradesPresenceCleaned: any[] = filteredOffers;

      blockedTradesList.current.forEach((item: any) => {
        const toDelete = item.recipient;
        tradesPresenceCleaned =
          tradesPresenceCleaned?.filter((el) => {
            return el.qortalCreatorTradeAddress !== toDelete;
          }) || [];
      });

      if (tradesPresenceCleaned) {
        updateGridData(tradesPresenceCleaned);
      }
    };

    startOfferPresenceMapping();
  },[setStuckTrades]);

  const restartTradeOffersWebSocket = () => {
    setTimeout(() => initTradeOffersWebSocket(true), 50);
  };

  const initTradePresenceWebSocket = (restarted = false) => {
    if (socketPresenceRef.current) return;
    let socketTimeout: any;
    let socketLink;
    if (isUsingGateway) {
      socketLink = `wss://appnode.qortal.org/websockets/crosschain/tradepresence`;
    } else {
      socketLink = `${
        window.location.protocol === "https:" ? "wss:" : "ws:"
      }//${baseLocalHost}/websockets/crosschain/tradepresence`;
    }

    socketPresenceRef.current = new WebSocket(socketLink);
    socketPresenceRef.current.onopen = () => {
      setTimeout(pingSocket, 50);
    };
    socketPresenceRef.current.onmessage = (e) => {
      tradePresenceTxns.current = !initiatedFetchPresenceSocket.current
        ? JSON.parse(e.data)
        : [...tradePresenceTxns.current, ...JSON.parse(e.data)];
      initiatedFetchPresenceSocket.current = true;
      processOffersWithPresence();
      setHasTradePresence(true)
      restarted = false;
    };
    socketPresenceRef.current.onclose = (event) => {
      clearTimeout(socketTimeout);
      if (event.reason === "forced") {
        return;
      }
      restartTradePresenceWebSocket();
    };
    socketPresenceRef.current.onerror = (e) => {
      clearTimeout(socketTimeout);
      restartTradePresenceWebSocket();
    };
    const pingSocket = () => {
      socketPresenceRef.current.send("ping");
      socketTimeout = setTimeout(pingSocket, 295000);
    };
  };

  const fetchOffers = useCallback(async (selectedCoin) => {
    try {
       if(selectedCoinRef.current !== selectedCoin) return
      setIsLoadingTrades(true)
      if(controllerRef.current){
       try {
          controllerRef.current?.abort();
       } catch (error) {
        console.error('failed to abort')
       }
      }
       controllerRef.current = new AbortController();
      const response = await fetch(
        `/crosschain/tradeoffers?foreignBlockchain=${selectedCoin}&includeHistoric=true`, { signal: controllerRef.current.signal}
      );
    
      const data = await response.json();

      const transformed = data.map(item => ({
        qortalAtAddress: item.qortalAtAddress,
        qortalCreator: item.qortalCreator,
        qortalCreatorTradeAddress: item.qortalCreatorTradeAddress,
        qortAmount: item.qortAmount,
        btcAmount: item.expectedBitcoin ?? item.btcAmount, // fallback if already correct
        foreignAmount: item.expectedForeignAmount ?? item.foreignAmount,
        tradeTimeout: item.tradeTimeout,
        mode: item.mode,
        timestamp: item.timestamp ?? item.creationTimestamp,
        foreignBlockchain: item.foreignBlockchain,
        acctName: item.acctName
      }));
      if(selectedCoinRef.current !== selectedCoin) return
      offeringTrades.current = [
        ...transformed?.filter(
          (coin) => coin?.foreignBlockchain === selectedCoin && coin?.mode === 'OFFERING'
        ),
      ];
      processOffersWithPresence();
       setIsLoadingTrades(false)
    } catch (error) {
      console.error(error)
    } 
  },[]);

  const initTradeOffersWebSocket = async (restarted = false) => {
    if (socketRef.current) return;
    if(restarted === false){
      await fetchOffers(selectedCoin)
    }
    let socketTimeout: any;

    let socketLink;
    if (isUsingGateway) {
      socketLink = `wss://appnode.qortal.org/websockets/crosschain/tradeoffers?foreignBlockchain=${selectedCoin}&includeHistoric=true`;
    } else {
      socketLink = `${
        window.location.protocol === "https:" ? "wss:" : "ws:"
      }//${baseLocalHost}/websockets/crosschain/tradeoffers?foreignBlockchain=${selectedCoin}&includeHistoric=true`;
    }
    socketRef.current = new WebSocket(socketLink);
    socketRef.current.onopen = () => {
      setTimeout(pingSocket, 50);
    };
    socketRef.current.onmessage = (e) => {
      if(selectedCoinRef.current !== selectedCoin) return
      offeringTrades.current = [
        ...offeringTrades.current?.filter(
          (coin) => coin?.foreignBlockchain === selectedCoin && coin?.mode === 'OFFERING'
        ),
        ...JSON.parse(e.data)?.filter(
          (coin) => coin?.foreignBlockchain === selectedCoin && coin?.mode === 'OFFERING'
        ),
      ];
      restarted = false;
      processOffersWithPresence();
    };
    socketRef.current.onclose = (event) => {
      clearTimeout(socketTimeout);
      if (event.reason === "forced") {
        return;
      }
      restartTradeOffersWebSocket();
      socketRef.current = null;
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
    if (isUsingGateway === null) return;
    blockedTradesList.current = JSON.parse(
      localStorage.getItem("failedTrades") || "[]"
    );
    if (!initiatedFetchPresence.current) {
      initiatedFetchPresence.current = true;
      initTradePresenceWebSocket();
    }
    getNewBlockedTrades();
    const intervalBlockTrades = setInterval(() => {
      initiatedFetchPresenceSocket.current = false;
      restartPresence();
      initTradePresenceWebSocket();
      getNewBlockedTrades();
    }, 150000);

    return () => {
      clearInterval(intervalBlockTrades);
    };
  }, [isUsingGateway]);

  const getSignedUnlockingFees = useCallback(async () => {
    try {
      const response = await fetch(
        `/crosschain/signedfees`
      );
      const data = await response.json();
      if (data && Array.isArray(data)) {
        setSignedUnlockingFees(data);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);


  useEffect(() => {
    getSignedUnlockingFees();
    intervalGetSignedUnlockingFees.current = setInterval(() => {
      getSignedUnlockingFees();
    }, 150000);
    return () => {
      if (intervalGetSignedUnlockingFees.current) {
        clearInterval(intervalGetSignedUnlockingFees.current);
      }
    };
  }, [getSignedUnlockingFees]);

  useEffect(() => {
    if (isUsingGateway === null) return;
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
  }, [isUsingGateway, selectedCoin]);

  const selectedTotalLTC = useMemo(() => {
    const total = selectedOffers.reduce((acc: number, curr: any) => {
      return acc + (+curr.foreignAmount || 0); // Ensure qortAmount is defined
    }, 0);
    if (selectedCoin === "PIRATECHAIN") return total;
    const totalWithKnownFees = +total + +knownFees;
    return totalWithKnownFees;
  }, [selectedOffers, knownFees, selectedCoin]);

  const buyOrder = async () => {
    try {

      if (+foreignCoinBalance < +selectedTotalLTC.toFixed(8)) {
        setOpen(true);
        setInfo({
          type: "error",
          message: `You don't have enough ${getCoinLabel()} or your balance was not retrieved`,
        });
        return;
      }

      if (selectedOffers?.length < 1) return;
      let offersWithKnownFees = [];
      const offersWithUnknownFees = [];
      if (selectedCoin !== "PIRATECHAIN") {
        selectedOffers.forEach((offer) => {
          const feeEntry = signedUnlockingFees.find(
            (item) => item?.atAddress === offer.qortalAtAddress
          );

          if (feeEntry && typeof feeEntry.fee === "number") {
            offersWithKnownFees.push({ ...offer, fee: feeEntry.fee });
          } else {
            offersWithUnknownFees.push(offer);
          }
        });
        if (offersWithUnknownFees?.length > 0) {
          await showTradesUnknownFee({
            message: "",
          });

          if (!isRemoveOrdersWithoutUnlockingFees.current) {
            offersWithKnownFees = [
              ...offersWithKnownFees,
              ...offersWithUnknownFees,
            ];
          }
        }
      } else {
        offersWithKnownFees = selectedOffers;
      }

      const highestFee = offersWithKnownFees.length
  ? Math.max(
      ...offersWithKnownFees
        .filter(o => typeof o.fee === 'number')
        .map(o => o.fee as number)
    )
  : 0;
    if(highestFee < fee && selectedCoin !== "PIRATECHAIN"){

      await showAskToUpdateFee({
        message: highestFee
      })
    }


      setIsShowBuyInProgress({ status: "buying" });

      // setOpen(true)
      // setInfo({
      //   type: 'info',
      //   message: "Attempting to submit buy order. Please wait..."
      // })
      const listOfATs = offersWithKnownFees;
      if(listOfATs?.length === 0){
        throw new Error('No buy orders selected')
      }
      const response = await qortalRequestWithTimeout(
        {
          action: "CREATE_TRADE_BUY_ORDER",
          crosschainAtInfo: listOfATs,
          foreignBlockchain: selectedCoin,
        },
        900000
      );
      if (response?.error) {
        setIsShowBuyInProgress({
          status: "error",
          message: response?.error || "Failed to submit trade order.",
        });
        //   setOpen(true)
        // setInfo({
        //   type: 'error',
        //   message: response?.error || "Failed to submit trade order."
        // })
        return;
      }
      if (response?.extra?.atAddresses) {
        setIsShowBuyInProgress({ status: "success" });
        setSelectedOffers([]);
        const transactionData = {
          qortalAtAddresses: response?.extra?.atAddresses,
          qortAddress: response?.extra?.senderAddress,
          node: response?.extra?.node,
          status: response?.extra?.status
            ? response?.extra?.status
            : response.callResponse === true
            ? "trade-ongoing"
            : "trade-failed",
          encryptedMessageToBase58: response?.encryptedMessageToBase58,
          chatSignature: response?.chatSignature,
          sender: response?.extra?.senderAddress,
          senderPublicKey: response?.extra?.senderPublicKey,
          reference: response?.callResponse?.reference,
        };

        // Update transactions in IndexedDB
        const result = await updateTransactionInDB(transactionData);
        setOpen(true);
        setInfo({
          type: "success",
          message: "Submitted Order",
        });
        fetchOngoingTransactions();
        if (isUsingGateway) {
          setRecord(transactionData);
          await showInfo({
            message: `Keep a record of your order in case your trade gets stuck`,
          });
        }
      }
    } catch (error) {
      setIsShowBuyInProgress({
        status: "error",
        message:
          error?.error || error?.message || "Failed to submit trade order.",
      });
      // setOpen(true)
      // setInfo({
      //   type: 'error',
      //   message: error?.error || error?.message || "Failed to submit trade order."
      // })
      // console.error(error)
    }
  };

  const getRowStyle = (
    params: RowClassParams<any, any>
  ): RowStyle | undefined => {
    if (listOfOngoingTradesAts.includes(params.data.qortalAtAddress)) {
      return { background: "#D9D9D91A" };
    }
    if (params.data.qortalAtAddress === selectedOffer?.qortalAtAddress) {
      return { background: "#6D94F533" };
    }

    const hasSignedFee = signedUnlockingFees?.find(
      (item) => item?.atAddress === params.data.qortalAtAddress
    );
    if (hasSignedFee) {
      if (fee && hasSignedFee?.fee > fee) {
        return { backgroundColor: "#FF0000" };
      }
    }

    return undefined;
  };
  // const onGridReady = (params) => {
  //   const allColumnIds = params.columnApi.getAllColumns().map(col => col.getColId());
  //   params.columnApi.autoSizeColumns(allColumnIds, false);
  // };

  const onSelectionChanged = (event: any) => {
    const selectedRows = event.api.getSelectedRows();

    setSelectedOffers([...selectedRows]); // Set all selected rows
  };

  const onRowClicked = (event: any) => {
    if (listOfOngoingTradesAts.includes(event.data.qortalAtAddress)) return;
    const selectedRows = gridRef.current?.api.getSelectedRows();
    setSelectedOffers([...selectedRows]); // Always spread the array to ensure state updates correctly
  };

  const updateGridData = (newData: any) => {
    if (gridRef.current) {
      setOffers(newData);
    }
  };

  const getRowId = useCallback(function (params: any) {
    return String(params.data.qortalAtAddress);
  }, []);

  const selectedTotalQORT = useMemo(() => {
    const total = selectedOffers.reduce((acc: number, curr: any) => {
      return acc + (+curr.qortAmount || 0); // Ensure qortAmount is defined
    }, 0);
    return total;
  }, [selectedOffers]);

  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit(); // Adjust columns to fit the grid width
    const allColumnIds = params?.columnApi
      ?.getAllColumns()
      ?.map((col: any) => col?.getColId());
      if(allColumnIds){
    params.columnApi.autoSizeColumns(allColumnIds); // Automatically adjust the width to fit content

      }
  }, []);

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

  useEffect(() => {
    signedUnlockingFeesRef.current = signedUnlockingFees;
    feeRef.current = fee;

    if (gridRef.current?.api && selectedCoinRef.current !== 'PIRATECHAIN') {

      gridRef.current.api.forEachNode((rowNode: RowNode) => {
        const qortalAtAddress = rowNode.data?.qortalAtAddress;
        const hasSignedFee = signedUnlockingFeesRef.current?.find(
          (item) => item?.atAddress === qortalAtAddress
        );

        const isSelectable =
          !hasSignedFee || hasSignedFee.fee <= feeRef.current;

        rowNode.setRowSelectable(isSelectable); // ✅ apply logic per row
      });

      // Optional: refresh selection/checkbox visuals
      gridRef.current?.api?.refreshCells({ force: true });
    }
  }, [signedUnlockingFees, fee]);

  if (!signedUnlockingFees || ((fee === undefined || fee === null) && selectedCoin !== "PIRATECHAIN"))
    return null;

  return (
    <MainContainer>
      <div
        className="ag-theme-alpine-dark"
        style={{ height: 400, width: "100%" }}
      >
        {(isLoadingTrades || !hasTradePresence) && (
          <Box sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            gap: '20px'
          }}>
            <Typography>Loading Trades</Typography>
          <FallingLines color="white" width="30" visible={true} />

          </Box>
        )}
        <Box sx={{
          width: '100%',
          visibility: (isLoadingTrades || !hasTradePresence) ? 'hidden' : 'visible',
          height: '100%'
        }}>
<AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowData={offersWithoutOngoing}
          onRowClicked={onRowClicked}
          onSelectionChanged={onSelectionChanged}
          getRowStyle={getRowStyle}
          autoSizeStrategy={autoSizeStrategy}
          rowSelection={selectedCoin === "PIRATECHAIN" ? "single" : "multiple"} // Enable multi-select
          rowMultiSelectWithClick={true}
          suppressHorizontalScroll={false} // Allow horizontal scroll on mobile if needed
          suppressCellFocus={true} // Prevents cells from stealing focus in mobile
          // pagination={true}
          // paginationPageSize={10}
          onGridReady={onGridReady}
          //  domLayout='autoHeight'
          getRowId={(params) => params.data.qortalAtAddress} // Ensure rows have unique IDs
          enableBrowserTooltips={true}
          gridOptions={{
            isRowSelectable: (params) => {
              if(selectedCoinRef.current === 'PIRATECHAIN') return true
              let selectable = true;
              const hasSignedFee = signedUnlockingFeesRef.current?.find(
                (item) => item?.atAddress === params.data.qortalAtAddress
              );
              if (!hasSignedFee) selectable = true;

              if (hasSignedFee && hasSignedFee?.fee > feeRef.current)
                selectable = false;
              return selectable;
            },
          }}
        />
      </Box>
        
        {/* {selectedOffer && (
        <Button onClick={buyOrder}>Buy</Button>

      )} */}
      </div>
      <div
        style={{
          height: "150px",
        }}
      />
      <BuyContainer>
        <BuyContainerDivider />
        <Box
          sx={{
            display: "flex",
            gap: "5px",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <Typography
            sx={{
              fontSize: "16px",
              color: "white",
              width: "calc(100% - 75px)",
            }}
          >
            {selectedTotalQORT?.toFixed(8)} QORT
          </Typography>
          <Box
            sx={{
              display: "flex",
              gap: "20px",
              alignItems: "center",
              width: "calc(100% - 75px)",
            }}
          >
            <Typography
              sx={{
                fontSize: "16px",
                backgroundColor:
                  selectedTotalLTC > foreignCoinBalance ? "red" : "unset",
                color: "white",
              }}
            >
              <span>{selectedTotalLTC?.toFixed(8)}</span>{" "}
              <span
                style={{
                  marginLeft: "auto",
                }}
              >{`${getCoinLabel()} ${
                selectedCoin !== "PIRATECHAIN" ? "with unlocking fees" : ""
              }`}</span>
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: "16px",
              color: "white",
            }}
          >
            <span>{foreignCoinBalance?.toFixed(8)}</span>{" "}
            <span
              style={{
                marginLeft: "auto",
              }}
            >
              {`${getCoinLabel()} `} balance
            </span>
          </Typography>
        </Box>
        {BuyButton()}
      </BuyContainer>
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
      {isShowInfo && (
        <Dialog
          open={isShowInfo}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{"Download record"}</DialogTitle>
          <DialogContent>
            <DialogContentText
              id="alert-dialog-description"
              sx={{
                color: "white",
              }}
            >
              {messageInfo.message}
            </DialogContentText>
            <Button
              onClick={async () => {
                try {
                  const fileName = "traderecord_" + Date.now() + "_" + ".json";
                  const dataString = JSON.stringify(record);
                  const blob = new Blob([dataString], {
                    type: "application/json",
                  });
                  await qortalRequest({
                    action: "SAVE_FILE",
                    filename: fileName,
                    blob,
                  });
                } catch (error) {}
              }}
            >
              Save Record
            </Button>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={onOkInfo} autoFocus>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {isShowTradesUnknownFee && (
        <Dialog
          open={isShowTradesUnknownFee}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            style: {
              backgroundColor: "rgb(39, 40, 44)",
              background: "rgb(39, 40, 44)",
            },
          }}
        >
          <DialogTitle sx={{
         
            background: "rgb(39, 40, 44)"

          }} id="alert-dialog-title">Warning</DialogTitle>
          <DialogContent sx={{ borderColor: "#333" }}>
            <DialogContentText
              id="alert-dialog-description"
              sx={{ color: "white" }}
            >
              Some of your buy orders have unknown unlocking fees.
            </DialogContentText>
            <Spacer height="20px" />
            <DialogContentText
              id="alert-dialog-description"
              sx={{ color: "white" }}
            >
              You may proceed with your purchases without removing these orders,
              but there is a higher risk that the trades may not go through. In
              such cases, you will be refunded.
            </DialogContentText>

            <Spacer height="20px" />
            <FormControl>
              <RadioGroup
                aria-labelledby="demo-controlled-radio-buttons-group"
                name="controlled-radio-buttons-group"
                value={isRemoveOrders}
                onChange={handleChange}
              >
                <FormControlLabel
                  value={"remove"}
                  control={
                    <Radio
                      sx={{
                        "&.Mui-checked": {
                          color: "white",
                        },
                        "& .MuiSvgIcon-root": {
                          color: "white",
                        },
                      }}
                    />
                  }
                  label="Remove orders with unknown unlocking fees"
                />
                <FormControlLabel
                  value={'keep'}
                  control={
                    <Radio
                      sx={{
                        "&.Mui-checked": {
                          color: "white",
                        },
                        "& .MuiSvgIcon-root": {
                          color: "white",
                        },
                      }}
                    />
                  }
                  label="Keep orders with unknown unlocking fees"
                />
              </RadioGroup>
            </FormControl>

            
          </DialogContent>
          <DialogActions sx={{
            background: "rgb(39, 40, 44)",
          }}>
            <Button
              variant="outlined"
              onClick={onCancelTradesUnknownFee}
              autoFocus
            >
              Close
            </Button>
            <Button
              variant="outlined"
              onClick={onOkTradesUnknownFee}
              autoFocus
            >
              Continue
            </Button>
          </DialogActions>
        </Dialog>
      )}

{isShowAskToUpdateFee && (
        <Dialog
          open={isShowAskToUpdateFee}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            style: {
              backgroundColor: "rgb(39, 40, 44)",
              background: "rgb(39, 40, 44)",
            },
          }}
        >
          <DialogTitle  sx={{
            background: "rgb(39, 40, 44)",
          }} id="alert-dialog-title">Suggestion</DialogTitle>
          <DialogContent sx={{ borderColor: "#333" }}>
            <DialogContentText
              id="alert-dialog-description"
              sx={{ color: "white" }}
            >
              Your current unlocking fee is higher than necessary. You can lower it to match the highest required fee and reduce costs.
            </DialogContentText>
            <Spacer height="20px" />
     

            
          </DialogContent>
          <DialogActions   sx={{
              background: "rgb(39, 40, 44)",
            }}>
            <Button
              variant="outlined"
              onClick={onOkAskToUpdateFee}
              
            >
              Continue without updating
            </Button>
            <Button
              variant="outlined"
              onClick={async (e)=> {
                try {
                  await updateFee(messageAskToUpdateFee.message)
                } catch (error) {
                  console.error(error)
                }
                onOkAskToUpdateFee(e)
              }}
              
            >
              Lower fee
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {isShowBuyInProgress && (
        <Dialog
          open={isShowBuyInProgress}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          PaperProps={{
            style: {
              backgroundColor: "rgb(39, 40, 44)",
              background: "rgb(39, 40, 44)",
            },
          }}
        >
          <DialogContent
            sx={{
              width: "450px",
              height: "450px",
              maxHeight: "calc(90vh - 55px)",
              maxWidth: "90%",
              background: "rgb(39, 40, 44)",
              overflow: "auto",
            }}
          >
            {isShowBuyInProgress?.status === "error" && (
              <Box>
                <Typography>
                  <ErrorIcon
                    sx={{
                      color: "red",
                    }}
                  />
                  {` Failed to submit buy order.`}
                </Typography>
                <Spacer height="20px" />
                <Typography>{isShowBuyInProgress?.message}</Typography>
              </Box>
            )}
            {isShowBuyInProgress?.status === "success" && (
              <Box>
                <Typography>
                  <CheckCircleIcon
                    sx={{
                      color: "green",
                    }}
                  />
                  {` Successfully submitted order.`}
                </Typography>
                <Spacer height="20px" />
                <Typography>
                  You can see the progress of your order in the "Pending" table.
                </Typography>
                <Spacer height="20px" />
                <Typography>
                  Note: Submission of an order does not necessarily mean that
                  your submission will be the one completing the order. Another
                  account may have submitted it before you.
                </Typography>
              </Box>
            )}
            {isShowBuyInProgress?.status === "buying" && (
              <Box>
                <Typography>
                  <Hourglass
                    visible={true}
                    height="25"
                    width="25"
                    ariaLabel="hourglass-loading"
                    wrapperStyle={{}}
                    wrapperClass=""
                    colors={["#306cce", "#72a1ed"]}
                  />
                  {` Attempting to submit buy order`}
                </Typography>
                <Spacer height="20px" />
                <Typography>
                  Please do not leave this application until there is a
                  response. Please wait!
                </Typography>
                <Spacer height="20px" />
                {isUsingGateway && (
                  <>
                    <Typography>
                      Using gateway: might take up to 3 minutes to submit the
                      buy order.
                    </Typography>
                    <Spacer height="20px" />
                    <Box
                      sx={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <CountdownCircleTimer
                        isPlaying
                        duration={180}
                        colors={["#004777", "#F7B801", "#A30000", "#A30000"]}
                        colorsTime={[7, 5, 2, 0]}
                        onComplete={() => {
                          //nothing
                        }}
                        size={60}
                        strokeWidth={4}
                      >
                        {({ remainingTime }) => (
                          <Typography>{remainingTime}</Typography>
                        )}
                      </CountdownCircleTimer>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              background: "rgb(39, 40, 44)",
            }}
          >
            <Button
              disabled={isShowBuyInProgress?.status === "buying"}
              variant="outlined"
              onClick={() => {
                setIsShowBuyInProgress(null);
              }}
              autoFocus
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog
        open={!!openShowOfferDetails}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{
          style: {
            backgroundColor: "rgb(39, 40, 44)",
            background: "rgb(39, 40, 44)",
          },
        }}
      >
        <DialogTitle
          sx={{
            maxHeight: "calc(90vh - 55px)",
            maxWidth: "90%",
            background: "rgb(39, 40, 44)",
            overflow: "auto",
          }}
        >
          <Typography variant="subtitle1">
            Buy {openShowOfferDetails?.qortAmount} QORT @{" "}
            {openShowOfferDetails?.foreignAmount} {getCoinLabel()}
          </Typography>
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setOpenShowOfferDetails(null)}
          sx={{ position: "absolute", right: 8, top: 8, color: "#fff" }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent dividers sx={{ borderColor: "#333" }}>
          {fee &&
            openShowOfferDetails?.fee &&
            +fee < +openShowOfferDetails?.fee && (
              <Box
                sx={{
                  background: "red",
                  padding: "10px",
                  borderRadius: "5px",
                }}
              >
                <Typography sx={{ color: "white" }}>
                  The unlocking fee on this node is lower than the amount
                  required for this order.
                </Typography>
                <Spacer height="10px" />
                <Typography sx={{ color: "white" }}>
                  If you're using your own node, you can change the fee by
                  clicking the "Fee" button next to the coin selector.
                </Typography>
              </Box>
            )}
          <TradeRow
            enableSlice
            enableCopy
            label="Seller"
            value={openShowOfferDetails?.qortalCreator}
            extra={qortalNames[openShowOfferDetails?.qortalCreator]}
          />
          <TradeRow
            label="Amount"
            value={`${openShowOfferDetails?.qortAmount} QORT`}
          />
          <TradeRow
            label="Total"
            value={`${openShowOfferDetails?.foreignAmount} ${getCoinLabel()}`}
          />
          <TradeRow
            label="Price"
            value={`${
              +openShowOfferDetails?.foreignAmount /
              +openShowOfferDetails?.qortAmount
            } ${getCoinLabel()}/QORT`}
          />
          {openShowOfferDetails?.fee && (
            <TradeRow
              label="Unlocking fee"
              value={`${openShowOfferDetails?.fee} sats`}
            />
          )}

          <TradeRow
            enableSlice
            enableCopy
            label="AT Address"
            value={openShowOfferDetails?.qortalAtAddress}
          />
        </DialogContent>
        <DialogActions
          sx={{
            background: "rgb(39, 40, 44)",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => {
              setOpenShowOfferDetails(null);
            }}
            autoFocus
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

const TradeRow = ({
  label,
  value,
  extra,
  enableSlice,
  enableCopy,
}: {
  label: string;
  value: string;
  extra?: string;
  enableSlice?: boolean;
  enableCopy?: boolean;
}) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      mb: 2,
    }}
  >
    <Typography variant="caption" color="gray">
      {label}
    </Typography>

    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        flexWrap: "wrap",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {enableSlice && value?.length > 18
          ? value?.slice(0, 6) + "..." + value.slice(-4)
          : value}
      </Typography>
      {enableCopy && (
        <Tooltip title="Copy">
          <IconButton size="small" onClick={() => copyToClipboard(value)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {extra && (
        <Typography variant="body2" color="gray">
          {extra}
        </Typography>
      )}
    </Box>
  </Box>
);

const SelectWithInfoCell = ({ selectTradeForDetails }) => {
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents row selection
    selectTradeForDetails();
    // alert(`Info for ${data.qortalAtAddress}`); // Replace with your own UI
  };

  return (
    <div
      className="ag-cell-ignore-selection"
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <IconButton
        size="small"
        onClick={handleInfoClick}
        onClickCapture={(e) => {
          e.stopPropagation();
          handleInfoClick(e);
        }}
        onMouseDown={(e) => e.stopPropagation()} // 👈 this is key
        sx={{ minWidth: 0, padding: "0 4px" }}
      >
        <InfoOutlineIcon />
      </IconButton>
    </div>
  );
};
