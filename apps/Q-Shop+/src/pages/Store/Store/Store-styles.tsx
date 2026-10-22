/**
 * Styled parts other screens still import from the original shop page (the
 * cart, the seller tools and the shop dialogs). The shop page itself no
 * longer uses them. Colours come from the theme, so all four themes work.
 */
import { styled } from "@mui/material/styles";
import { Autocomplete, Box, Button, Checkbox, Chip, TextField } from "@mui/material";

interface StoreProps {
  fixedCartPosition: boolean;
}

const notFixedCartProp = (prop: PropertyKey) => prop !== "fixedCartPosition";

export const FiltersCheckbox = styled(Checkbox)(({ theme }) => ({
  color: theme.palette.text.secondary,
  "&.Mui-checked": {
    color: theme.palette.primary.main,
  },
}));

export const FiltersOption = styled("li")(({ theme }) => ({
  fontSize: "17px",
  color: theme.palette.text.primary,
  userSelect: "none",
  paddingTop: "2px !important",
  paddingBottom: "2px !important",
}));

export const FiltersChip = styled(Chip)(({ theme }) => ({
  fontSize: "13px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const FilterSelect = styled(Autocomplete)(({ theme }) => ({
  "& #categories-select": {
    padding: "7px",
  },
  "& [class*='MuiInputBase-root-MuiOutlinedInput-root']": {
    gap: "5px",
  },
  '& [class*="MuiFormLabel-root-MuiInputLabel-root"]': {
    fontSize: "17px",
    color: theme.palette.text.primary,
    userSelect: "none",
    height: "25px",
  },
}));

export const FilterSelectMenuItems = styled(TextField)(({ theme }) => ({
  '& [class*="MuiInputBase-input"]': {
    fontSize: "17px",
    color: theme.palette.text.primary,
    userSelect: "none",
  },
}));

/** A filled button in the theme's primary colour (the original's yellow "Back to all shops"). */
export const BackToStorefrontButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minHeight: 40,
  padding: "3px 12px",
  fontSize: "15px",
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
  border: "none",
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.primary.dark,
  },
  "&.Mui-disabled": {
    color: theme.palette.action.disabled,
    backgroundColor: theme.palette.action.disabledBackground,
  },
}));

export const CartIconContainer = styled(Box, { shouldForwardProp: notFixedCartProp })<StoreProps>(
  ({ theme, fixedCartPosition }) => ({
    position: fixedCartPosition ? "fixed" : "relative",
    top: fixedCartPosition ? "90px" : 0,
    right: fixedCartPosition ? "17px" : 0,
    zIndex: fixedCartPosition ? 55 : 0,
    padding: fixedCartPosition ? "20px" : 0,
    backgroundColor: fixedCartPosition ? theme.palette.background.paper : "transparent",
    borderRadius: fixedCartPosition ? "50%" : 0,
    display: fixedCartPosition ? "flex" : "block",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  })
);

export const NotificationBadge = styled(Box, { shouldForwardProp: notFixedCartProp })<StoreProps>(
  ({ theme, fixedCartPosition }) => ({
    position: "absolute",
    top: fixedCartPosition ? "6px" : "-7px",
    right: fixedCartPosition ? "9px" : "-7px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "22px",
    height: "22px",
    padding: "0 4px",
    borderRadius: "11px",
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontSize: "14px",
    fontWeight: "bold",
    userSelect: "none",
  })
);

export const AcceptedCoinRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "7px",
});

