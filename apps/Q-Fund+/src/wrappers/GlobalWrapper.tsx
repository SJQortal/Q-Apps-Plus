import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addUser } from "../state/features/authSlice";
import NavBar from "../components/layout/Navbar/Navbar";
import PageLoader from "../components/common/PageLoader";
import { RootState } from "../state/store";
import { setUserAvatarHash } from "../state/features/globalSlice";
import { useLocation } from "react-router-dom";
import ConsentModal from "../components/modals/ConsentModal";

interface Props {
  children: React.ReactNode;
  setTheme: (val: string) => void;
}

const GlobalWrapper: React.FC<Props> = ({ children, setTheme }) => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const location = useLocation();

  useEffect(() => {
    if (!user?.name) return;

    getAvatar(user?.name);
  }, [user?.name]);

  // Get avatar for user to use in different places in the app
  const getAvatar = React.useCallback(async (author: string) => {
    try {
      const url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: author,
        service: "THUMBNAIL",
        identifier: "qortal_avatar",
      });

      dispatch(
        setUserAvatarHash({
          name: author,
          url,
        })
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  const { isLoadingGlobal } = useSelector((state: RootState) => state.global);

  async function getNameInfo(address: string) {
    const response = await qortalRequest({
      action: "GET_ACCOUNT_NAMES",
      address: address,
    });
    const nameData = response;

    if (nameData?.length > 0) {
      return nameData[0].name;
    } else {
      return "";
    }
  }

  const askForAccountInformation = React.useCallback(async () => {
    try {
      const account = await qortalRequest({
        action: "GET_USER_ACCOUNT",
      });

      const name = await getNameInfo(account.address);
      dispatch(addUser({ ...account, name }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === "/" || user?.name) return;
    askForAccountInformation();
  }, []);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      {/* Hide navbar on homepage for styling purposes */}
      {location.pathname !== "/" && (
        <NavBar
          setTheme={(val: string) => setTheme(val)}
          isAuthenticated={!!user?.name}
          authenticate={askForAccountInformation}
          fixed={true}
        />
      )}
      <ConsentModal />
      {children}
    </>
  );
};

export default GlobalWrapper;
