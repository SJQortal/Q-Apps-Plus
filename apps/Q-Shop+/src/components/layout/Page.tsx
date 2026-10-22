/**
 * The frame of every page, so all screens line up (docs/DESIGN.md → Layout):
 * a centred column (wide for grids, narrow for forms and lists), 16 px side
 * gutters on phones, and a page header with an optional Back button (router
 * history only: Hub tabs share window.history, pitfall 8), a title (the
 * page's h1) and actions on the right.
 */
import type { ReactNode } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useSafeBack } from "../../hooks/useSafeBack";

export const PAGE_WIDTH = { grid: 1280, list: 860, form: 720 } as const;

export function Page({
  children,
  width = "grid",
  id,
}: {
  children: ReactNode;
  width?: keyof typeof PAGE_WIDTH;
  id?: string;
}) {
  return (
    <Box
      id={id}
      sx={{
        width: "100%",
        maxWidth: PAGE_WIDTH[width],
        mx: "auto",
        px: { xs: 2, sm: 3 },
        pt: { xs: 1.5, sm: 3 },
        pb: { xs: 3, sm: 6 },
        boxSizing: "border-box",
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  backTo = "/",
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Show a Back button (goes back in the app's own history, else to `backTo`). */
  back?: boolean;
  backTo?: string;
  actions?: ReactNode;
}) {
  const goBack = useSafeBack(backTo);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: { xs: 2, sm: 3 }, minHeight: 44 }}>
      {back && (
        <IconButton aria-label="Back" onClick={goBack} sx={{ width: 44, height: 44, ml: -1 }}>
          <ArrowBackIcon />
        </IconButton>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h1" sx={{ fontSize: { xs: 22, sm: 28 }, fontWeight: 700, lineHeight: 1.2, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>{actions}</Box>}
    </Box>
  );
}
