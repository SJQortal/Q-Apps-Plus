import { styled } from "@mui/system";
import { Box, Button, Card, CardContent } from "@mui/material";

export const ProductTitle = styled(Box)(({ theme }) => ({
  displayq: "flex",
  alignItems: "center",
  gap: "5px",
  fontFamily: "Merriweather Sans",
  fontSize: "18px",
  wordBreak: "break-word",
  color: theme.palette.text.primary,
  userSelect: "none"
}));

export const ProductDescription = styled(Box)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "16px",
  color: theme.palette.text.primary,
  opacity: 0.95,
  wordBreak: "break-word",
  maxHeight: "75px",
  userSelect: "none"
}));

export const AddToCartButton = styled(Button)(({ theme }) => ({
  fontFamily: "Karla",
  fontWeight: 300,
  fontSize: "16.5px",
  borderRadius: "7px",
  padding: "5px 10px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  backgroundColor: "transparent",
  color: theme.palette.text.primary,
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    filter:
      theme.palette.mode === "dark" ? "brightness(1.8)" : "brightness(0.2)"
  }
}));

export const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  overflow: "hidden",
  boxShadow: "none",
  borderRadius: "8px",
  transition: "all 0.3s ease-in-out 0s",
  minHeight: ["auto", "400px"],
  display: "flex",
  flexDirection: "column"
}));

export const StyledCardContent = styled(CardContent)(({ theme }) => ({
  height: "100%",
  padding: "8px 16px",
  gap: "10px",
  display: "flex",
  flexDirection: "column",
  flexGrow: 1
}));
