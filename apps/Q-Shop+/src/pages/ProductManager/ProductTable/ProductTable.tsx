import React, { useState, useEffect } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { Avatar, CircularProgress } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import { Product } from "../../../state/features/storeSlice";
import moment from "moment";
import { StyledTableRow } from "./ProductTable-styles";
import { setNotification } from "../../../state/features/notificationsSlice";

const tableCellFontSize = "16px";

interface Data {
  title: string;
  description: string;
  created: number;
  user: string;
  id: string;
  tags: string[];
  status: string;
}

interface ColumnData {
  dataKey: keyof Data;
  label: string;
  numeric?: boolean;
  width?: number;
}

const columns: ColumnData[] = [
  {
    label: "Title",
    dataKey: "title" // Obtained from the catalogueHashMap
  },
  {
    label: "Status",
    dataKey: "status",
    width: 120
  },
  {
    label: "Created",
    dataKey: "created",
    numeric: true,
    width: 300
  }
];

interface SimpleTableProps {
  openProduct: (product: Product) => void;
  data: Product[];
  children?: React.ReactNode;
}

export const SimpleTable = ({
  openProduct,
  data,
  children
}: SimpleTableProps) => {
  const dispatch = useDispatch();

  const catalogueHashMap = useSelector(
    (state: RootState) => state.global.catalogueHashMap
  );
  const { isLoadingGlobal } = useSelector((state: RootState) => state.global);

  // Rest of the product data for editProduct, as what comes from the ProductManager only contains id, status, created, user & catalogueId
  const processedData = data.map((row, index) => {
    let rowData = row;

    if (
      catalogueHashMap[row?.catalogueId] &&
      catalogueHashMap[row.catalogueId].products[row?.id]
    ) {
      rowData = {
        ...row,
        ...catalogueHashMap[row?.catalogueId].products[row?.id],
        catalogueId: row?.catalogueId || ""
      };
    }

    return { index, rowData };
  });

  function rowContent(_index: number, rowData: Product, openProduct: any) {
    return (
      <>
        {columns.map((column) => {
          return (
            <TableCell
              onClick={() => {
                if (!catalogueHashMap[rowData.catalogueId]) {
                  dispatch(
                    setNotification({
                      alertType: "error",
                      msg: "Product Data Not Loaded Yet! Please Try Again or Refresh the Page."
                    })
                  );
                  return;
                }
                openProduct(rowData);
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
                  : column.dataKey === "status"
                  ? rowData[column.dataKey] === "OUT_OF_STOCK"
                    ? "OUT OF STOCK"
                    : rowData[column.dataKey] || "unknown"
                  : rowData[column.dataKey]}
              </>
            </TableCell>
          );
        })}
      </>
    );
  }

  function fixedHeaderContent() {
    return (
      <TableRow>
        {columns.map((column) => {
          const { label } = column;
          return (
            <TableCell
              key={column.dataKey}
              variant="head"
              align={column.numeric || false ? "right" : "left"}
              style={{ width: column.width, padding: "15px 20px" }}
              sx={{
                backgroundColor: "background.paper",
                fontSize: tableCellFontSize,
                padding:
                  label === "Title" || label === "Created" ? "7px 35px" : "7px"
              }}
            >
              {column.label}
            </TableCell>
          );
        })}
      </TableRow>
    );
  }

  if (isLoadingGlobal) return <CircularProgress />;

  return (
    <Paper style={{ width: "100%" }}>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>{fixedHeaderContent()}</TableHead>
          <TableBody>
            {processedData
              .sort((a, b) => a.rowData.created - b.rowData.created)
              .map(({ index, rowData }) => (
                <StyledTableRow key={index}>
                  {rowContent(index, rowData, openProduct)}
                </StyledTableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {children}
    </Paper>
  );
};
