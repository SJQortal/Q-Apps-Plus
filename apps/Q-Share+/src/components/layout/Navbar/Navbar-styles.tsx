import { AppBar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { headerFill } from "../../../hub-theme";

export const CustomAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "collapsed",
})<{ collapsed?: boolean }>(({ theme, collapsed }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: theme.spacing(0, 1),
  gap: theme.spacing(0.5),
  minHeight: 56,
  backgroundImage: "none",
  backgroundColor: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  boxShadow: "none",
  paddingTop: "env(safe-area-inset-top, 0px)",
  paddingLeft: `calc(${theme.spacing(1)} + env(safe-area-inset-left, 0px))`,
  paddingRight: `calc(${theme.spacing(1)} + env(safe-area-inset-right, 0px))`,
  transform: collapsed ? "translateY(-100%)" : "translateY(0)",
  transition: "transform 180ms ease",
  willChange: "transform",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

export const LogoContainer = styled("button")(({ theme }) => ({
  appearance: "none",
  border: 0,
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5),
  minHeight: 44,
  borderRadius: theme.shape.borderRadius,
  color: "inherit",
  font: "inherit",
  minWidth: 0,
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const AppTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  whiteSpace: "nowrap",
  color: theme.palette.text.primary,
}));

export const AppTagline = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  whiteSpace: "nowrap",
  color: theme.palette.text.secondary,
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

export const AvatarContainer = styled("button")(({ theme }) => ({
  appearance: "none",
  border: `1px solid ${theme.palette.divider}`,
  background: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1, 0.5, 0.5),
  minHeight: 44,
  minWidth: 44,
  justifyContent: "center",
  borderRadius: 999,
  color: theme.palette.text.primary,
  font: "inherit",
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(0.5),
    border: 0,
  },
}));

export const NavbarName = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  color: theme.palette.text.primary,
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  [theme.breakpoints.down("sm")]: {
    display: "none",
  },
}));
