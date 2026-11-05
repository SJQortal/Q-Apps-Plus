/**
 * The app's frame (docs/DESIGN.md → Layout and Mobile): the sticky header,
 * the page in a <main> landmark, and on phones the bottom bar with a spacer
 * that keeps the page's end clear of it. It also keeps the Hub/GO frame
 * height fresh (utils/hubFrame.ts), which pages and dialogs use instead of
 * 100vh.
 */
import { useEffect, useMemo, type ReactNode } from "react";
import { Box } from "@mui/material";
import { watchEmbeddedFrame } from "../../utils/hubFrame";
import NavBar from "./Navbar/Navbar";
import { BottomNav, BottomNavSpacer } from "./BottomNav/BottomNav";
import { ShellContext, isWebGateway } from "./shellState";

export function AppShell({
  children,
  authenticate,
  onGatewaySignIn,
  authenticating = false,
  reloadOwnShops = () => {},
}: {
  children: ReactNode;
  /** Ask Hub for the account (the Sign in button). */
  authenticate: () => void;
  /** Sign in pressed on a web gateway, where there is no Hub. */
  onGatewaySignIn: () => void;
  /** The account request is out. */
  authenticating?: boolean;
  /** Load the signed-in name's shops again. */
  reloadOwnShops?: () => void;
}) {
  useEffect(() => watchEmbeddedFrame(), []);

  const actions = useMemo(
    () => ({
      signIn: () => (isWebGateway() ? onGatewaySignIn() : authenticate()),
      reloadOwnShops,
      authenticating,
    }),
    [authenticate, onGatewaySignIn, reloadOwnShops, authenticating]
  );

  return (
    <ShellContext.Provider value={actions}>
      <NavBar />
      <Box component="main" id="main" sx={{ display: "block", minWidth: 0 }}>
        {children}
      </Box>
      <BottomNavSpacer />
      <BottomNav />
    </ShellContext.Provider>
  );
}
