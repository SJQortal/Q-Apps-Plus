import React, { useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import { getAccountNames, getPrimaryAccountName } from "../utils/qortalRequestFunctions";
import NavBar from "../components/layout/Navbar/Navbar";
import { BottomNav, BottomNavSpacer } from "../components/layout/BottomNav/BottomNav";
import PageLoader from "../components/common/PageLoader";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { RootState } from "../state/store";
import { setUserAvatarHash } from "../state/features/globalSlice";
import { RequestQueue } from "../utils/queue";
import { EditFile } from "../components/EditFile/EditFile.tsx";
import ConsentModal from "../components/common/ConsentModal";
import { useIframe } from "../hooks/useIframe.tsx";

interface Props {
  children: React.ReactNode;
}

export const queue = new RequestQueue();

/**
 * The app shell: account lookup, the header, the phone bottom bar, the Edit
 * dialog and the one-time consent dialog, with an error boundary around the
 * page content.
 */
const GlobalWrapper: React.FC<Props> = ({ children }) => {
  useIframe();
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

  const askForAccountInformation = React.useCallback(async () => {
    try {
      const account = await qortalRequest({
        action: "GET_USER_ACCOUNT",
      });

      const names = await getAccountNames(account.address);
      const primary = await getPrimaryAccountName(account.address);
      dispatch(addUser({ ...account, name: primary, names }));
    } catch (error) {
      console.error(error);
    }
  }, [dispatch]);

  React.useEffect(() => {
    askForAccountInformation();
  }, [askForAccountInformation]);

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
        authenticate={askForAccountInformation}
      />
      <EditFile />

      <ErrorBoundary>{children}</ErrorBoundary>

      <BottomNavSpacer />
      <BottomNav />
    </>
  );
};

export default GlobalWrapper;
