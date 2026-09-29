import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useHubMessages } from "../../hooks/useHubMessages";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { NavRail } from "./NavRail";
import { BottomNav, BOTTOM_NAV_HEIGHT } from "./BottomNav";

/** Hub 3.0 shell: a navigation rail on desktop, a bottom bar below 600 px. */
export function AppShell({ children }: { children: ReactNode }) {
  useHubMessages();
  const phone = usePhoneLayout();

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
      {phone ? null : <NavRail />}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          height: "100dvh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          pb: phone ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
        }}
      >
        {children}
      </Box>
      {phone ? <BottomNav /> : null}
    </Box>
  );
}
