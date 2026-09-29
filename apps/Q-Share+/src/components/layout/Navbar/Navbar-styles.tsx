import { AppBar, Typography, Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import { headerFill } from "../../../hub-theme";

export const CustomAppBar = styled(AppBar)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: "0 12px",
  gap: theme.spacing(1),
  minHeight: 56,
  backgroundImage: "none",
  backgroundColor: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
  color: theme.palette.text.primary,
  boxShadow: "none",
  paddingTop: "env(safe-area-inset-top, 0px)",
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
  borderRadius: 999,
  color: theme.palette.text.primary,
  font: "inherit",
  minWidth: 0,
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const DropdownContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(1.25, 2),
  cursor: "pointer",
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
}));

export const DropdownText = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  color: theme.palette.text.primary,
  userSelect: "none",
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
