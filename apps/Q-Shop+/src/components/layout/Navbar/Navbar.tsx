import React, { useRef, useState } from "react";
import { RootState } from "../../../state/store";
import { useSelector } from "react-redux";
import { Box, Popover, useTheme } from "@mui/material";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import { useNavigate } from "react-router-dom";
import {
  resetProducts,
  toggleCreateStoreModal
} from "../../../state/features/globalSlice";
import { useDispatch } from "react-redux";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import EmailIcon from "@mui/icons-material/Email";
import {
  AvatarContainer,
  CustomAppBar,
  DropdownContainer,
  DropdownText,
  AuthenticateButton,
  NavbarName,
  LightModeIcon,
  DarkModeIcon,
  ThemeSelectRow,
  QShopLogoContainer,
  StoreManagerIcon,
  StoresButton
} from "./Navbar-styles";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";
import QShopLogo from "../../../assets/img/QShopLogo.webp";
import QShopLogoLight from "../../../assets/img/QShopLogoLight.webp";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffIcon from "@mui/icons-material/PersonOff";

import { Store } from "../../../state/features/storeSlice";
import { OrdersSVG } from "../../../assets/svgs/OrdersSVG";
import { resetOrders } from "../../../state/features/orderSlice";
interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  userAvatar: string;
  authenticate: () => void;
  hasAttemptedToFetchShopInitial: boolean;
  setTheme: (val: string) => void;
  displayDownloadGatewayModalFunc: () => void;
}

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  authenticate,
  hasAttemptedToFetchShopInitial,
  setTheme,
  displayDownloadGatewayModalFunc
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  // Get All My Stores from Redux To Display In Store Manager Dropdown

  const myStores = useSelector((state: RootState) => state.store.myStores);
  const hashMapStores = useSelector(
    (state: RootState) => state.store.hashMapStores
  );

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] =
    useState<boolean>(false);
  const [openStoreManagerDropdown, setOpenStoreManagerDropdown] =
    useState<boolean>(false);
  const [openUserDropdown, setOpenUserDropdown] = useState<boolean>(false);

  const searchValRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (event?: React.MouseEvent<HTMLDivElement>) => {
    const target = event?.currentTarget as unknown as HTMLButtonElement | null;
    setAnchorEl(target);
  };

  const handleCloseUserDropdown = () => {
    setAnchorEl(null);
    setOpenUserDropdown(false);
  };

  const handleCloseStoreDropdown = () => {
    setAnchorEl(null);
    setOpenStoreManagerDropdown(false);
  };

  const onCloseBlockedNames = () => {
    setIsOpenBlockedNamesModal(false);
  };

  return (
    <CustomAppBar position="sticky" elevation={2}>
      <ThemeSelectRow>
        {theme.palette.mode === "dark" ? (
          <LightModeIcon
            onClickFunc={() => setTheme("light")}
            color="white"
            height="22"
            width="22"
          />
        ) : (
          <DarkModeIcon
            onClickFunc={() => setTheme("dark")}
            color="black"
            height="22"
            width="22"
          />
        )}
        <QShopLogoContainer
          src={theme.palette.mode === "dark" ? QShopLogoLight : QShopLogo}
          alt="QShop Logo"
          onClick={() => {
            navigate(`/`);
            searchValRef.current = "";
            if (!inputRef.current) return;
            inputRef.current.value = "";
          }}
        />
      </ThemeSelectRow>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        {!isAuthenticated && (
          <AuthenticateButton onClick={() => {
            const isGateWay = window.location.href.includes("https");
            if (isGateWay) {
              displayDownloadGatewayModalFunc();
              return;
            }
            authenticate();
          }}>
            <ExitToAppIcon />
            Authenticate
          </AuthenticateButton>
        )}
        {isAuthenticated && userName && hasAttemptedToFetchShopInitial && (
          <StoresButton
            onClick={(e: any) => {
              if (myStores.length > 0) {
                handleClick(e);
                setOpenStoreManagerDropdown(true);
              } else {
                dispatch(toggleCreateStoreModal(true));
              }
            }}
          >
            My Stores
            <StoreManagerIcon
              color={theme.palette.text.primary}
              height={"32"}
              width={"32"}
            />
          </StoresButton>
        )}
        {isAuthenticated && userName && (
          <>
            <AvatarContainer
              onClick={(e: any) => {
                handleClick(e);
                setOpenUserDropdown(true);
              }}
            >
              <NavbarName>{userName}</NavbarName>
              {!userAvatar ? (
                <AccountCircleSVG
                  color={theme.palette.text.primary}
                  width="32"
                  height="32"
                />
              ) : (
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  width="32"
                  height="32"
                  style={{
                    borderRadius: "50%"
                  }}
                />
              )}
              <ExpandMoreIcon id="expand-icon" sx={{ color: "#ACB6BF" }} />
            </AvatarContainer>
          </>
        )}
        <Popover
          id={"store-manager-popover"}
          open={openStoreManagerDropdown}
          anchorEl={anchorEl}
          onClose={handleCloseStoreDropdown}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left"
          }}
        >
          <DropdownContainer>
            <DropdownText
              onClick={() => {
                dispatch(toggleCreateStoreModal(true));
                handleCloseStoreDropdown();
              }}
            >
              Create Store
            </DropdownText>
          </DropdownContainer>
          {myStores.length > 0 &&
            myStores.map((store: Store) => (
              <DropdownContainer key={store.id}>
                <DropdownText
                  onClick={() => {
                    dispatch(resetOrders());
                    dispatch(resetProducts());
                    navigate(`/${userName}/${store.id}`);
                    handleCloseStoreDropdown();
                  }}
                >
                  {hashMapStores[store.id]?.title}
                </DropdownText>
              </DropdownContainer>
            ))}
        </Popover>
        <Popover
          id={"user-popover"}
          open={openUserDropdown}
          anchorEl={anchorEl}
          onClose={handleCloseUserDropdown}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left"
          }}
        >
          <DropdownContainer
            onClick={() => {
              handleCloseUserDropdown();
              handleCloseStoreDropdown();
              navigate("/my-orders");
            }}
          >
            <OrdersSVG color={"#f9ff34"} height={"22"} width={"22"} />
            <DropdownText>My Orders</DropdownText>
          </DropdownContainer>
          <DropdownContainer
            onClick={() => {
              setIsOpenBlockedNamesModal(true);
              handleCloseUserDropdown();
              handleCloseStoreDropdown();
            }}
          >
            <PersonOffIcon
              sx={{
                color: "#e35050"
              }}
            />
            <DropdownText>Blocked Names</DropdownText>
          </DropdownContainer>
          <DropdownContainer>
            <a
              href="qortal://APP/Q-Mail"
              className="qortal-link"
              style={{
                width: "100%",
                display: "flex",
                gap: "5px",
                alignItems: "center",
                textDecoration: "none"
              }}
            >
              <EmailIcon
                sx={{
                  color: "#50e3c2"
                }}
              />

              <DropdownText>Q-Mail</DropdownText>
            </a>
          </DropdownContainer>
        </Popover>
        {isOpenBlockedNamesModal && (
          <BlockedNamesModal
            open={isOpenBlockedNamesModal}
            onClose={onCloseBlockedNames}
          />
        )}
      </Box>
    </CustomAppBar>
  );
};

export default NavBar;
