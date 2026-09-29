import { IconButton, InputAdornment, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import React, { useImperativeHandle, useState } from "react";

export enum Variant {
  filled = "filled",
  standard = "standard",
  outlined = "outlined"
}
interface TextFieldProps {
  name: string;
  label: string;
  required: boolean;
  minValue: number;
  maxValue: number;
  variant?: Variant;
  addIconButtons?: boolean;
  allowDecimals?: boolean;
  onChangeFunc?: (e: string) => void;
  initialValue?: string;
  style?: object;
  className?: string;
}

export type NumericTextFieldRef = {
  getTextFieldValue: () => string;
};

export const NumericTextFieldQshop = React.forwardRef<
  NumericTextFieldRef,
  TextFieldProps
>(
  (
    {
      name,
      label,
      variant,
      required,
      style,
      minValue,
      maxValue,
      addIconButtons = true,
      allowDecimals = true,
      onChangeFunc,
      initialValue,
      className
    }: TextFieldProps,
    ref
  ) => {
    const [textFieldValue, setTextFieldValue] = useState<string>(
      initialValue || ""
    );
    useImperativeHandle(
      ref,
      () => ({
        getTextFieldValue: () => {
          return textFieldValue;
        }
      }),
      [textFieldValue]
    );

    const setMinMaxValue = (value: string): string => {
      const lastIndexIsDecimal = value.charAt(value.length - 1) === ".";
      if (lastIndexIsDecimal) return value;

      const valueNum = Number(value);

      // Bounds checking on valueNum
      let minMaxNum = valueNum;
      minMaxNum = Math.min(minMaxNum, maxValue);
      minMaxNum = Math.max(minMaxNum, minValue);

      return minMaxNum === valueNum ? value : minMaxNum.toString();
    };

    const filterValue = (value: string, emptyReturn = "") => {
      if (allowDecimals === false) value = value.replace(".", "");
      if (value === "-1") return emptyReturn;

      const isPositiveNum = /^[0-9]*\.?[0-9]*$/;

      if (isPositiveNum.test(value)) {
        return setMinMaxValue(value);
      }
      return textFieldValue;
    };

    const changeValueWithButton = (changeAmount: number) => {
      const valueNum = Number(textFieldValue);
      const newValue = setMinMaxValue((valueNum + changeAmount).toString());
      setTextFieldValue(newValue);
    };

    const listeners = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = filterValue(e.target.value || "-1");
      setTextFieldValue(newValue);
      if (onChangeFunc) onChangeFunc(newValue);
    };

    return (
      <TextField
        {...style}
        name={name}
        label={label}
        required={required}
        variant={variant}
        InputProps={
          addIconButtons
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={(e) => changeValueWithButton(1)}>
                      <AddIcon />{" "}
                    </IconButton>
                    <IconButton onClick={(e) => changeValueWithButton(-1)}>
                      <RemoveIcon />{" "}
                    </IconButton>
                  </InputAdornment>
                )
              }
            : {}
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => listeners(e)}
        autoComplete="off"
        value={textFieldValue}
        className={className}
      />
    );
  }
);
