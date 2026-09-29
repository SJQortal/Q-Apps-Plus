import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import {
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  TextFieldProps,
} from "@mui/material";
import React, { useRef, useState } from "react";
import { supportedCoins } from "../constants/PublishFees/FeeData.tsx";

type eventType = React.ChangeEvent<HTMLInputElement>;
type StateTextFieldProps = {
  onChange?: (s: string) => void;
  initialValue?: string;
  options?: string[];
} & TextFieldProps;

export const StateTextField = ({
  initialValue,
  options,
  ...props
}: StateTextFieldProps) => {
  const { onChange, slotProps, ...noChangeProps } = { ...props };
  const inputSlotProps =
    typeof slotProps?.input === "object" ? slotProps.input : {};

  const [textFieldValue, setTextFieldValue] = useState<string>(
    initialValue || ""
  );
  const ref = useRef<HTMLInputElement | null>(null);

  const stringIsEmpty = (value: string) => {
    return value === "";
  };

  const listeners = (e: eventType) => {
    const newValue = e.target.value;
    setTextFieldValue(newValue);
    if (onChange) onChange(newValue);
  };

  return (
    <TextField
      {...noChangeProps}
      onChange={e => listeners(e as eventType)}
      autoComplete="off"
      value={textFieldValue}
      inputRef={ref}
      slotProps={{
        ...slotProps,
        input: {
          ...inputSlotProps,
        },
      }}
    >
      {options &&
        props?.select &&
        options.map((option, index) => (
          <MenuItem value={option} key={option + index}>
            {option}
          </MenuItem>
        ))}
    </TextField>
  );
};

export default StateTextField;
