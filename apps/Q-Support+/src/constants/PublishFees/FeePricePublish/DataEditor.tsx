import {
  Box,
  Button,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { key } from "localforage";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { s } from "vite/dist/node/types.d-aGj9QkWt";
import { ThemeButton } from "../../../pages/Home/Home-styles.tsx";
import { setNotification } from "../../../state/features/notificationsSlice.ts";
import BoundedNumericTextField from "../../../utils/BoundedNumericTextField.tsx";
import {
  objectToBase64,
  objectToFile,
} from "../../../utils/PublishFormatter.ts";
import StateTextField from "../../../utils/StateTextField.tsx";
import { objectIndexToKey } from "../../../utils/utilFunctions.ts";
import { appName, FEE_BASE, supportedCoins } from "../FeeData.tsx";
import { DataTableProps } from "./DataTable.tsx";
import { CoinType, FeePrice, feesPublishService } from "./FeePricePublish.ts";

export const DataEditor = ({ columnNames, data, sx }: DataTableProps) => {
  const [editedData, setEditedData] = useState<FeePrice[]>(data);

  const addRow = () => {
    setEditedData(editedData => [
      ...editedData,
      {
        time: undefined,
        feeAmount: undefined,
        feeType: undefined,
        coinType: undefined,
      },
    ]);
  };

  const removeRow = () => {
    setEditedData(editedData => editedData.slice(0, -1));
  };

  const dispatch = useDispatch();

  const updateData = (
    value: string | number,
    rowIndex: number,
    cellIndex: number
  ) => {
    const rowData = editedData[rowIndex];

    const key = objectIndexToKey(rowData, cellIndex);

    const newData: FeePrice[] = editedData.map((row, rIndex) => {
      return rIndex === rowIndex
        ? { ...row, [key]: value || undefined }
        : { ...row };
    });
    setEditedData(newData);
  };

  useEffect(() => {
    console.log("editedData is: ", editedData);
  }, [editedData]);

  const getCellForm = (rowIndex: number, cellIndex: number) => {
    const rowData = editedData[rowIndex];

    const key = objectIndexToKey(rowData, cellIndex);
    const value = rowData[key]?.toString();

    const feeAmount = (
      <BoundedNumericTextField
        variant={"standard"}
        value={value}
        initialValue={value || ""}
        addIconButtons={false}
        sx={{ width: "60%" }}
        onBlur={s => {
          updateData(+s, rowIndex, cellIndex);
        }}
      />
    );

    const feeType = (
      <StateTextField
        variant={"standard"}
        value={value}
        initialValue={value || ""}
        sx={{ width: "55%" }}
        onBlur={e => {
          updateData(e.target.value, rowIndex, cellIndex);
        }}
      />
    );

    const coinTypeAC = (
      <StateTextField
        variant={"outlined"}
        select
        fullWidth
        value={value}
        initialValue={value || undefined}
        onBlur={e =>
          updateData(e.target.value as CoinType, rowIndex, cellIndex)
        }
        sx={{
          width: "100%",
        }}
        options={supportedCoins}
      ></StateTextField>
    );
    switch (cellIndex) {
      case 0:
        return value ? new Date(+value).toDateString() : "";
      case 1:
        return feeAmount;
      case 2:
        return feeType;
      case 3:
        return coinTypeAC;
    }
  };

  const isValidPublish = (publishData: FeePrice[]) => {
    return publishData.every(value => {
      return Object.values(value).every(value => !!value);
    });
  };

  const publish = async (feeData: FeePrice[]) => {
    qortalRequest({
      action: "PUBLISH_QDN_RESOURCE",
      name: appName,
      identifier: FEE_BASE,
      service: feesPublishService,
      data64: await objectToBase64(feeData),
    }).then(response => {
      dispatch(
        setNotification({
          msg: "Issue published",
          alertType: "success",
        })
      );
      setEditedData(feeData);
    });
  };
  const publishFeeData = () => {
    const dataLength = editedData.length - 1;

    const dateEmpty = !editedData[dataLength]?.time;
    const dataWithDate: FeePrice[] = editedData.map((row, rIndex) => {
      return rIndex === dataLength && dateEmpty
        ? { ...row, time: Date.now() }
        : { ...row };
    });

    if (isValidPublish(dataWithDate)) publish(dataWithDate);
    else {
      const notificationObj = {
        msg: "Publish Fee Data is not Valid",
        alertType: "error",
      };
      dispatch(setNotification(notificationObj));
    }
  };

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

  const AddRemoveRowButtonSX = {
    color: "text.primary",
    fontSize: "20px",
    fontWeight: "bold",
    width: "30%",
  };

  return (
    <>
      <TableContainer sx={{ width: "100%", ...sx }}>
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
            {editedData.map((tableRow, rowIndex) => {
              return (
                <TableRow key={tableRow.toString() + rowIndex}>
                  {<TableCell sx={boldSX}>{rowIndex + 1}</TableCell>}

                  {Object.values(tableRow).map((tableCell, cellIndex) => (
                    <TableCell sx={cellSX} key={rowIndex + cellIndex}>
                      {getCellForm(rowIndex, cellIndex)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          justifyContent: "center",
          gap: "5%",
        }}
      >
        <Button
          sx={AddRemoveRowButtonSX}
          variant={"contained"}
          color={"success"}
          onClick={addRow}
        >
          Add Row
        </Button>
        <Button
          sx={AddRemoveRowButtonSX}
          variant={"contained"}
          color={"error"}
          onClick={removeRow}
        >
          Remove Row
        </Button>
      </Box>
      <ThemeButton
        sx={{
          fontSize: "20px",
          fontWeight: "bold",
        }}
        onClick={publishFeeData}
      >
        Publish
      </ThemeButton>
    </>
  );
};
