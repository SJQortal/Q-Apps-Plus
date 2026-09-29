import React, { useState } from "react";
import { List, ListItem, Typography, useTheme } from "@mui/material";
import {
  ModalContent,
  ModalText,
  StyledModal,
} from "./BlockedNamesModal-styles";
import {
  ThemeButton,
  ThemeButtonBright,
} from "../../../pages/Home/Home-styles.tsx";

interface PostModalProps {
  open: boolean;
  onClose: () => void;
}

export const BlockedNamesModal: React.FC<PostModalProps> = ({
  open,
  onClose,
}) => {
  const [blockedNames, setBlockedNames] = useState<string[]>([]);
  const theme = useTheme();
  const getBlockedNames = React.useCallback(async () => {
    try {
      const listName = `blockedNames`;
      const response = await qortalRequest({
        action: "GET_LIST_ITEMS",
        list_name: listName,
      });
      setBlockedNames(response);
    } catch (error) {
      onClose();
    }
  }, []);

  React.useEffect(() => {
    getBlockedNames();
  }, [getBlockedNames]);

  const removeFromBlockList = async (name: string) => {
    try {
      const response = await qortalRequest({
        action: "DELETE_LIST_ITEM",
        list_name: "blockedNames",
        item: name,
      });

      if (response === true) {
        setBlockedNames(prev => prev.filter(n => n !== name));
      }
    } catch (error) {}
  };

  return (
    <StyledModal open={open} onClose={onClose}>
      <ModalContent>
        <ModalText>Manage blocked names</ModalText>
        <List
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            flex: "1",
            overflow: "auto",
          }}
        >
          {blockedNames.map((name, index) => (
            <ListItem
              key={name + index}
              sx={{
                display: "flex",
              }}
            >
              <Typography>{name}</Typography>
              <ThemeButton
                sx={{
                  fontFamily: "Raleway",
                }}
                onClick={() => removeFromBlockList(name)}
              >
                Remove
              </ThemeButton>
            </ListItem>
          ))}
        </List>
        <ThemeButtonBright
          variant="contained"
          onClick={onClose}
          sx={{
            fontFamily: "Raleway",
          }}
        >
          Close
        </ThemeButtonBright>
      </ModalContent>
    </StyledModal>
  );
};
