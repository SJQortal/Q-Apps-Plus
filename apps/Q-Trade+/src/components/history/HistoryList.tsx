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
import { Alert, Box, Snackbar, SnackbarCloseReason, Typography } from "@mui/material";
import gameContext from "../../contexts/gameContext";
import { formatTimestampForum } from "../../utils/formatTime";

const defaultColDef = {
  resizable: true, // Make columns resizable by default
  sortable: true, // Make columns sortable by default
  suppressMovable: true, // Prevent columns from being movable
};



export default function HistoryList({ qortAddress, historyList }) {
  const gridRef = useRef<any>(null);
  const { getCoinLabel, selectedCoin} = useContext(gameContext)
  const [qortalNames, setQortalNames] = useState({});


  const onGridReady = useCallback((params: any) => {
    params.api.sizeColumnsToFit(); // Adjust columns to fit the grid width
    const allColumnIds = params.columnApi
      .getAllColumns()
      .map((col: any) => col.getColId());
    params.columnApi.autoSizeColumns(allColumnIds); // Automatically adjust the width to fit content
  }, []);

  const getName = async (address) => {
    try {
      const response = await fetch("/names/primary/" + address);
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


  const columnDefs: ColDef[] = useMemo(()=>  {
    return [
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
        headerName: "Time",
        field: "tradeTimestamp",
        valueGetter: (params) =>
        formatTimestampForum(params.data.tradeTimestamp),
        flex: 1, // Flex makes this column responsive
        minWidth: 200, // Ensure it doesn't shrink too much
        resizable: true,
      },
      {
        headerName: "Buyer",
        field: "buyerReceivingAddress",
        flex: 1, // Flex makes this column responsive
        minWidth: 200, // Ensure it doesn't shrink too much
        resizable: true,
        valueGetter: (params) => {
          if (params?.data?.buyerReceivingAddress) {
            if (qortalNames[params?.data?.buyerReceivingAddress]) {
              return qortalNames[params?.data?.buyerReceivingAddress];
            } else if (qortalNames[params?.data?.buyerReceivingAddress] === undefined) {
              getName(params?.data?.buyerReceivingAddress);

              return params?.data?.buyerReceivingAddress;
            } else {
              return params?.data?.buyerReceivingAddress;
            }
          }
        },
      },
      {
        headerName: "Seller",
        field: "sellerAddress",
        flex: 1, // Flex makes this column responsive
        minWidth: 200, // Ensure it doesn't shrink too much
        resizable: true,
        valueGetter: (params) => {
          if (params?.data?.sellerAddress) {
            if (qortalNames[params?.data?.sellerAddress]) {
              return qortalNames[params?.data?.sellerAddress];
            } else if (qortalNames[params?.data?.sellerAddress] === undefined) {
              getName(params?.data?.sellerAddress);

              return params?.data?.sellerAddress;
            } else {
              return params?.data?.sellerAddress;
            }
          }
        },
      },
    ];
    
  }, [selectedCoin, qortalNames, getCoinLabel])



  // const onSelectionChanged = (event: any) => {
  //   const selectedRows = event.api.getSelectedRows();
  //   if(selectedRows[0]){
  //     setSelectedTrade(selectedRows[0])
  //   } else {
  //     setSelectedTrade(null)
  //   }
  // };







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
          rowData={historyList}
          // onRowClicked={onRowClicked}
          // onSelectionChanged={onSelectionChanged}
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
      </div>
    </div>
  );
}
