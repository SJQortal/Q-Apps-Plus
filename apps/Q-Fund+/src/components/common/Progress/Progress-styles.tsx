import { styled } from "@mui/material/styles";
import { Box, CircularProgress, Typography } from "@mui/material";

export const FundAmountsCol = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  gap: "7px",
}));

export const FundAmountsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "15px",
}));

export const FundAmount = styled(Typography)(({ theme }) => ({
  fontFamily: "Montserrat",
  fontWeight: 500,
  fontSize: "28px",
  letterSpacing: "0.2px",
  userSelect: "none",
  color:
    theme.palette.mode === "light"
      ? theme.palette.primary.dark
      : theme.palette.primary.light,
}));

export const FundAmountNumber = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontFamily: "Montserrat",
  fontWeight: 500,
  fontSize: "28px",
  letterSpacing: "0.2px",
  userSelect: "none",
  color: theme.palette.text.primary,
  "& span": {
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    maxWidth: "100%",
    fontSize: "28px",
    width: "100px",
  },
}));

export const ProgressRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  alignItems: "center",
  width: "fit-content",
  minWidth: "450px",
  maxWidth: "450px",
  padding: "25px",
  border: `1px solid ${theme.palette.primary.light}`,
  borderRadius: "8px",
}));

export const CustomCircularProgress = styled(CircularProgress)(({ theme }) => ({
  position: "relative",
  color:
    theme.palette.mode === "light"
      ? theme.palette.primary.dark
      : theme.palette.primary.light,
  justifySelf: "center",

  "&::before": {
    content: '""',
    display: "block",
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "calc(100% - 2px)",
    height: "calc(100% - 2px)",
    borderRadius: "50%",
    background:
      theme.palette.mode === "dark"
        ? `radial-gradient(circle at center, transparent 34%, #fffffff0 34%)`
        : `radial-gradient(circle at center, transparent 34%, #e2e0e0ee 34%)`,
    transform: "translate(-50%, -50%)",
    zIndex: -1,
  },

  "& .MuiCircularProgress-circle": {
    zIndex: 1,
  },
}));
