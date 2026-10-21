import React, { useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import NavBar from "../components/layout/Navbar/Navbar";
import { BottomNav, BottomNavSpacer } from "../components/layout/BottomNav/BottomNav";
import PageLoader from "../components/common/PageLoader";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { RootState } from "../state/store";
import { setUserAvatarHash } from "../state/features/globalSlice";
import { queue } from "../utils/queue";
import { EditFile } from "../components/EditFile/EditFile.tsx";
import ConsentModal from "../components/common/ConsentModal";
import { useIframe } from "../hooks/useIframe.tsx";
import { useTrackInAppHistory } from "../hooks/useSafeBack";
import { useUserAccount } from "../hooks/useUserAccount";

interface Props {
  children: React.ReactNode;
}

// Kept for importers that still read the queue from here; the singleton lives in utils/queue.ts.
export { queue };

/**
 * The app shell: account lookup, the header, the phone bottom bar, the Edit
 * dialog and the one-time consent dialog, with an error boundary around the
 * page content.
 */
const GlobalWrapper: React.FC<Props> = ({ children }) => {
  useIframe();
  useTrackInAppHistory();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const username = useMemo(() => {
    if (!user?.name) return "";

    return user.name;
  }, [user]);
  const userAvatar = useSelector((state: RootState) => (username ? state.global.userAvatarHash[username] : "") || "");
  const getAvatar = React.useCallback(
    async (author: string) => {
      try {
        const url = await qortalRequest({
          action: "GET_QDN_RESOURCE_URL",
          name: author,
          service: "THUMBNAIL",
          identifier: "qortal_avatar",
        });
        if (url) {
          dispatch(
            setUserAvatarHash({
              name: author,
              url,
            })
          );
        }
      } catch (error) {
        /* empty */
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (!username) return;
    getAvatar(username);
  }, [username, getAvatar]);

  const switchActiveName = useCallback(
    (newName: string) => {
      if (!user) return;
      dispatch(addUser({ ...user, name: newName }));
    },
    [user, dispatch]
  );

  const { isLoadingGlobal } = useSelector((state: RootState) => state.global);

  const { authenticate, authenticating } = useUserAccount();

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      <ConsentModal />

      <NavBar
        isAuthenticated={!!user?.name}
        userName={user?.name || ""}
        accountNames={user?.names || []}
        setActiveName={switchActiveName}
        userAvatar={userAvatar}
        authenticate={authenticate}
        // No account yet and no request out: a decline or a late answer left the app signed out.
        canSignIn={!user && !authenticating}
      />
      <EditFile />

      <main id="main">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      <BottomNavSpacer />
      <BottomNav />
    </>
  );
};

export default GlobalWrapper;
