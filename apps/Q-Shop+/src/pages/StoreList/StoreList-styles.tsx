/**
 * Styled parts other pages still import from the home page's folder (the
 * cart's coin marks, the shop page's exchange-rate card and tooltip). The
 * home page itself is built from src/discovery.
 */
import { styled } from "@mui/system";
import { Box, Tooltip, Typography } from "@mui/material";

export const AcceptedCoin = styled("img")({
  width: "30px",
  height: "30px",
  objectFit: "contain",
  userSelect: "none",
});

export const StyledTooltip = styled(Tooltip)(({ theme }) => ({
  "& .MuiTooltip-tooltip": {
    fontSize: "15px",
    letterSpacing: "0px",
    fontWeight: 300,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    zIndex: 10,
  },
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

export const ExchangeRateRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
}));

export const ExchangeRateTitle = styled(Typography)(({ theme }) => ({
  fontSize: "20px",
  fontWeight: 400,
  letterSpacing: "0.3px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const ExchangeRateSubTitle = styled(Typography)(({ theme }) => ({
  fontSize: "17px",
  fontWeight: 300,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));
