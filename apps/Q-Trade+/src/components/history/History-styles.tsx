import { Box, styled } from "@mui/system";
import { Button, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

type HistoryBtnProp = {
  activeBtn: boolean;
};

export const HistoryButtonRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  margin: "5px 5px 5px 0",
});

export const HistoryButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== "activeBtn",
})<HistoryBtnProp>(({ theme, activeBtn }) => ({
  fontFamily: "Inter",
  color: activeBtn ? theme.palette.text.primary : theme.palette.primary.main,
  fontWeight: 400,
  fontSize: "16px",
  height: "30px",
  lineHeight: "40px",
  userSelect: "none",
  background: activeBtn ? theme.palette.primary.main : "transparent",
  border: `1px solid ${theme.palette.primary.main}`,
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    border: `1px solid ${theme.palette.primary.main}`,
    background: theme.palette.primary.main,
    color: theme.palette.text.primary,
    cursor: "pointer",
  },
}));

export const Refresh = styled(RefreshIcon)({
  cursor: "pointer",
  color: "#fff",
  fontSize: "25px",
  marginLeft: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)",
  },
});

export const ShowingFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Inter",
  color: theme.palette.text.primary,
  fontWeight: 400,
  fontSize: "16px",
  lineHeight: "25px",
  marginBottom: "5px",
  userSelect: "none",
}));
