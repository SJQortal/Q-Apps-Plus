import {
  IconButton,
  InputAdornment,
  TextField,
  TextFieldProps,
} from "@mui/material";
import React, { useRef, useState } from "react";
import {
  isAllZerosNum,
  isFloatNum,
  isIntegerNum,
  removeTrailingZeros,
  setNumberWithinBounds,
  sigDigitsExceeded,
  stringIsEmpty,
} from "qortal-app-utils";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

type eventType = React.ChangeEvent<HTMLInputElement>;
type BoundedNumericTextFieldProps = {
  minValue: number;
  maxValue: number;
  addIconButtons?: boolean;
  allowDecimals?: boolean;
  allowNegatives?: boolean;
  onChange?: (s: string) => void;
  initialValue?: string;
  maxSigDigits?: number;
} & TextFieldProps;

export const BoundedNumericTextField = ({
  minValue,
  maxValue,
  addIconButtons = true,
  allowDecimals = true,
  allowNegatives = false,
  initialValue,
  maxSigDigits = 6,
  ...props
}: BoundedNumericTextFieldProps) => {
  const [textFieldValue, setTextFieldValue] = useState<string>(
    initialValue || ""
  );
  const ref = useRef<HTMLInputElement | null>(null);

  const skipMinMaxCheck = (value: string) => {
    const lastIndexIsDecimal = value.charAt(value.length - 1) === ".";
    const isEmpty = stringIsEmpty(value);
    const isAllZeros = isAllZerosNum.test(value);
    const isInteger = isIntegerNum.test(value);
    // skipping minMax on all 0s allows values less than 1 to be entered

    return lastIndexIsDecimal || isEmpty || (isAllZeros && !isInteger);
  };

  const setMinMaxValue = (value: string): string => {
    if (skipMinMaxCheck(value)) return value;
    const valueNum = Number(value);

    const boundedNum = setNumberWithinBounds(valueNum, minValue, maxValue);

    const numberInBounds = boundedNum === valueNum;
    return numberInBounds ? value : boundedNum.toString();
  };

  const filterTypes = (value: string) => {
    if (allowDecimals === false) value = value.replace(".", "");
    if (allowNegatives === false) value = value.replace("-", "");
    if (sigDigitsExceeded(value, maxSigDigits)) {
      value = value.substring(0, value.length - 1);
    }
    return value;
  };
  const filterValue = (value: string) => {
    if (stringIsEmpty(value)) return "";
    value = filterTypes(value);
    if (isFloatNum.test(value)) {
      return setMinMaxValue(value);
    }
    return textFieldValue;
  };

  const listeners = (e: eventType) => {
    // console.log("changeEvent:", e);
    const newValue = filterValue(e.target.value);
    setTextFieldValue(newValue);
    if (props?.onChange) props.onChange(newValue);
  };

  const changeValueWithIncDecButton = (e, changeAmount: number) => {
    const changedValue = (+textFieldValue + changeAmount).toString();
    const inBoundsValue = setMinMaxValue(changedValue);
    setTextFieldValue(inBoundsValue);
    if (props?.onChange) props.onChange(inBoundsValue);
  };

  const formatValueOnBlur = (e: eventType) => {
    let value = e.target.value;
    if (stringIsEmpty(value) || value === ".") {
      setTextFieldValue("");
      return;
    }

    value = setMinMaxValue(value);
    value = removeTrailingZeros(value);
    if (isAllZerosNum.test(value)) value = minValue.toString();

    setTextFieldValue(value);
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onChange, ...noChangeProps } = { ...props };
  return (
    <TextField
      {...noChangeProps}
      InputProps={{
        ...props?.InputProps,
        endAdornment: addIconButtons ? (
          <InputAdornment position="end">
            <IconButton onClick={e => changeValueWithIncDecButton(e, 1)}>
              <AddIcon />{" "}
            </IconButton>
            <IconButton onClick={e => changeValueWithIncDecButton(e, -1)}>
              <RemoveIcon />{" "}
            </IconButton>
          </InputAdornment>
        ) : (
          <></>
        ),
      }}
      onChange={e => listeners(e as eventType)}
      onBlur={e => {
        formatValueOnBlur(e as eventType);
      }}
      autoComplete="off"
      value={textFieldValue}
      inputRef={ref}
    />
  );
};

export default BoundedNumericTextField;
