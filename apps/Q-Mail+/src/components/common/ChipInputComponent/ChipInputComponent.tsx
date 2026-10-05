import React, { useId, useState } from "react";
import { Box, Chip, CircularProgress, Input, Typography } from "@mui/material";
import { lookupName, lookupPublicKey } from "../../../utils/nameCache";
import { NameText } from "../NameText";

export interface NameChip {
  name: string;
  publicKey: string;
  address: string;
}
interface ChipInputComponentProps {
  chips: NameChip[];
  setChips: (val: NameChip[]) => void;
  placeholder?: string;
  /** Accessible name of the text field, e.g. "Cc name". */
  inputLabel?: string;
  /** Names that are already recipients elsewhere (To, the other list). */
  excludeNames?: string[];
  /** Text typed but not yet added as a chip, so Send can wait for it. */
  onPendingChange?: (pending: string) => void;
  /** The id of the help line under the field (the Cc and Bcc rows'), for aria-describedby. */
  describedBy?: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Cc or Bcc names as chips. Enter, a comma or leaving the field checks the
 * typed name through the name cache (registered name + public key, once per
 * session, the same check as To) and shows a problem inline, next to the
 * field, instead of a toast.
 */
export const ChipInputComponent = ({
  chips,
  setChips,
  placeholder = "Type a name and press Enter",
  inputLabel = "Bcc name",
  excludeNames = [],
  onPendingChange,
  describedBy,
}: ChipInputComponentProps) => {
  const [inputValue, setInputValueState] = useState<string>("");
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const errorId = useId();

  const setInputValue = (next: string) => {
    setInputValueState(next);
    onPendingChange?.(next.trim());
  };

  const handleAddChip = async () => {
    const recipientName = inputValue.trim();
    if (!recipientName || isResolving) return;
    if (chips.some(item => normalize(item?.name || "") === normalize(recipientName))) {
      setInputValue("");
      setError(null);
      return;
    }
    if (excludeNames.some(other => normalize(other) === normalize(recipientName))) {
      setError(
        <>
          <NameText name={recipientName} /> is already a recipient
        </>
      );
      return;
    }
    setIsResolving(true);
    setError(null);
    try {
      const lookup = await lookupName(recipientName);
      if (lookup.status !== "found") {
        setError(
          <>
            &quot;<NameText name={recipientName} />&quot; is not a registered name
          </>
        );
        return;
      }
      const publicKey = await lookupPublicKey(lookup.address);
      if (!publicKey) {
        setError(
          <>
            <NameText name={lookup.name} /> has no public key yet, so mail to them cannot be encrypted
          </>
        );
        return;
      }
      setChips([
        ...chips,
        {
          name: lookup.name,
          publicKey,
          address: lookup.address,
        },
      ]);
      setInputValue("");
    } catch {
      setError("The name could not be checked. Check your connection and try again.");
    } finally {
      setIsResolving(false);
    }
  };

  const handleDeleteChip = (chipToDelete: string) => () => {
    setChips(chips.filter(chip => chip.name !== chipToDelete));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
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
            label={<NameText name={chip.name} />}
            onDelete={handleDeleteChip(chip.name)}
            sx={{
              height: 32,
              fontSize: "0.875rem",
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
            if (error) setError(null);
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
          inputProps={{
            "aria-label": inputLabel,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": [describedBy, error ? errorId : ""].filter(Boolean).join(" ") || undefined,
          }}
          endAdornment={isResolving ? <CircularProgress size={14} aria-label="Checking the name" /> : undefined}
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
      {error && (
        <Typography
          id={errorId}
          role="alert"
          sx={{ fontSize: "0.875rem", color: "var(--qmail-danger-text)" }}
        >
          {error}
        </Typography>
      )}
    </Box>
  );
};
