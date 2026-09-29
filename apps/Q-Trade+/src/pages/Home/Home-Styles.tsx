import { Box, Button, Typography } from "@mui/material";
import { styled } from "@mui/system";

type TabProp = {
  activeTab: boolean;
};

export const MainCol = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
});

export const MainRow = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "25px",
});

export const PreventPlayingText = styled(Typography)(({ theme }) => ({
  fontFamily: "Fira Sans",
  color: theme.palette.text.primary,
  fontWeight: 600,
  fontSize: "18px",
  lineHeight: "17px",
  textAlign: "center",
  userSelect: "none",
}));

// OAuth Button

export const OAuthButtonRow = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
});

export const OAuthButton = styled(Button)(({ theme }) => ({
  background: theme.palette.primary.main,
  color: theme.palette.text.primary,
  fontFamily: "Fira Sans",
  fontWeight: 600,
  fontSize: "22px",
  lineHeight: "17px",
  padding: "25px 20px",
  borderRadius: "5px",
  cursor: "pointer",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    background: theme.palette.primary.dark,
  },
}));

export const HomeWrapper = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "100px",
  height: "90vh",
  width: "100%",
});

export const TabsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "100%",
  justifyContent: "center",
});

export const TabsRow = styled(Box)({
  display: "flex",
  flexDirection: "row",
  gap: "5px",
  justifyContent: "space-evenly",
  alignItems: "center",
  backgroundColor: "#323336",
  width: "fit-content",
  borderRadius: "5px",
  padding: "3px 0",
});

export const Tab = styled(Box, {
  shouldForwardProp: (prop) => prop !== "activeTab"
})<TabProp>(({ theme, activeTab }) => ({
  color: activeTab ? "#323336" : "#e8e8e8",
  fontFamily: "Inter, sans-serif",
  fontSize: "16px",
  lineHeight: "19.2px",
  fontWeight: 400,
  backgroundColor: activeTab ? "#e8e8e8" : "transparent",
  padding: "5px 10px",
  borderRadius: "5px",
  height: "auto",
  transition: "all 0.4s ease-in-out",
  userSelect: "none",
  "&:hover": {
    color: "#323336",
    backgroundColor: "#babbbc",
    cursor: activeTab ? "auto" : "pointer",
  },
}));

export const TabDivider = styled(Box, {
  shouldForwardProp: (prop) => prop !== "activeTab"
})<TabProp>(({ theme, activeTab }) => ({
  width: "1px",
  height: "25px",
  margin: "0 3px",
  backgroundColor: activeTab ? "transparent" : "#a4a4a5",
}));