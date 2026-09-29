import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from "@mui/material";
import { forwardRef } from "react";
import { TableVirtuoso, TableComponents } from "react-virtuoso";
import {
  dismissToast,
  showError,
  showLoading,
  showSuccess,
  useGlobal,
} from "qapp-core";
import { formatTimestampForum } from "../../utils/formatTime";

interface AtData {
  qortAmount:  number;
  foreignBlockchain: string;
  foreignAmount: number;
  qortalAtAddress: string;
  timestamp?: number
  creationTimestamp?: number
}

const VirtuosoTableComponents: TableComponents<AtData> = {
  Scroller: forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer component={Paper} {...props} ref={ref} />
  )),
  Table: (props) => (
    <Table
      {...props}
      sx={{ borderCollapse: "separate", tableLayout: "fixed" }}
    />
  ),
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableHead {...props} ref={ref} />
  )),
  TableRow,
  TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableBody {...props} ref={ref} />
  )),
};

function fixedHeaderContent() {
  return (
    <TableRow sx={{ backgroundColor: "background.paper" }}>
      <TableCell>Date</TableCell>
      <TableCell>Amount (QORT)</TableCell>
      <TableCell>Actions</TableCell>
    </TableRow>
  );
}

function rowContent(_index: number, row: AtData) {
  const cancelSell = async () => {
    const loadId = showLoading("Attempting to cancel sell...please wait");

    try {
      const res = await qortalRequestWithTimeout(
        {
          action: "CANCEL_TRADE_SELL_ORDER",
          qortAmount: row.qortAmount,
          foreignBlockchain: row.foreignBlockchain,
          foreignAmount: row.foreignAmount,
          atAddress: row.qortalAtAddress,
        },
        900000
      );
      if (res?.signature) {
        showSuccess(
          "Canceled sell order. It might take awhile for the cancel sell order changes to show up."
        );
      }
    } catch (error) {
      showError(error?.message || "Unable to cancel sell order");

      console.log("error", error);
    } finally {
      dismissToast(loadId);
    }
  };

  return (
    <>
      <TableCell>{formatTimestampForum(row?.timestamp || row?.creationTimestamp)}</TableCell>
      <TableCell>{row?.qortAmount}</TableCell>
      <TableCell>
        <Button
          variant="contained"
          size="small"
          onClick={() => cancelSell()}
        >
          Cancel sell
        </Button>
      </TableCell>
    </>
  );
}

export const StuckOrdersTable = ({ data }) => {
  return (
    <Paper
      sx={{
        height: "80vh", // Header + footer height
        width: "100%",
      }}
    >
      <TableVirtuoso
        data={data}
        components={VirtuosoTableComponents}
        fixedHeaderContent={fixedHeaderContent}
        itemContent={(index, row) => rowContent(index, row)}
      />
    </Paper>
  );
};
