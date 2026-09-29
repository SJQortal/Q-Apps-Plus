import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import React from "react";
import { SxProps } from "@mui/material/styles";
import { FeePrice } from "./FeePricePublish.ts";

export interface DataTableProps {
  columnNames: string[];
  data: FeePrice[];
  sx?: SxProps;
}

export const DataTable = ({ columnNames, data, sx }: DataTableProps) => {
  const boldSX = {
    fontSize: "30px",
    textAlign: "center",
    fontWeight: "bold",
  };
  const cellSX = {
    fontSize: "25px",
    fontWeight: "normal",
    textAlign: "center",
  };

  const formatCell = (s: string, index: number) => {
    if (index === 0) return new Date(s).toDateString();
    else return s;
  };
  return (
    <TableContainer sx={{ ...sx }}>
      <Table align="center" stickyHeader>
        <TableHead>
          <TableRow>
            {columnNames.map((columnName, index) => (
              <TableCell sx={boldSX} key={columnName + index}>
                {columnName}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((tableRow, rowIndex) => {
            return (
              <TableRow key={tableRow.toString() + rowIndex}>
                {<TableCell sx={boldSX}>{rowIndex + 1}</TableCell>}

                {Object.values(tableRow).map((tableCell, cellIndex) => (
                  <TableCell sx={cellSX} key={tableCell + cellIndex}>
                    {formatCell(tableCell, cellIndex)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
