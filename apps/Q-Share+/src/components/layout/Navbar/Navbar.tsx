import React, { useState } from "react";
import { Avatar, Box, IconButton, Popover, Tooltip } from "@mui/material";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";
import {
  AppTagline,
  AppTitle,
  AvatarContainer,
  CustomAppBar,
  DropdownContainer,
  DropdownText,
  LogoContainer,
  NavbarName,
} from "./Navbar-styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useNavigate } from "react-router-dom";
import { DownloadTaskManager } from "../../common/DownloadTaskManager";
import QShareLogo from "../../../assets/img/q-share-icon.webp";
import { PublishFile } from "../../PublishFile/PublishFile.tsx";
import { avatarUrl } from "../../../utils/qortalLinks";

interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  userAvatar: string;
  authenticate: () => void;
  accountNames: { name: string }[];
  setActiveName: (name: string) => void;
}

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  accountNames,
  setActiveName,
}) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] = useState<boolean>(false);

  const closeMenu = () => setAnchorEl(null);

  return (
    <CustomAppBar position="sticky" elevation={0}>
      <LogoContainer onClick={() => navigate("/")} aria-label="Q-Share+ home">
        <img src={QShareLogo} alt="" style={{ width: "auto", height: 36 }} />
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <AppTitle>Q-Share+</AppTitle>
          <AppTagline>Public file sharing on Qortal</AppTagline>
        </Box>
      </LogoContainer>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
        <DownloadTaskManager />
        {isAuthenticated && userName && <PublishFile />}
        <Tooltip title="Settings">
          <IconButton aria-label="Settings" onClick={() => navigate("/settings")} sx={{ color: "text.primary" }}>
            <SettingsOutlinedIcon />
          </IconButton>
        </Tooltip>
        {isAuthenticated && userName && (
          <AvatarContainer
            aria-label={`Account menu for ${userName}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(anchorEl)}
            onClick={(e) => setAnchorEl(e.currentTarget)}
          >
            <Avatar src={userAvatar || avatarUrl(userName)} alt="" sx={{ width: 28, height: 28 }} />
            <NavbarName>{userName}</NavbarName>
            <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary" }} />
          </AvatarContainer>
        )}

        <Popover
          id="user-popover"
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={closeMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {accountNames
            .filter((n) => n.name)
            .map((n) => (
              <DropdownContainer
                key={n.name}
                role="menuitem"
                onClick={() => {
                  setActiveName(n.name);
                  closeMenu();
                }}
              >
                <DropdownText>
                  {n.name === userName ? "✔︎ " : ""}
                  {n.name}
                </DropdownText>
              </DropdownContainer>
            ))}
          <DropdownContainer
            role="menuitem"
            onClick={() => {
              setIsOpenBlockedNamesModal(true);
              closeMenu();
            }}
          >
            <PersonOffIcon fontSize="small" sx={{ color: "error.main" }} />
            <DropdownText>Blocked names</DropdownText>
          </DropdownContainer>
        </Popover>
        {isOpenBlockedNamesModal && (
          <BlockedNamesModal open={isOpenBlockedNamesModal} onClose={() => setIsOpenBlockedNamesModal(false)} />
        )}
      </Box>
    </CustomAppBar>
  );
};

export default NavBar;
