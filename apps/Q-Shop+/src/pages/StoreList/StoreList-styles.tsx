import { styled } from "@mui/system";

interface StoreListProps {
  showCompleteStoreDescription?: boolean;
}

import {
  Box,
  Grid,
  Typography,
  Checkbox,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DoubleArrowDownSVG } from "../../assets/svgs/DoubleArrowDownSVG";

export const StoresContainer = styled(Grid)(({ theme }) => ({
  position: "relative",
  padding: "10px 55px 30px 55px",
  flexDirection: "column",
}));

export const WelcomeRow = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  gap: "10px",
  padding: "0 15px 45px 0px",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
  },
}));

export const WelcomeFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Cairo",
  fontSize: "40px",
  userSelect: "none",
  color: theme.palette.text.primary,
}));

export const WelcomeSubFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "24px",
  userSelect: "none",
  color: theme.palette.text.primary,
  opacity: 0.8,
}));

export const WelcomeCol = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}));

export const StoresRow = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "auto",
  position: "relative",
  "@media (max-width: 450px)": {
    width: "100%",
  },
}));

export const StyledStoreCard = styled(Grid)<StoreListProps>(
  ({ theme, showCompleteStoreDescription }) => ({
    boxSizing: "border-box",
    position: "relative",
    display: "flex",
    flexFlow: "column",
    width: "fit-content",
    minWidth: "100%",
    maxWidth: "100%",
    height: "100%",
    maxHeight: showCompleteStoreDescription ? "100%" : "500px",
    backgroundColor: "transparent",
    borderRadius: "8px",
    paddingBottom: "60px",
    justifyContent: "space-between",
    border:
      theme.palette.mode === "dark"
        ? "1px solid #e2e2e20d"
        : "1px solid #1b1a1a14",
    transition: "all 0.3s ease-in-out 0s",
    "&:hover": {
      cursor: "pointer",
      boxShadow:
        theme.palette.mode === "dark"
          ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
          : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
      "& div div": {
        visibility: "visible",
      },
    },
  })
);

export const StoreCardInfo = styled(Grid)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  padding: "0 20px 10px 15px",
}));

export const StoreCardImageContainer = styled(Box)(({ theme }) => ({}));

export const OpenStoreCard = styled(Box)(({ theme }) => ({
  position: "absolute",
  visibility: "hidden",
  top: "5px",
  right: "10px",
  backgroundColor: theme.palette.mode === "dark" ? "#aaa1a1e8" : "#f0f0f0",
  color: theme.palette.text.primary,
  fontSize: "18px",
  fontFamily: "Karla",
  letterSpacing: "0px",
  fontWeight: 400,
  padding: "2px 8px",
  userSelect: "none",
  borderRadius: "20px",
  transition: "all 0.2s ease-in",
}));

export const StoreCardImage = styled("img")(({ theme }) => ({
  width: "100%",
  objectFit: "contain",
  maxHeight: "250px",
  height: "250px",
  borderRadius: "10px",
}));

export const StoreCardTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans, sans-serif",
  fontWeight: 400,
  fontSize: "24px",
  letterSpacing: "0.4px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const StoreCardDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "20px",
  fontWeight: 300,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  userSelect: "none",
  overflowY: "auto",
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
}));

export const AcceptedCoinsRow = styled(Grid)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "5px",
  width: "100%",
  position: "absolute",
  bottom: "5px",
  left: "10px",
});

export const AcceptedCoin = styled("img")({
  width: "30px",
  height: "30px",
  objectFit: "contain",
  userSelect: "none",
});

export const StoreCardOwner = styled(Typography)(({ theme }) => ({
  fontFamily: "Livvic",
  color: theme.palette.text.primary,
  fontSize: "15px",
  position: "absolute",
  bottom: "5px",
  right: "10px",
  maxWidth: "180px",
  userSelect: "none",
}));

export const StyledTooltip = styled(Tooltip)(({ theme }) => ({
  "& .MuiTooltip-tooltip": {
    fontFamily: "Karla",
    fontSize: "15px",
    letterSpacing: "0px",
    fontWeight: 300,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    zIndex: 10,
  },
}));

export const YouOwnIcon = styled(IconButton)(({ theme }) => ({
  height: "40px",
  width: "40px",
  position: "absolute",
  bottom: "70px",
  right: "0px",
  backgroundColor: "transparent",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.08);"
        : "rgba(255, 255, 255, 0.06);",
  },
}));

export const MyStoresRow = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  width: "100%",
}));

export const MyStoresCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  WebkitBoxAlign: "center",
  alignItems: "center",
  width: "auto",
  borderRadius: "4px",
  backgroundColor: theme.palette.background.paper,
  padding: "6px 10px",
  fontFamily: "Raleway",
  fontSize: "15px",
  color: theme.palette.text.primary,
  userSelect: "none",
  gap: "8px",
}));

export const MyStoresCheckbox = styled(Checkbox)(({ theme }) => ({
  color: "#c0d4ff",
  padding: 0,
  "&.Mui-checked": {
    color: "#6596ff",
  },
}));

export const ExpandDescriptionIcon = styled(DoubleArrowDownSVG)<StoreListProps>(
  ({ theme, showCompleteStoreDescription }) => ({
    position: "absolute",
    top: "30px",
    right: "5px",
    zIndex: 10,
    transition: "all 0.3s ease-in-out",
    "& svg": {
      transform: showCompleteStoreDescription
        ? "rotate(180deg)"
        : "rotate(0deg)",
    },
    "&:hover": {
      cursor: "pointer",
      transform: showCompleteStoreDescription
        ? "translateY(-2px)"
        : "translateY(2px)",
    },
  })
);

export const LogoRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  gap: "5px",
}));

export const QShopLogo = styled("img")(({ theme }) => ({
  width: "200px",
  height: "100%",
  objectFit: "contain",
  userSelect: "none",
}));

export const ExchangeRateCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: "10px",
  padding: "10px 15px",
  width: "100%",
  height: "200px",
  backgroundColor: theme.palette.background.paper,
  borderRadius: "10px",
  marginTop: "10px",
}));

export const ExchangeRateRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
}));

export const ExchangeRateTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans, sans-serif",
  fontSize: "20px",
  fontWeight: 400,
  letterSpacing: "0.3px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const ExchangeRateSubTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "17px",
  fontWeight: 300,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));
