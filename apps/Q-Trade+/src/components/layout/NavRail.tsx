import { styled } from "@mui/material/styles";
import { Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { headerFill, primarySoft } from "../../hub-theme";
import { useCompactRail } from "../../hooks/usePhoneLayout";
import { isNavActive, NAV_ITEMS } from "./navItems";

export const RAIL_WIDTH = 220;
export const RAIL_WIDTH_COMPACT = 72;

const Rail = styled("nav")(({ theme }) => ({
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  height: "100dvh",
  width: RAIL_WIDTH,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  padding: theme.spacing(2, 1.5),
  paddingTop: `calc(${theme.spacing(2)} + var(--qp-safe-top))`,
  backgroundColor: headerFill(theme),
  backdropFilter: "blur(12px)",
  borderRight: `1px solid ${theme.palette.divider}`,
  overflowY: "auto",
  [theme.breakpoints.down("md")]: {
    width: RAIL_WIDTH_COMPACT,
    padding: theme.spacing(2, 1),
    alignItems: "center",
  },
}));

const Brand = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.25),
  padding: theme.spacing(1, 1.5, 2),
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(1, 0, 2),
    justifyContent: "center",
  },
}));

const BrandMark = styled("span")(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: primarySoft(theme),
  color: theme.palette.primary.main,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 15,
  flexShrink: 0,
}));

const NavButton = styled("button", {
  shouldForwardProp: (prop) => prop !== "$active",
})<{ $active?: boolean }>(({ theme, $active }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  width: "100%",
  minHeight: 44,
  padding: theme.spacing(1.25, 1.5),
  border: 0,
  borderRadius:
    theme.qplus.id === "hub30" || theme.qplus.id === "hub20" ? theme.shape.borderRadius : 999,
  backgroundColor: $active ? primarySoft(theme) : "transparent",
  color: $active ? theme.palette.primary.main : theme.palette.text.primary,
  cursor: "pointer",
  font: "inherit",
  fontSize: 15,
  fontWeight: $active ? 700 : 500,
  textAlign: "left",
  transition: "background-color 160ms ease, color 160ms ease",
  "&:hover": { backgroundColor: $active ? primarySoft(theme) : theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  "& svg": { fontSize: 24, flexShrink: 0 },
  [theme.breakpoints.down("md")]: {
    width: 48,
    height: 48,
    justifyContent: "center",
    padding: theme.spacing(1.5),
  },
}));

const NavLabel = styled("span")(({ theme }) => ({
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  [theme.breakpoints.down("md")]: { display: "none" },
}));

export function NavRail() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const compact = useCompactRail();

  return (
    <Rail aria-label="Navigation">
      <Brand>
        <BrandMark aria-hidden>QT</BrandMark>
        {compact ? null : <Typography sx={{ fontWeight: 700, fontSize: 18 }}>Q-Trade+</Typography>}
      </Brand>
      {NAV_ITEMS.map(({ label, path, Icon }) => {
        const active = isNavActive(pathname, path);
        return (
          <NavButton
            key={path}
            type="button"
            $active={active}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={compact ? label : undefined}
            onClick={() => navigate(path)}
          >
            <Icon />
            <NavLabel>{label}</NavLabel>
          </NavButton>
        );
      })}
    </Rail>
  );
}
