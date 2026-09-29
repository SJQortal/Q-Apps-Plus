import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import moment from "moment";
import { Order } from "../../../state/features/orderSlice";
import { CircularProgress } from "@mui/material";
import { StyledTableRow } from "./OrderTable-styles";
import { setNotification } from "../../../state/features/notificationsSlice";

const tableCellFontSize = "16px";

interface ColumnData {
  dataKey: keyof Order;
  label: string;
  numeric?: boolean;
  width?: number;
  status?: string;
}
interface SimpleTableProps {
  openOrder: (product: Order) => void;
  data: Order[];
  children?: React.ReactNode;
  from: string;
}

export const OrderTable = ({
  openOrder,
  data,
  from,
  children
}: SimpleTableProps) => {
  const dispatch = useDispatch();

  const hashMapOrders = useSelector(
    (state: RootState) => state.order.hashMapOrders
  );

  const { isLoadingGlobal } = useSelector((state: RootState) => state.global);

  const columns: ColumnData[] = [
    {
      label: from === "ProductManager" ? "Customer Name" : "Shop Name",
      dataKey: from === "ProductManager" ? "user" : "storeName"
    },
    {
      label: "Status",
      dataKey: "status",
      width: 120
    },
    {
      label: "Total",
      dataKey: "totalPrice",
      width: 120
    },
    {
      label: "Created",
      dataKey: "created",
      numeric: true,
      width: 300
    }
  ];

  const processedOrders = data.map((row, index) => {
    let rowData = row;
    if (hashMapOrders[row.id]) {
      rowData = {
        ...row,
        ...hashMapOrders[row.id]
      };
    }
    return { index, rowData };
  });

  function fixedHeaderContent() {
    return (
      <TableRow>
        {columns.map((column) => {
          return (
            <TableCell
              key={column.dataKey}
              variant="head"
              align={column.numeric || false ? "right" : "left"}
              style={{ width: column.width, padding: "15px 20px" }}
              sx={{
                backgroundColor: "background.paper",
                fontSize: tableCellFontSize,
                padding: "7px"
              }}
            >
              {column.label}
            </TableCell>
          );
        })}
      </TableRow>
    );
  }

  function rowContent(_index: number, rowData: Order, openOrder: any) {
    return (
      <React.Fragment>
        {columns.map((column) => {
          return (
            <TableCell
              onClick={() => {
                if (!hashMapOrders[rowData.id]) {
                  dispatch(
                    setNotification({
                      alertType: "error",
                      msg: "Order Data Not Loaded Yet! Please Try Again or Refresh the Page."
                    })
                  );
                  return;
                }
                openOrder(rowData);
              }}
              key={column.dataKey}
              align={column.numeric || false ? "right" : "left"}
              style={{ width: column.width, padding: "15px 20px" }}
              sx={{
                fontSize: tableCellFontSize,
                padding: "7px"
              }}
            >
              <>
                {column.dataKey === "created"
                  ? moment(rowData[column.dataKey]).format("llll")
                  : column.dataKey === "totalPrice"
                  ? rowData[column.dataKey]
                  : rowData[column.dataKey]}
              </>
            </TableCell>
          );
        })}
      </React.Fragment>
    );
  }

  if (isLoadingGlobal) return <CircularProgress />;

  return (
    <Paper style={{ width: "100%" }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>{fixedHeaderContent()}</TableHead>
          <TableBody>
            {processedOrders.length > 0 ? (
              processedOrders.map(({ index, rowData }) => (
                <StyledTableRow key={index}>
                  {rowContent(index, rowData, openOrder)}
                </StyledTableRow>
              ))
            ) : (
              <StyledTableRow>
                <TableCell
                  colSpan={columns.length}
                  sx={{
                    fontSize: tableCellFontSize,
                    padding: "7px"
                  }}
                >
                  You currently have no orders!
                </TableCell>
              </StyledTableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {children}
    </Paper>
  );
};
