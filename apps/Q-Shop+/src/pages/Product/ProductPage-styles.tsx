import { styled } from "@mui/system";
import { Box, Button, Switch, Typography } from "@mui/material";
import ARRRLogoGold from "../../assets/img/arrr.png";
import ARRRLogoWhite from "../../assets/img/ArrrLogoWhite.png";

export const ProductLayout = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "1fr 2fr",
  padding: "70px 45px 45px 45px",
  gap: "60px",
}));

export const CartBox = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "15px",
  right: "35px",
  display: "flex",
  justifyContent: "end",
}));

export const ProductNotFound = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "50px",
  left: "50%",
  transform: "translateX(-50%)",
  fontFamily: "Raleway",
  fontSize: "22px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const ProductDetailsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: "30px",
}));

export const ProductTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans, sans-serif",
  color: theme.palette.text.primary,
}));

export const ProductDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  letterSpacing: 0,
  color: theme.palette.text.primary,
  fontWeight: 400,
}));

export const ProductPriceRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "25px",
});

export const ProductPrice = styled(Typography)(({ theme }) => ({
  display: "flex",
  gap: "5px",
  fontFamily: "Karla",
  fontSize: "24px",
  letterSpacing: 0,
  lineHeight: "28px",
  color: theme.palette.text.primary,
  fontWeight: 400,
}));

export const AddToCartButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "4px 12px",
  width: "300px",
  fontFamily: "Raleway",
  fontSize: "18px",
  color: "#ffffff",
  backgroundColor: theme.palette.secondary.main,
  border: "none",
  borderRadius: "5px",
  gap: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.secondary.dark,
  },
}));

export const UnavailableButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "4px 12px",
  width: "300px",
  fontFamily: "Raleway",
  fontSize: "18px",
  color: "#ffffff",
  backgroundColor: "#da2d2d",
  border: "none",
  borderRadius: "5px",
  gap: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#b82525",
  },
}));

export const BackToStoreButton = styled(Button)(({ theme }) => ({
  position: "absolute",
  top: "15px",
  left: "35px",
  display: "flex",
  alignItems: "center",
  padding: "2px 12px",
  fontFamily: "Raleway",
  fontSize: "15px",
  gap: "3px",
  color: "#ffffff",
  backgroundColor: theme.palette.mode === "dark" ? "#bdba02" : "#e1dd04",
  border: "none",
  borderRadius: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.mode === "dark" ? "#a5a201" : "#c7c402",
  },
}));

export const ArrrSwitch = styled(Switch)(({ theme }) => ({
  position: "fixed",
  bottom: "0",
  right: "30px",
  width: 88,
  height: 57,
  padding: 7,
  borderWidth: "20px",
  "& .MuiSwitch-switchBase": {
    margin: 1,
    padding: 0,
    transform: "translateX(6px)",
    "&.Mui-checked": {
      backgroundColor: "transparent",
      color: "#fff",
      transform: "translateX(38px)",
      "& .MuiSwitch-thumb:before": {
        content: "''",
        position: "absolute",
        width: "100%",
        height: "100%",
        left: 0,
        top: 0,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        borderRadius: "50%",
        backgroundImage: `url(${ARRRLogoGold})`,
        filter: "contrast(1)",
      },
      "& + .MuiSwitch-track": {
        opacity: 1,
        backgroundColor: theme.palette.mode === "dark" ? "#8796A5" : "#aab4be",
      },
    },
  },
  "& .MuiSwitch-thumb": {
    backgroundColor: "transparent",
    width: 45,
    height: 45,
    transform: "translate(0px, 4px)",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
    borderRadius: "50%",
    "&:before": {
      filter: "contrast(0.6) blur(0.3px)",
      content: "''",
      position: "absolute",
      width: "100%",
      height: "100%",
      left: 0,
      top: 0,
      backgroundImage: `url(${ARRRLogoWhite})`,
      backgroundSize: "cover",
    },
  },
  "& .MuiSwitch-track": {
    opacity: 1,
    backgroundColor: theme.palette.mode === "dark" ? "#8796A5" : "#aab4be",
    borderRadius: "20px",
  },
}));
