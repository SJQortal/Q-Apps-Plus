import { Box, Button, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { headerFill } from "../../hub-theme";
import { RAIL_WIDTH, RAIL_WIDTH_COMPACT } from "../layout/NavRail";
import { BOTTOM_NAV_HEIGHT } from "../layout/BottomNav";

export const MainContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
});

export const TextTableTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 600,
  fontSize: "20px",
  lineHeight: "40px",
  userSelect: "none",
}));

/** The fixed action bar under a table (Buy on the order book, Cancel on my sell orders). */
export const BuyContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  left: RAIL_WIDTH,
  right: 0,
  bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "18px 14px 12px 14px",
  background: headerFill(theme, "chromeStrong"),
  backdropFilter: "blur(12px)",
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: theme.zIndex.appBar - 1,
  [theme.breakpoints.down("md")]: {
    left: RAIL_WIDTH_COMPACT,
  },
  [theme.breakpoints.down("sm")]: {
    left: 0,
    bottom: `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))`,
    padding: "12px 10px 10px 10px",
  },
}));

export const BuyContainerDivider = styled(Box)(({ theme }) => ({
  position: "absolute",
  width: "60%",
  height: "1px",
  background: theme.palette.divider,
  top: "6px",
  left: "50%",
  transform: "translateX(-50%)",
  [theme.breakpoints.down("sm")]: {
    top: "3px",
  },
}));

export const BuyOrderBtn = styled(Button)(({ theme }) => ({
  borderRadius: "8px",
  width: "80px",
  height: "45px",
  background: theme.palette.success.main,
  fontSize: "18px",
  color: theme.palette.success.contrastText,
  cursor: "pointer",
  border: `1px solid ${theme.palette.success.dark}`,
  marginRight: "10px",
  "&.Mui-disabled": {
    background: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
    borderColor: "transparent",
  },
  [theme.breakpoints.down("sm")]: {
    marginRight: "0px",
  },
}));
