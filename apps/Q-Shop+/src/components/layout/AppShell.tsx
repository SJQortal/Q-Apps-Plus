/**
 * The app's frame: header, the page, and (round 2) the phone's bottom bar.
 * This first version keeps the original Navbar.
 */
import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import NavBar from "./Navbar/Navbar";
import { avatarUrl } from "../../qdn/links";

export function AppShell({
  children,
  authenticate,
  onGatewaySignIn,
}: {
  children: ReactNode;
  authenticate: () => void;
  /** Sign in pressed on a web gateway, where there is no Hub. */
  onGatewaySignIn: () => void;
  authenticating?: boolean;
}) {
  const user = useSelector((state: RootState) => state.auth.user);
  const ownShopStatus = useSelector((state: RootState) => state.global.ownShopStatus);
  return (
    <>
      <NavBar
        isAuthenticated={!!user?.name}
        userName={user?.name || ""}
        userAvatar={user?.name ? avatarUrl(user.name) : ""}
        authenticate={authenticate}
        displayDownloadGatewayModalFunc={onGatewaySignIn}
        hasAttemptedToFetchShopInitial={ownShopStatus !== "idle" && ownShopStatus !== "loading"}
      />
      {children}
    </>
  );
}
