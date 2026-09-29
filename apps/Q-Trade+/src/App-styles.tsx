import { Box } from "@mui/material";
import { styled } from "@mui/system";

export const AppContainer = styled(Box)(({ theme }) => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: "20px 30px 0 30px",
  backgroundColor: "#323336",
  [`@media (max-width: 500px)`]: {
    padding: "10px 5px 0 5px",
  }
}));

export const MainContainer = styled(Box)`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;
