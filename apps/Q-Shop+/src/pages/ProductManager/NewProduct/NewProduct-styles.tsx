/**
 * Select parts from the original's product form, still used by the cart and
 * the order dialog. Colours come from the theme.
 */
import { styled } from "@mui/material/styles";
import { InputLabel, Select, MenuItem } from "@mui/material";

export const InputFieldCustomLabel = styled(InputLabel)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: "18px",
  transformOrigin: "top center",
  letterSpacing: 0,
  "&.Mui-focused": {
    color: theme.palette.primary.main,
  },
}));

export const CustomSelect = styled(Select)(({ theme }) => ({
  fontSize: "17.5px",
  letterSpacing: 0,
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.primary.main,
  },
}));

export const CustomMenuItem = styled(MenuItem)(() => ({
  letterSpacing: 0,
  fontSize: "18px",
  minHeight: 44,
}));
