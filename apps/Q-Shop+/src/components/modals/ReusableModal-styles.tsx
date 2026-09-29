import { styled } from "@mui/system";
import { Box } from "@mui/material";
import AbstractTechArt from "../../assets/img/AbstractTechArt.png";

export const ReusableModalBody = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "75%",
  backgroundColor: theme.palette.background.paper,
  padding: "15px 35px",
  display: "flex",
  flexDirection: "column",
  gap: "17px",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
      : "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "&::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.background.paper
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: theme.palette.background.paper
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
  },
  "&.download-qortal-modal": {
    "&::before": {
      content: "''",
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      backgroundImage: `url(${AbstractTechArt})`,
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      filter: "blur(2px) contrast(0.3)",
      zIndex: -1
    }
  }
}));
