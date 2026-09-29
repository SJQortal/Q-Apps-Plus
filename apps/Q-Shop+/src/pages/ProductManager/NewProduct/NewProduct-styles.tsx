import { styled } from "@mui/system";
import { Button, Box, InputLabel, Select, MenuItem } from "@mui/material";
import { TimesSVG } from "../../../assets/svgs/TimesSVG";

export const CreateProductButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  textTransform: "none",
  fontFamily: "Merriweather Sans",
  gap: "5px",
  fontSize: "15px",
  borderRadius: "5px",
  border: "none",
  color: "white",
  padding: "5px 15px",
  transition: "all 0.3s ease-in-out",
  boxShadow:
    "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.secondary.dark,
    boxShadow:
      "rgba(50, 50, 93, 0.35) 0px 3px 5px -1px, rgba(0, 0, 0, 0.4) 0px 2px 3px -1px;"
  }
}));

export const CloseIcon = styled(TimesSVG)(({ theme }) => ({
  position: "absolute",
  top: "0",
  right: "8px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)"
  }
}));

export const ProductImagesRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px"
}));

export const InputFieldCustomLabel = styled(InputLabel)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontSize: "18px",
  transformOrigin: "top center",
  fontFamily: "Karla",
  letterSpacing: 0,
  "&.Mui-focused": {
    color: theme.palette.secondary.main
  }
}));

export const CustomSelect = styled(Select)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "17.5px",
  letterSpacing: 0,
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: theme.palette.secondary.main
  }
}));

export const CategoryRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "25px",
  flexGrow: 1
}));

export const CustomMenuItem = styled(MenuItem)(({ theme }) => ({
  fontFamily: "Karla",
  letterSpacing: 0,
  fontSize: "18px"
}));

export const AddButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  color: "#fff",
  fontFamily: "Raleway",
  fontSize: "16px",
  padding: "5px 10px",
  borderRadius: "8px",
  border: "none",
  transition: "all 0.3s ease-in-out",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
      : "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "&:hover": {
    cursor: "pointer",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
    backgroundColor: theme.palette.secondary.dark
  }
}));

export const MaximumImagesRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "0",
  fontFamily: "Raleway",
  fontSize: "17px",
  color: theme.palette.text.primary,
  userSelect: "none"
}));
