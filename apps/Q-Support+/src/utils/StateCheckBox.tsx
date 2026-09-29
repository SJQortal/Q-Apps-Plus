import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { CheckboxProps, FormControlLabel, Checkbox } from "@mui/material";
import React, { useRef, useState } from "react";
import { supportedCoins } from "../constants/PublishFees/FeeData.tsx";
import StateTextField from "./StateTextField.tsx";

type eventType = React.ChangeEvent<HTMLInputElement>;

type StateCheckBoxProps = {
  onChange?: (b: boolean) => void;
  label?: string;
} & CheckboxProps;

export const StateCheckBox = ({ ...props }: StateCheckBoxProps) => {
  const { onChange, defaultChecked, label, ...noChangeProps } = { ...props };

  const [checkValue, setCheckValue] = useState<boolean>(defaultChecked);
  const ref = useRef<HTMLInputElement | null>(null);

  const stringIsEmpty = (value: string) => {
    return value === "";
  };

  const listeners = (e: eventType) => {
    const newValue = e.target.checked;
    setCheckValue(newValue);
    if (onChange) onChange(newValue);
  };

  return (
    <FormControlLabel
      label={label}
      control={
        <Checkbox
          {...noChangeProps}
          onChange={e => listeners(e as eventType)}
          checked={checkValue}
        />
      }
    />
  );
};

export default StateTextField;
