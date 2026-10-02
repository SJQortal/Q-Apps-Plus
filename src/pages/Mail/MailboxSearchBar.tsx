/**
 * The one search box of the list pane: a query, a scope ("This mailbox" /
 * "All mail"), the match count, and the explicit "Search message bodies"
 * step with its progress (N8, UX #21). Colours come from the theme.
 */
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import {
  Box,
  Button,
  IconButton,
  InputBase,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { headerFill } from "../../hub-theme";
import type { MailSearchScope } from "./mailSearch";
import { BODY_SEARCH_STEP, type MailboxSearchStatus } from "./useMailboxSearch";

interface MailboxSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  status: MailboxSearchStatus;
  scope?: MailSearchScope;
  onScopeChange?: (scope: MailSearchScope) => void;
  /** Raise the body limit by `bodyStep` (decrypts that many more rows). */
  onSearchBodies?: () => void;
  bodyStep?: number;
  /** Rows the scope covers that are still being loaded (All mail). */
  isLoadingScope?: boolean;
}

export function describeSearchStatus(status: MailboxSearchStatus, isLoadingScope = false): string {
  if (status.active && status.scanProgress) {
    return `Searching message bodies… ${status.scanProgress.done}/${status.scanProgress.of}`;
  }
  const matches = `${status.matches} ${status.matches === 1 ? "match" : "matches"}`;
  if (isLoadingScope) return `${matches} · loading more mail…`;
  if (status.pending > 0) {
    return `${matches} · ${status.pending} ${status.pending === 1 ? "body" : "bodies"} not searched`;
  }
  return matches;
}

// 44 px, 14 px, and text.secondary when unselected: MUI's action.active
// reads at 4.4:1 on Q-Mail Classic's light surface.
const toggleSx = {
  minHeight: 44,
  px: 1.5,
  fontSize: "0.875rem",
  textTransform: "none",
  color: "text.secondary",
  "&.Mui-selected": { color: "text.primary" },
} as const;

export const MailboxSearchBar = ({
  value,
  onChange,
  placeholder,
  status,
  scope = "mailbox",
  onScopeChange,
  onSearchBodies,
  bodyStep = BODY_SEARCH_STEP,
  isLoadingScope = false,
}: MailboxSearchBarProps) => {
  const hasQuery = value.trim().length > 0;
  const canSearchBodies = hasQuery && status.pending > 0 && !status.active && Boolean(onSearchBodies);
  const nextBatch = Math.min(status.pending, bodyStep);

  return (
    <Box
      sx={theme => ({
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        px: 1.5,
        py: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: headerFill(theme),
      })}
    >
      <Box
        role="search"
        sx={theme => ({
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          minHeight: 44,
          pl: 1.5,
          pr: 0.5,
          borderRadius: theme.shape.borderRadius,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          "&:focus-within": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
          },
        })}
      >
        <SearchIcon aria-hidden sx={{ color: "text.secondary", fontSize: 20 }} />
        <InputBase
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          inputProps={{
            "aria-label": placeholder,
            enterKeyHint: "search",
            autoCapitalize: "none",
            autoCorrect: "off",
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: "1rem",
            "& input::placeholder": { opacity: 1, color: "text.secondary" },
            "& input::-webkit-search-cancel-button": { display: "none" },
          }}
        />
        {hasQuery && (
          <IconButton
            onClick={() => onChange("")}
            aria-label="Clear search"
            sx={{ minWidth: 44, minHeight: 44, color: "text.secondary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {hasQuery && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          {onScopeChange && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={scope}
              onChange={(_event, next) => {
                if (next === "mailbox" || next === "all") onScopeChange(next);
              }}
              aria-label="Search scope"
            >
              <ToggleButton value="mailbox" sx={toggleSx}>
                This mailbox
              </ToggleButton>
              <ToggleButton value="all" sx={toggleSx}>
                All mail
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          <Typography
            role="status"
            aria-live="polite"
            sx={{ flex: 1, minWidth: 0, fontSize: "0.875rem", color: "text.secondary" }}
          >
            {describeSearchStatus(status, isLoadingScope)}
          </Typography>
          {canSearchBodies && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ManageSearchOutlinedIcon />}
              onClick={onSearchBodies}
              sx={{ minHeight: 44, textTransform: "none" }}
            >
              Search message bodies ({nextBatch})
            </Button>
          )}
        </Box>
      )}

      {status.active && status.scanProgress && (
        <LinearProgress
          variant="determinate"
          value={
            status.scanProgress.of
              ? Math.round((status.scanProgress.done / status.scanProgress.of) * 100)
              : 0
          }
          aria-label="Searching message bodies"
          sx={{ borderRadius: 2 }}
        />
      )}
    </Box>
  );
};
