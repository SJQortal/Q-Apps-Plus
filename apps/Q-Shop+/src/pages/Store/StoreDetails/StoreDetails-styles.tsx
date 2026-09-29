import { styled } from "@mui/system";
import { Box, Button } from "@mui/material";

export const EmailUser = styled("a")(({ theme }) => ({
  display: "flex",
  gap: "5px",
  alignItems: "center",
  fontFamily: "Karla",
  letterSpacing: "0px",
  fontSize: "21px",
}));

export const CloseButtonRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: 1,
  justifyContent: "flex-end",
}));

export const CloseButton = styled(Button)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "15px",
}));

export const StoreTitleCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifySelf: "center",
  width: "fit-content",
  borderRadius: "8px",
  padding: "10px 15px",
  fontFamily: "Merriweather Sans",
  fontWeight: 500,
  fontSize: "20px",
  color: theme.palette.text.primary,
  gap: "10px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
  },
}));

export const Divider = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "2px",
  backgroundColor: theme.palette.text.primary,
  padding: "0 10px",
  divider: 0.7,
}));

export const CardRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  fontFamily: "Karla",
  fontWeight: 300,
  fontSize: "20px",
  letterSpacing: "0px",
});

export const IconsRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  opacity: 0.9,
  fontSize: "22px",
  fontWeight: "bold",
  whiteSpace: "nowrap",
});

export const HeaderRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  padding: "10px 15px",
  fontFamily: "Merriweather Sans, sans-serif",
  fontSize: "23px",
  color: theme.palette.text.primary,
}));

export const StoreLogo = styled("img")({
  width: "90px",
  height: "90px",
  borderRadius: "3px",
  objectFit: "contain",
});

export const StoreTitle = styled(Box)({
  display: "flex",
  justifySelf: "center",
  userSelect: "none",
});

export const CardDetailsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
});

export const StoreDescription = styled(Box)({
  display: "flex",
  flexDirection: "column",
  maxWidth: "60%",
});

export const CurrencyRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "10px",
});
