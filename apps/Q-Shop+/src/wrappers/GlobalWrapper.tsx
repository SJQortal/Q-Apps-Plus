/**
 * Everything every page needs: the account (useUserAccount), the signed-in
 * name's shops (useOwnShops), the app frame, and the dialogs that open from
 * anywhere. The original also published an empty product index here at
 * start-up when it couldn't read the shop's one; nothing is published here
 * now (docs/apps/Q-Shop+.md → Bugs 2).
 */
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { RootState } from "../state/store";
import PageLoader from "../components/common/PageLoader";
import ConsentModal from "../components/modals/ConsentModal";
import { ShopDialogs } from "../components/modals/ShopDialogs";
import { DownloadQortalModal } from "../components/modals/DownloadQortalModal";
import { AppShell } from "../components/layout/AppShell";
import { useUserAccount } from "../hooks/useUserAccount";
import { useOwnShops } from "../hooks/useOwnShops";
import { useTrackInAppHistory } from "../hooks/useSafeBack";

interface Props {
  children: React.ReactNode;
}

const GlobalWrapper: React.FC<Props> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticate, authenticating } = useUserAccount();
  useOwnShops();
  useTrackInAppHistory();
  const isLoadingGlobal = useSelector((state: RootState) => state.global.isLoadingGlobal);
  const cartOpen = useSelector((state: RootState) => state.cart.isOpen);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

  // "Open the cart" from anywhere goes to the cart page.
  useEffect(() => {
    if (cartOpen && location.pathname !== "/cart") navigate("/cart");
  }, [cartOpen, location.pathname, navigate]);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      <ShopDialogs />
      <AppShell
        authenticate={authenticate}
        authenticating={authenticating}
        onGatewaySignIn={() => setShowDownloadModal(true)}
      >
        {children}
      </AppShell>
      <ConsentModal />
      {showDownloadModal && <DownloadQortalModal open={showDownloadModal} onClose={() => setShowDownloadModal(false)} />}
    </>
  );
};

export default GlobalWrapper;
