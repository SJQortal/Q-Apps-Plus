import { styled } from "@mui/system";
import { Box } from "@mui/material";

export const CategoryContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  gap: "5px",
}));
