import { styled } from "@mui/system";
import { Box, Typography, Grid } from "@mui/material";
import { PlusCircleSVG } from "../../assets/svgs/PlusCircle";
import { MinusCircleSVG } from "../../assets/svgs/MinusCircle";
import { GarbageSVG } from "../../assets/svgs/GarbageSVG";

export const CartContainer = styled(Grid)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  gap: 1,
  flexGrow: 1,
  overflow: "auto",
  width: "100%",
  padding: "0 10px",
  overflowX: "hidden",
}));

export const ProductContainer = styled(Grid)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "row",
  flexWrap: "nowrap",
  padding: "15px 25px",
  borderTop: `1px solid ${theme.palette.background.paper}`,
  borderBottom: `1px solid ${theme.palette.background.paper}`,
  justifyContent: "space-evenly",
  gap: "20px",
  width: "100%",
  height: "100%",
  maxHeight: "250px",
}));

export const ColumnTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "20px",
  fontWeight: 300,
  letterSpacing: 0,
  userSelect: "none",
  padding: "10px",
  color: theme.palette.text.primary,
}));

export const ProductInfoCol = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  alignItems: "center",
  flexGrow: 1,
}));

export const ProductDetailsCol = styled(Grid)(({ theme }) => ({
  boxSizing: "border-box",
  margin: "0px",
  flexBasis: "100%",
  WebkitBoxFlex: "0",
  flexGrow: 0,
  maxWidth: "100%",
  display: "grid",
  gridTemplateRows: "1fr auto",
  height: "100%",
  rowGap: "8px",
}));

export const ProductTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Merriweather Sans",
  fontSize: "22px",
  color: theme.palette.text.primary,
  userSelect: "none",
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  width: "100%",
}));

export const ProductDescription = styled(Box)(({ theme }) => ({
  display: "flex",
  color: theme.palette.text.primary,
  paddingRight: "5px",
  margin: "0px",
  fontWeight: 300,
  lineHeight: 1.5,
  letterSpacing: 0,
  fontFamily: "Karla",
  fontSize: "18px",
  userSelect: "none",
  overflowY: "auto",
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar": {
    width: "5px",
    height: "10px",
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#414763",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: `4px solid ${theme.palette.background.default}`,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#40455f",
  },
}));

export const QuantityRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontFamily: "Karla",
  fontSize: "18px",
  fontWeight: 300,
  color: theme.palette.text.primary,
}));

export const ProductImage = styled("img")({
  height: "140px",
  width: "-webkit-fill-available",
  borderRadius: "3px",
  objectFit: "contain",
});

export const ProductDetailsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
}));

export const IconsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "20px",
}));

export const RemoveQuantityButton = styled(MinusCircleSVG)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.05)",
  },
}));

export const AddQuantityButton = styled(PlusCircleSVG)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.05)",
  },
}));

export const GarbageIcon = styled(GarbageSVG)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.05)",
  },
}));

export const ProductPriceFont = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontFamily: "Karla",
  fontSize: "18px",
  fontWeight: 300,
  color: theme.palette.text.primary,
  userSelect: "none",
  "& span": {
    display: "flex",
    alignItems: "center",
    gap: "3px",
  },
}));

export const TotalSumContainer = styled(Grid)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-evenly",
  border: `1px solid ${theme.palette.background.paper}`,
  borderRadius: "3px",
  padding: "15px",
  backgroundColor: theme.palette.background.default,
  height: "100%",
  flexGrow: 1,
  marginTop: "35px",
  marginRight: "10px",
}));

export const TotalSumHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  fontFamily: "Karla",
  fontWeight: "bold",
  fontSize: "18px",
  userSelect: "none",
  paddingBottom: "15px",
}));

export const TotalSumItems = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  width: "100%",
  gap: "10px",
  paddingBottom: "15px",
  borderBottom: `1px solid ${theme.palette.background.paper}`,
}));

export const TotalSumItem = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  gap: "3px",
}));

export const TotalSumItemTitle = styled(Typography)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  fontFamily: "Karla",
  fontSize: "18px",
  fontWeight: 300,
  letterSpacing: 0,
  userSelect: "none",
  color: theme.palette.text.primary,
  gap: "3px",
}));

export const OrderTotalRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: theme.palette.text.primary,
  userSelect: "none",
  fontFamily: "Karla",
  fontWeight: "bold",
  letterSpacing: 0,
  borderBottom: `1px solid ${theme.palette.background.paper}`,
  padding: "15px 0px",
  gap: "3px",
  width: "100%",
  "& span": {
    marginRight: "5px",
  },
}));

export const ConfirmPurchaseContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "15px",
  padding: "25px",
}));

export const ConfirmPurchaseRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  fontFamily: "Karla",
  fontSize: "21px",
  fontWeight: 300,
  letterSpacing: 0,
  userSelect: "none",
}));

export const CoinToPayInRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "10px",
  fontFamily: "Karla",
  fontSize: "21px",
  fontWeight: 300,
  letterSpacing: 0,
  padding: "2px 0",
  userSelect: "none",
}));
