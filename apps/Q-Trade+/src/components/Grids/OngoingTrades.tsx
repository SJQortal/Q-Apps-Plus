import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, RowClassParams, RowStyle, SizeColumnsToContentStrategy } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import gameContext from '../../contexts/gameContext';

const autoSizeStrategy: SizeColumnsToContentStrategy = {
    type: 'fitCellContents'
};

export const OngoingTrades = () => {
    const { onGoingTrades, getCoinLabel, selectedCoin } = useContext(gameContext);
    const gridRef = useRef<any>(null)

    const filteredOngoingTrades = useMemo(()=> {
        return onGoingTrades?.filter((item)=> item?.tradeInfo?.foreignBlockchain === selectedCoin)
      }, [onGoingTrades, selectedCoin])
  
    const onGridReady = useCallback((params: any) => {
        // params.api.sizeColumnsToFit(); // Adjust columns to fit the grid width
        // const allColumnIds = params.columnApi.getAllColumns().map((col: any) => col.getColId());
        // params.columnApi.autoSizeColumns(allColumnIds); // Automatically adjust the width to fit content
      }, []);
     
    const defaultColDef = {
        resizable: true, // Make columns resizable by default
        sortable: true, // Make columns sortable by default
        suppressMovable: true, // Prevent columns from being movable
      };

    const columnDefs: ColDef[] = [
        {
            headerName: "Status", valueGetter: (params) => {
                if (params.data.tradeInfo.mode !== 'OFFERING') {
                    if (params.data.tradeInfo.mode === 'TRADING') return 'Trading'
                    if (params.data.tradeInfo.mode === 'REDEEMED') return 'Completed'
                    return params.data.tradeInfo.mode.toLowerCase()
                }
                if (params.data.status === 'message-sent') return 'Requested'
                if (params.data.status === 'trade-ongoing') return 'Submitted'
                if (params.data.status === 'trade-failed') return 'Failed'
                return params.data.status
            },
            resizable: true ,
            flex: 1, minWidth: 100
        },
        { headerName: "Amount (QORT)", valueGetter: (params) => +params.data.tradeInfo.qortAmount, resizable: true, flex: 1, minWidth: 150  },
        { headerName: `${getCoinLabel()}/QORT`, valueGetter: (params) => +params.data.tradeInfo.expectedForeignAmount / +params.data.tradeInfo.qortAmount , resizable: true , flex: 1, minWidth: 150},
        { headerName: `Total ${getCoinLabel()} Value`, valueGetter: (params) => +params.data.tradeInfo.expectedForeignAmount, resizable: true , flex: 1, minWidth: 150, 
    },
        {
            headerName: "Notes",  valueGetter: (params) => {
                if (params.data.tradeInfo.mode === 'TRADING') {
                    return 'The order is in the process of exchanging hands. This does not necessary mean it was purchased by your account. Wait until the process is completed.'
                }
                if (params.data.tradeInfo.mode === 'REDEEMED') {
                    return "You have successfully purchased this order. Please wait for the QORT balance to be updated"
                }
                if (params.data.status === 'message-sent') {
                    return 'Buy request was sent, waiting for trade confirmation.'
                }
                if (params?.data?.message?.toLowerCase() === 'invalid search criteria') {
                    return 'Order(s) already taken';
                  }
                  
                if (params.data.message) return params.data.message
            }, resizable: true, flex: 1, minWidth:300,     autoHeight: true,    cellStyle: { whiteSpace: 'normal', wordBreak: 'break-word', padding: '5px' },
        }
    ];

    // const getRowStyle = (params: any) => {
    //     if (params.data.qortalAtAddress === selectedOffer?.qortalAtAddress) {
    //       return { background: 'lightblue' };
    //     }
    //     return null;
    //   };
    const getRowId = useCallback(function (params: any) {
        return String(params.data?.qortalAtAddress);
    }, []);

 

    return (
        <div className="ag-theme-alpine-dark" style={{ height: 225, width: '100%', display: filteredOngoingTrades?.length === 0 && 'none' }}>
            <AgGridReact
                    onGridReady={onGridReady}
                    ref={gridRef}

                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowData={filteredOngoingTrades}
                // onRowClicked={onRowClicked}
                rowSelection="single"
                getRowId={getRowId}
                autoSizeStrategy={autoSizeStrategy}
                suppressHorizontalScroll={false} // Allow horizontal scroll on mobile if needed
                suppressCellFocus={true} // Prevents cells from stealing focus in mobile
                // pagination={true}
        // paginationPageSize={10}
        // domLayout='autoHeight'

            // getRowStyle={getRowStyle}
            
            />
        </div>
    );
}
