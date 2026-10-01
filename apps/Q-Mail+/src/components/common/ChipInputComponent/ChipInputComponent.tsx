import React, { useState } from "react";
import { Box, Chip, CircularProgress, Input } from "@mui/material";
import { useDispatch } from "react-redux";
import { setNotification } from "../../../state/features/notificationsSlice";
import { lookupName, lookupPublicKey } from "../../../utils/nameCache";

export interface NameChip {
  name: string;
  publicKey: string;
  address: string;
}
interface ChipInputComponentProps {
  chips: NameChip[];
  setChips: (val: NameChip[]) => void;
  placeholder?: string;
}

/**
 * Bcc names as chips. Enter (or leaving the field) resolves the typed name
 * through the name cache, so a name is looked up once per session.
 */
export const ChipInputComponent = ({
  chips,
  setChips,
  placeholder = "Type a name and press Enter",
}: ChipInputComponentProps) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [isResolving, setIsResolving] = useState(false);
  const dispatch = useDispatch();

  const handleAddChip = async () => {
    const recipientName = inputValue.trim();
    if (!recipientName || isResolving) return;
    if (
      chips.find(
        item => item?.name?.toLowerCase() === recipientName.toLowerCase()
      )
    ) {
      setInputValue("");
      return;
    }
    setIsResolving(true);
    try {
      const lookup = await lookupName(recipientName);
      if (lookup.status !== "found") throw new Error("Name cannot be found");
      const publicKey = await lookupPublicKey(lookup.address);
      if (!publicKey) throw new Error("Cannot retrieve public key of name");
      setChips([
        ...chips,
        {
          name: lookup.name,
          publicKey,
          address: lookup.address,
        },
      ]);
      setInputValue("");
    } catch (error: any) {
      dispatch(
        setNotification({
          msg: error?.message || "Name cannot be found",
          alertType: "error",
        })
      );
    } finally {
      setIsResolving(false);
    }
  };

  const handleDeleteChip = (chipToDelete: string) => () => {
    setChips(chips.filter(chip => chip.name !== chipToDelete));
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "6px",
        width: "100%",
        minWidth: 0,
      }}
    >
      {chips.map(chip => (
        <Chip
          key={chip.name}
          label={chip.name}
          onDelete={handleDeleteChip(chip.name)}
          sx={{
            height: 32,
            color: "var(--qmail-compose-text)",
            backgroundColor: "var(--qmail-compose-button-bg)",
            border: "1px solid var(--qmail-compose-button-border)",
            "& .MuiChip-deleteIcon": {
              color: "var(--qmail-compose-muted)",
              "&:hover": {
                color: "var(--qmail-compose-text)",
              },
            },
          }}
        />
      ))}
      <Input
        value={inputValue}
        onChange={e => {
          setInputValue(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            void handleAddChip();
          }
        }}
        onBlur={() => {
          if (inputValue.trim()) void handleAddChip();
        }}
        disableUnderline
        autoComplete="off"
        autoCorrect="off"
        placeholder={placeholder}
        inputProps={{ "aria-label": "Bcc name" }}
        endAdornment={isResolving ? <CircularProgress size={14} /> : undefined}
        sx={{
          flex: 1,
          minWidth: 160,
          minHeight: 44,
          color: "var(--new-message-text)",
          "& .MuiInput-input::placeholder": {
            color: "var(--qmail-compose-placeholder) !important",
            fontSize: "1rem",
            fontStyle: "normal",
            fontWeight: 400,
            lineHeight: "120%",
            letterSpacing: "0.15px",
            opacity: 1,
          },
        }}
      />
    </Box>
  );
};
