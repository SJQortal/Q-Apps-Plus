import { styled } from "@mui/system";
import { Box } from "@mui/material";

export const TabImageListStyle = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  gap: "10px",
  justifyContent: "center",
  width: "100%"
}));

export const TabImageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  gap: "15px"
}));

export const TabImageStyle = styled("img")(({ theme }) => ({
  width: "30%",
  height: "100%"
}));
