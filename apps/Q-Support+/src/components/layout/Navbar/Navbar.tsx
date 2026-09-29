import React, { useRef, useState } from "react";
import { Box, Input, Popover, Typography, useTheme } from "@mui/material";
import { BlockedNamesModal } from "../../common/BlockedNamesModal/BlockedNamesModal";

import {
  AvatarContainer,
  CustomAppBar,
  DarkModeIcon,
  DropdownContainer,
  DropdownText,
  LightModeIcon,
  LogoContainer,
  NavbarName,
  ThemeSelectRow,
} from "./Navbar-styles";
import { AccountCircleSVG } from "../../../assets/svgs/AccountCircleSVG";
import BackspaceIcon from "@mui/icons-material/Backspace";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";

import { DownloadTaskManager } from "../../common/DownloadTaskManager";
import QSupportIcon from "../../../assets/img/Q-SupportIcon(AlphaX).webp";
import { useDispatch, useSelector } from "react-redux";
import {
  addFilteredFiles,
  setFilterValue,
  setIsFiltering,
} from "../../../state/features/fileSlice.ts";
import { RootState } from "../../../state/store";
import { useWindowSize } from "../../../hooks/useWindowSize";
import { PublishIssue } from "../../PublishIssue/PublishIssue.tsx";
import { FeeHistoryModal } from "../../../constants/PublishFees/FeePricePublish/FeeHistoryModal.tsx";

interface Props {
  isAuthenticated: boolean;
  userName: string | null;
  userAvatar: string;
  authenticate: () => void;
  setTheme: (val: string) => void;
}

const NavBar: React.FC<Props> = ({
  isAuthenticated,
  userName,
  userAvatar,
  authenticate,
  setTheme,
}) => {
  const windowSize = useWindowSize();
  const searchValRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(
    null
  );
  const [openUserDropdown, setOpenUserDropdown] = useState<boolean>(false);
  const [isOpenBlockedNamesModal, setIsOpenBlockedNamesModal] =
    useState<boolean>(false);

  const [anchorElNotification, setAnchorElNotification] =
    React.useState<HTMLButtonElement | null>(null);
  const filterValue = useSelector((state: RootState) => state.file.filterValue);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.currentTarget as unknown as HTMLButtonElement | null;
    setAnchorEl(target);
  };
  const openNotificationPopover = (event: any) => {
    const target = event.currentTarget as unknown as HTMLButtonElement | null;
    setAnchorElNotification(target);
  };
  const closeNotificationPopover = () => {
    setAnchorElNotification(null);
  };

  const openPopover = Boolean(anchorElNotification);
  const idNotification = openPopover
    ? "simple-popover-notification"
    : undefined;

  const handleCloseUserDropdown = () => {
    setAnchorEl(null);
    setOpenUserDropdown(false);
  };

  const onCloseBlockedNames = () => {
    setIsOpenBlockedNamesModal(false);
  };

  return (
    <CustomAppBar position="sticky" elevation={2}>
      <ThemeSelectRow>
        <Box
          sx={{
            display: "flex",
            height: "100%",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <LogoContainer
            onClick={() => {
              navigate("/");
              dispatch(setIsFiltering(false));
              dispatch(setFilterValue(""));
              dispatch(addFilteredFiles([]));
              searchValRef.current = "";
              if (!inputRef.current) return;
              inputRef.current.value = "";
            }}
          >
            <img
              src={QSupportIcon}
              style={{
                width: "auto",
                height: "100px",
                padding: "2px",
              }}
            />
          </LogoContainer>
          <Typography
            sx={{
              fontSize: "30px",
              whiteSpace: "nowrap",
            }}
          >
            Welcome to Q-Support
          </Typography>
        </Box>
      </ThemeSelectRow>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <Popover
          id={idNotification}
          open={openPopover}
          anchorEl={anchorElNotification}
          onClose={closeNotificationPopover}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              padding: "5px",
            }}
          >
            <Input
              id="standard-adornment-name"
              inputRef={inputRef}
              onChange={e => {
                searchValRef.current = e.target.value;
              }}
              onKeyDown={event => {
                if (event.key === "Enter" || event.keyCode === 13) {
                  if (!searchValRef.current) {
                    dispatch(setIsFiltering(false));
                    dispatch(setFilterValue(""));
                    dispatch(addFilteredFiles([]));
                    searchValRef.current = "";
                    if (!inputRef.current) return;
                    inputRef.current.value = "";
                    return;
                  }
                  navigate("/");
                  dispatch(setIsFiltering(true));
                  dispatch(addFilteredFiles([]));
                  dispatch(setFilterValue(searchValRef.current));
                }
              }}
              placeholder="Search"
              sx={{
                "&&:before": {
                  borderBottom: "none",
                },
                "&&:after": {
                  borderBottom: "none",
                },
                "&&:hover:before": {
                  borderBottom: "none",
                },
                "&&.Mui-focused:before": {
                  borderBottom: "none",
                },
                "&&.Mui-focused": {
                  outline: "none",
                },
                fontSize: "18px",
              }}
            />

            <SearchIcon
              sx={{
                cursor: "pointer",
              }}
              onClick={() => {
                if (!searchValRef.current) {
                  dispatch(setIsFiltering(false));
                  dispatch(setFilterValue(""));
                  dispatch(addFilteredFiles([]));
                  searchValRef.current = "";
                  if (!inputRef.current) return;
                  inputRef.current.value = "";
                  return;
                }
                navigate("/");
                dispatch(setIsFiltering(true));
                dispatch(addFilteredFiles([]));
                dispatch(setFilterValue(searchValRef.current));
              }}
            />
            <BackspaceIcon
              sx={{
                cursor: "pointer",
              }}
              onClick={() => {
                dispatch(setIsFiltering(false));
                dispatch(setFilterValue(""));
                dispatch(addFilteredFiles([]));
                searchValRef.current = "";
                if (!inputRef.current) return;
                inputRef.current.value = "";
              }}
            />
          </Box>
        </Popover>

        <DownloadTaskManager />
        <FeeHistoryModal />
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
                    borderRadius: "50%",
                  }}
                />
              )}
              <ExpandMoreIcon id="expand-icon" sx={{ color: "#ACB6BF" }} />
            </AvatarContainer>
          </>
        )}
        <AvatarContainer>
          {isAuthenticated && userName && (
            <>
              <PublishIssue />
            </>
          )}
        </AvatarContainer>

        <Popover
          id={"user-popover"}
          open={openUserDropdown}
          anchorEl={anchorEl}
          onClose={handleCloseUserDropdown}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
        >
          <DropdownContainer
            onClick={() => {
              setIsOpenBlockedNamesModal(true);
              handleCloseUserDropdown();
            }}
          >
            <PersonOffIcon
              sx={{
                color: "#e35050",
              }}
            />
            <DropdownText>Blocked Names</DropdownText>
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
