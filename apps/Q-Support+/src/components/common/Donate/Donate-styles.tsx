import { Box, Button, InputLabel } from "@mui/material";
import { styled } from "@mui/material/styles";

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

export const DonorDetailsButton = styled(ButtonStyle)(({ theme }) => ({}));

export const DonateModalLabel = styled(InputLabel)(({ theme }) => ({
  fontFamily: "Copse",
  fontSize: "27px",
  letterSpacing: "1px",
  color: theme.palette.text.primary,
  fontWeight: 400,
}));
