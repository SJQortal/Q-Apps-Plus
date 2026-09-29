import { styled } from "@mui/system";
import { Box, Typography } from "@mui/material";

export const CountdownCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "15px",
  width: "fit-content",
  maxWidth: "450px",
  minWidth: "450px",
  padding: "25px",
  border: `1px solid ${theme.palette.primary.light}`,
  borderRadius: "8px",
}));

export const CountdownRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
}));

export const CountdownCol = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "0px",
  padding: "0px 2px",
  alignItems: "center",
}));

export const CountdownFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "18px",
  letterSpacing: 0,
  fontWeight: 400,
  color: theme.palette.text.primary,
}));

export const CountdownFontNumber = styled(Typography)(({ theme }) => ({
  fontFamily: "Montserrat",
  fontWeight: 300,
  fontSize: "40px",
  letterSpacing: 0,
  lineHeight: "45px",
  color: theme.palette.text.primary,
}));

export const CountdownContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "5px",
}));

export const EstimatedTimeRemainingFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "16px",
  color: theme.palette.text.primary,
  fontWeight: 400,
  letterSpacing: 0,
  userSelect: "none",
}));
