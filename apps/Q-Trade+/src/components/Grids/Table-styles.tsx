import { Box, styled } from "@mui/system";
import { Button, Typography } from "@mui/material";

export const MainContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
});

export const TextTableTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Inter",
  color: theme.palette.text.primary,
  fontWeight: 400,
  fontSize: "20px",
  lineHeight: "40px",
  userSelect: "none",
}));

export const BuyContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  width: "calc(100% - 14px)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  bottom: "0px",
  padding: "18px 14px 12px 14px",
  background: "#323336",
  zIndex: 3,
  [theme.breakpoints.down("sm")]: {
    width: "calc(100% - 2px)",
  }
}));

export const BuyContainerDivider = styled(Box)(({ theme }) => ({
  position: "absolute",
  width: "60%",
  height: "1px",
  background: "lightgray",
  top: "10px",
  left: "50%",
  transform: "translateX(-50%)",
  [theme.breakpoints.down("sm")]: {
    top: "5px",
  }
}));

export const BuyOrderBtn = styled(Button)(({ theme }) => ({
  borderRadius: "8px",
  width: "80px",
  height: "45px",
  background: "#2e7d32",
  fontSize: '18px',
  color: "white",
  cursor: "pointer",
  border: "1px solid #375232",
  boxShadow: "0px 2.77px 2.21px 0px #00000005",
  marginRight: "10px",
  [theme.breakpoints.down("sm")]: {
    marginRight: "0px",
  }
}));
