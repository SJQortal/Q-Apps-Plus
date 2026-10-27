/**
 * Everything every page needs: the account (useUserAccount), the signed-in
 * name's shops (useOwnShops), the app frame, and the dialogs that open from
 * anywhere. The original also published an empty product index here at
 * start-up when it couldn't read the shop's one; nothing is published here
 * now (docs/apps/Q-Shop+.md → Bugs 2).
 */
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { RootState } from "../state/store";
import { setIsOpen } from "../state/features/cartSlice";
import ConsentModal from "../components/modals/ConsentModal";
import { WalkthroughHost } from "../onboarding/Walkthrough";
import { ShopDialogs } from "../components/modals/ShopDialogs";
import { AppShell } from "../components/layout/AppShell";
import { useUserAccount } from "../hooks/useUserAccount";
import { useOwnShops } from "../hooks/useOwnShops";
import { useTrackInAppHistory } from "../hooks/useSafeBack";
import { useIframe } from "../hooks/useIframe";
import { lazyWithRetry } from "../utils/lazyWithRetry";

// Only web-gateway visitors ever see it, and it carries ua-parser-js: load it when opened.
const DownloadQortalModal = lazyWithRetry(() =>
  import("../components/modals/DownloadQortalModal").then((m) => ({ default: m.DownloadQortalModal }))
);

interface Props {
  children: React.ReactNode;
}

const GlobalWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { authenticate, authenticating } = useUserAccount();
  const { reload: reloadOwnShops } = useOwnShops();
  useTrackInAppHistory();
  // Hub's Back button and qortal:// links into an open tab arrive as NAVIGATE_TO_PATH.
  useIframe();
  const cartOpen = useSelector((state: RootState) => state.cart.isOpen);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  // The walkthrough opens once the original's notice is out of the way.
  const [noticeSettled, setNoticeSettled] = useState(false);
  const settleNotice = useCallback(() => setNoticeSettled(true), []);

  // "Open the cart" (cart.isOpen turning on) from anywhere goes to the cart
  // page. Leaving the cart pages (/cart and anything under it) any other way,
  // such as the bottom bar or the header, turns it off again, so the next
  // "open" is seen and nothing pulls the user back to /cart.
  const wasOpen = useRef(cartOpen);
  const lastPath = useRef(pathname);
  useEffect(() => {
    const inCart = (path: string) => path === "/cart" || path.startsWith("/cart/");
    const opened = cartOpen && !wasOpen.current;
    const leftCart = inCart(lastPath.current) && !inCart(pathname);
    wasOpen.current = cartOpen;
    lastPath.current = pathname;
    if (opened && !inCart(pathname)) navigate("/cart");
    else if (leftCart && cartOpen) dispatch(setIsOpen(false));
  }, [cartOpen, pathname, navigate, dispatch]);

  return (
    <>
      <ShopDialogs />
      <AppShell
        authenticate={authenticate}
        authenticating={authenticating}
        reloadOwnShops={reloadOwnShops}
        onGatewaySignIn={() => setShowDownloadModal(true)}
      >
        {children}
        <WalkthroughHost ready={noticeSettled} />
      </AppShell>
      <ConsentModal onSettled={settleNotice} />
      {showDownloadModal && (
        <Suspense fallback={null}>
          <DownloadQortalModal open={showDownloadModal} onClose={() => setShowDownloadModal(false)} />
        </Suspense>
      )}
    </>
  );
};

export default GlobalWrapper;
