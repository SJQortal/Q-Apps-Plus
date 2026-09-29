import { styled } from "@mui/material/styles";
import { Box, Button, InputLabel } from "@mui/material";
import { changeLightness } from "qortal-app-utils";

const ButtonStyle = styled(Button)({
  fontFamily: "Mulish",
  fontWeight: "800",
  fontSize: "21px",
  lineHeight: "1.75",
  textTransform: "uppercase",
  minWidth: "64px",
  padding: "15px 25px",
  color: "#ffffff",
  "&:disabled": {
    filter: "brightness(0.8)",
  },
});

export const DonateModalCol = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "400px",
  justifyContent: "center",
  gap: "20px",
});

export const CrowdfundPageDonateButton = styled(ButtonStyle)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  "&:hover": {
    backgroundColor: changeLightness(theme.palette.primary.main, -10),
  },
}));

export const DonorDetailsButton = styled(ButtonStyle)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  "&:hover": {
    backgroundColor: changeLightness(theme.palette.secondary.main, -10),
  },
}));

export const DonateModalLabel = styled(InputLabel)(({ theme }) => ({
  fontFamily: "Copse",
  fontSize: "27px",
  letterSpacing: "1px",
  color: theme.palette.text.primary,
  fontWeight: 400,
}));
