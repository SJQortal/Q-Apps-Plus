import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { Box, IconButton, InputBase, Typography } from "@mui/material";
import { MailboxSearchStatus } from "./useMailboxSearch";

interface MailboxSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  status: MailboxSearchStatus;
}

export const MailboxSearchBar = ({
  value,
  onChange,
  placeholder,
  status,
}: MailboxSearchBarProps) => {
  const trimmedValue = value.trim();
  const hasQuery = trimmedValue.length > 0;
  const pluralizedMatches = status.matches === 1 ? "match" : "matches";

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1080px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        px: {
          xs: "8px",
          md: "16px",
        },
        pb: "12px",
      }}
    >
      <Box
        sx={{
          width: "100%",
          border: "1px solid var(--qmail-shell-border)",
          borderRadius: "12px",
          backgroundColor: "var(--qmail-shell-hover)",
          display: "flex",
          alignItems: "center",
          px: "10px",
          minHeight: "44px",
          "&:focus-within": {
            borderColor: "var(--qmail-sidebar-active-border)",
            boxShadow: "0 0 0 1px var(--qmail-sidebar-active-border)",
          },
        }}
      >
        <SearchIcon
          sx={{
            fontSize: "1.2rem",
            color: "var(--qmail-thread-subtle-text)",
            mr: "8px",
          }}
        />
        <InputBase
          value={value}
          onChange={event => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          inputProps={{
            "aria-label": placeholder,
          }}
          sx={{
            flex: 1,
            color: "var(--new-message-text)",
            fontSize: "0.95rem",
            "& input::placeholder": {
              opacity: 1,
              color: "var(--qmail-thread-subtle-text)",
            },
          }}
        />
        {hasQuery && (
          <IconButton
            size="small"
            onClick={() => {
              onChange("");
            }}
            sx={{
              color: "var(--qmail-thread-subtle-text)",
            }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {hasQuery && (
        <Typography
          sx={{
            color: "var(--qmail-thread-subtle-text)",
            fontSize: "0.8rem",
            px: "4px",
          }}
        >
          {status.matches} {pluralizedMatches}
          {status.active ? ` • Scanned ${status.scanned}/${status.total}` : ""}
        </Typography>
      )}
    </Box>
  );
};
