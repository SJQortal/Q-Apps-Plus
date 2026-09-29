import { Box } from "@mui/material";
import { styled } from "@mui/system";

export const ModalBody = styled(Box)(({ theme }) => ({
  position: "absolute",
  backgroundColor: theme.palette.background.default,
  borderRadius: "4px",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "75%",
  maxWidth: "900px",
  padding: "15px 35px",
  display: "flex",
  flexDirection: "column",
  gap: "17px",
  overflowY: "auto",
  maxHeight: "95vh",
  boxShadow:
    "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "&::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.background.paper,
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: theme.palette.background.paper,
  },
  "&::-webkit-scrollbar": {
    width: "16px",
    height: "10px",
    backgroundColor: "#292d3e",
    ...theme.applyStyles("light", {
      backgroundColor: "#f6f8fa"
    })
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#575757",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent",
    ...theme.applyStyles("light", {
      backgroundColor: "#d3d9e1"
    })
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "#474646",
    ...theme.applyStyles("light", {
      backgroundColor: "#b7bcc4"
    })
  },
  ...theme.applyStyles("dark", {
    boxShadow: "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
  })
}));
