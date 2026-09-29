import React from "react";
import { Box, useTheme } from "@mui/material";
import {
  CustomAppBar,
  ThemeSelectRow,
  LogoContainer,
  LightModeIcon,
  DarkModeIcon,
  AuthenticateButton,
  NavbarName,
  AvatarContainer,
} from "./Navbar-styles";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ExitToAppIcon from "@mui/icons-material/ExitToApp";
import QFundLogo from "../../../assets/images/QFundDarkLogo.png";
import QFundLogoLight from "../../../assets/images/QFundLightLogo.png";
import { RootState } from "../../../state/store";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";
interface Props {
  isAuthenticated: boolean;
  authenticate: () => void;
  setTheme: (val: string) => void;
  fixed?: boolean;
}

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  authenticate,
  setTheme,
  fixed,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const username = useSelector((state: RootState) => state.auth.user?.name);

  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );

  return (
    <CustomAppBar
      position={fixed ? "sticky" : "relative"}
      elevation={2}
      style={{
        backgroundColor: !fixed
          ? "transparent"
          : theme.palette.background.default,
      }}
    >
      <ThemeSelectRow>
        {theme.palette.mode === "dark" ? (
          <LightModeIcon
            onClickFunc={() => setTheme("light")}
            color={!fixed ? "white" : theme.palette.text.primary}
            height="22"
            width="22"
          />
        ) : (
          <DarkModeIcon
            onClickFunc={() => setTheme("dark")}
            color={!fixed ? "white" : theme.palette.text.primary}
            height="22"
            width="22"
          />
        )}
        <LogoContainer
          src={theme.palette.mode === "dark" ? QFundLogo : QFundLogoLight}
          alt="QFund Logo"
          onClick={() => {
            navigate(`/`);
          }}
        />
      </ThemeSelectRow>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        {!isAuthenticated && (
          <AuthenticateButton
            style={{
              backgroundColor: fixed ? theme.palette.secondary.main : "#A9D9D0",
            }}
            onClick={authenticate}
          >
            <ExitToAppIcon />
            Authenticate
          </AuthenticateButton>
        )}
        {isAuthenticated && username && (
          <>
            <AvatarContainer>
              <NavbarName
                style={{ color: !fixed ? "white" : theme.palette.text.primary }}
              >
                {username}
              </NavbarName>
              {!userAvatarHash[username] ? (
                <AccountCircleSVG
                  color={!fixed ? "white" : theme.palette.text.primary}
                  width="32"
                  height="32"
                />
              ) : (
                <img
                  src={userAvatarHash[username]}
                  alt="User Avatar"
                  width="32"
                  height="32"
                  style={{
                    borderRadius: "50%",
                    color: !fixed ? "white" : theme.palette.text.primary,
                  }}
                />
              )}
            </AvatarContainer>
          </>
        )}
      </Box>
    </CustomAppBar>
  );
};

export default NavBar;
