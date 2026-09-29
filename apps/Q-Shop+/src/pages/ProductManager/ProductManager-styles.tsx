import { styled } from "@mui/system";
import { Box, Typography, Button, Grid } from "@mui/material";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { TimesSVG } from "../../assets/svgs/TimesSVG";
import { MinimizeSVG } from "../../assets/svgs/MinimizeSVG";

export const ProductManagerContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  backgroundColor: "background.paper"
}));

export const TabsContainer = styled(Box)(({ theme }) => ({
  borderBottom: 1,
  borderColor: "divider",
  display: "flex",
  width: "100%",
  alignItems: "flex-start",
  justifyContent: "center",
  flexDirection: "column",
  padding: "15px",
  gap: "4px"
}));

export const StyledTabs = styled(Tabs)(({ theme }) => ({
  "& .MuiTabs-indicator": {
    backgroundColor: theme.palette.secondary.main
  }
}));

export const StyledTab = styled(Tab)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "15px",
  "& .MuiTabs-indicator": {
    backgroundColor: theme.palette.secondary.main
  }
}));

export const ProductsToSaveCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexDirection: "column",
  width: "85vw",
  minHeight: "500px",
  maxHeight: "90vh",
  borderRadius: "8px",
  backgroundColor: theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  padding: "25px",
  boxShadow:
    theme.palette.mode === "light"
      ? "rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px;"
      : "0px 3px 4px 0px hsla(0,0%,0%,0.14), 0px 3px 3px -2px hsla(0,0%,0%,0.12), 0px 1px 8px 0px hsla(0,0%,0%,0.2);",
  zIndex: 2
}));

export const ProductToSaveCard = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-evenly",
  maxWidth: "300px",
  width: "auto",
  height: "auto",
  maxHeight: "200px",
  minHeight: "100px",
  padding: "10px",
  borderRadius: "8px",
  backgroundColor: "#f2f2f2",
  flexGrow: 1
}));

export const ProductsCol = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  width: "100%",
  overflowY: "auto",
  flexDirection: "row",
  padding: "0 10px 10px 10px",

  "&::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.mode === "light" ? "#e8e8e8" : "#32333c"
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#e8e8e8" : "#32333c"
  },
  "&::-webkit-scrollbar": {
    width: "16px",
    height: "10px",
    backgroundColor: theme.palette.mode === "light" ? "#f6f8fa" : "#292d3e"
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#575757",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent"
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#474646"
  }
}));

export const ProductToSaveImageRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-evenly",
  gap: "4px"
}));

export const CardHeader = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans",
  fontSize: "18px",
  userSelect: "none",
  color: "#000000",
  letterSpacing: 0
}));

export const Bulletpoints = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "17px",
  userSelect: "none",
  color: "#000000",
  letterSpacing: 0,
  alignItems: "center",
  gap: "5px",
  display: "flex",
  justifyContent: "flex-start",
  width: "100%"
}));

export const TimesIcon = styled(TimesSVG)(({ theme }) => ({
  position: "absolute",
  top: "2px",
  right: "5px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)"
  }
}));

export const AddMoreButton = styled(Button)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "15px",
  backgroundColor: "#cfd432",
  color: "black",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#afb428"
  }
}));

export const CardButtonRow = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "15px"
}));

export const MinimizeIcon = styled(MinimizeSVG)(({ theme }) => ({
  position: "absolute",
  top: "5px",
  right: "5px",
  padding: "3px",
  backgroundColor: "transparent",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#ffffff73"
  }
}));

export const DockedMinimizeIcon = styled(MinimizeSVG)(({ theme }) => ({
  padding: "3px",
  backgroundColor: "transparent",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#ffffff73"
  }
}));

export const DockedProductsToSaveCard = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "8px 25px",
  fontFamily: "Raleway",
  fontSize: "16px",
  color: theme.palette.text.primary,
  borderTopRightRadius: "8px",
  borderTopLeftRadius: "8px",
  borderBottomRightRadius: "0px",
  borderBottomLeftRadius: "0px",
  backgroundColor: theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
  position: "fixed",
  zIndex: 55,
  bottom: 0,
  right: "20px",
  gap: "15px"
}));
