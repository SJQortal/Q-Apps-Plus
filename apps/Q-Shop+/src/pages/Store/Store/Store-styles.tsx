import { styled } from "@mui/system";
import {
  Box,
  Button,
  Typography,
  Grid,
  Checkbox,
  InputLabel,
  Autocomplete,
  TextField,
  Chip,
} from "@mui/material";
import { ReusableModal } from "../../../components/modals/ReusableModal";

interface StoreProps {
  fixedCartPosition: boolean;
}

export const FiltersCol = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  padding: "20px 15px",
  backgroundColor: theme.palette.background.default,
  borderTop: `1px solid ${theme.palette.background.paper}`,
  borderRight: `1px solid ${theme.palette.background.paper}`,
}));

export const FiltersContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
}));

export const FiltersRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "0 15px",
  fontSize: "16px",
  userSelect: "none",
}));

export const FiltersTitle = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  margin: "20px 0",
  fontFamily: "Raleway",
  fontSize: "17px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const FiltersCheckbox = styled(Checkbox)(({ theme }) => ({
  color: "#c0d4ff",
  "&.Mui-checked": {
    color: "#6596ff",
  },
}));

export const FiltersOption = styled("li")(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "17px",
  color: theme.palette.text.primary,
  userSelect: "none",
  paddingTop: "2px !important",
  paddingBottom: "2px !important",
}));

export const FiltersChip = styled(Chip)(({ theme }) => ({
  fontFamily: "Raleway",
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
    fontFamily: "Raleway",
    fontSize: "17px",
    color: theme.palette.text.primary,
    userSelect: "none",
    height: "25px",
  },
}));

export const FilterSelectMenuItems = styled(TextField)(({ theme }) => ({
  '& [class*="MuiInputBase-input"]': {
    fontFamily: "Raleway",
    fontSize: "17px",
    color: theme.palette.text.primary,
    userSelect: "none",
  },
}));

export const ProductManagerRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  justifyContent: "flex-end",
  width: "100%",
  padding: "15px 18px",
}));

export const StoreTitleCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifySelf: "center",
  width: "fit-content",
  borderRadius: "8px",
  padding: "10px 15px",
  backgroundColor: theme.palette.background.paper,
  gap: "10px",
  transition: "all 0.3s ease-in-out",
}));

export const StoreTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "20px",
  color: theme.palette.text.primary,
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    textDecoration: "underline",
  },
}));

export const StoreLogo = styled("img")(({ theme }) => ({
  width: "70px",
  height: "70px",
  borderRadius: "3px",
  objectFit: "cover",
}));

export const FiltersSubContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  gap: "5px",
}));

export const FilterDropdownLabel = styled(InputLabel)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "16px",
  color: theme.palette.text.primary,
}));

export const StoreControlsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

export const EditStoreButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "3px 12px",
  fontFamily: "Raleway",
  fontSize: "15px",
  color: "#ffffff",
  backgroundColor: "#D4417E",
  border: "none",
  borderRadius: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#a13562",
  },
}));

export const ProductManagerButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "3px 12px",
  fontFamily: "Raleway",
  fontSize: "15px",
  color: "#ffffff",
  backgroundColor: theme.palette.secondary.main,
  border: "none",
  borderRadius: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.secondary.dark,
  },
}));

export const BackToStorefrontButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "3px 12px",
  fontFamily: "Raleway",
  fontSize: "15px",
  color: "#ffffff",
  backgroundColor: theme.palette.mode === "dark" ? "#bdba02" : "#e1dd04",
  border: "none",
  borderRadius: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.mode === "dark" ? "#a5a201" : "#c7c402",
  },
}));

export const ProductsContainer = styled(Grid)({
  display: "flex",
  flexWrap: "wrap",
  padding: "5px 35px 15px 35px",
});

export const NoProductsContainer = styled(Box)({
  textAlign: "center",
  width: "100%",
  marginTop: "70px",
});

export const NoProductsText = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans",
  fontSize: "24px",
  letterSpacing: "0.7px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const CartIconContainer = styled(Box)<StoreProps>(
  ({ theme, fixedCartPosition }) => ({
    position: fixedCartPosition ? "fixed" : "relative",
    top: fixedCartPosition ? "90px" : 0,
    right: fixedCartPosition ? "17px" : 0,
    zIndex: fixedCartPosition ? "55" : 0,
    padding: fixedCartPosition ? "20px" : 0,
    backgroundColor: fixedCartPosition
      ? `${theme.palette.background.paper}`
      : "none",
    borderRadius: fixedCartPosition ? "50%" : 0,
    display: fixedCartPosition ? "flex" : "block",
    alignItems: fixedCartPosition ? "center" : "center",
    justifyContent: fixedCartPosition ? "center" : "center",
    cursor: "pointer",
  })
);

export const NotificationBadge = styled(Box)<StoreProps>(
  ({ theme, fixedCartPosition }) => ({
    position: "absolute",
    top: fixedCartPosition ? "6px" : "-7px",
    right: fixedCartPosition ? "9px" : "-7px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    backgroundColor: theme.palette.mode === "dark" ? "#bdba02" : "#e1dd04",
    color: "#000000",
    fontFamily: "Karla",
    fontSize: "14px",
    fontWeight: "bold",
    userSelect: "none",
  })
);

export const ProductCardCol = styled(Grid)(({ theme }) => ({
  display: "flex",
  gap: 1,
  alignItems: "center",
  width: "auto",
  position: "relative",
  maxWidth: "100%",
  flexGrow: 1,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}));

export const StoreTitleCol = styled(Box)({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
});

export const RatingContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "1px 5px",
  borderRadius: "5px",
  fontFamily: "Karla",
  letterSpacing: 0,
  fontWeight: 300,
  fontSize: "21px",
  backgroundColor: "transparent",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#e4ddddac",
  },
}));

export const ReusableModalStyled = styled(ReusableModal)(({ theme }) => ({
  "&#store-details": {
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-track:hover": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar": {
      width: "8px",
      height: "10px",
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#414763",
      borderRadius: "8px",
      backgroundClip: "content-box",
      border: "4px solid transparent",
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#40455f",
    },
  },
}));

export const OfferedCoinsRow = styled(Box)(() => ({
  fontSize: "21px",
  display: "flex",
  alignItems: "center",
  marginTop: "5px",
  gap: "7px",
  fontFamily: "Karla",
  letterSpacing: 0,
  fontWeight: 300,
  userSelect: "none",
}));

export const AcceptedCoinRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "7px",
});
