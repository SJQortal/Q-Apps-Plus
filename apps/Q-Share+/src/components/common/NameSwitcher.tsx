import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Box,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  TextField,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { splitNameHighlight } from "../../utils/nameSearch";
import { NameAvatar } from "./NameAvatar";

/** From this many names on, the switcher gets a search field and lists names A to Z. */
export const NAME_SEARCH_THRESHOLD = 15;

/**
 * 44 px rows wherever the phone layout applies. A plain `minHeight` loses to
 * MenuItem's own `min-height: auto` from 600 px up (a later media rule), so
 * this one is a media rule too.
 */
const ROW_SX = { [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } } as const;
/** 32 px avatars in MenuItem's 36 px icon column. */
const LEAD_SX = { width: 36, mr: 1, justifyContent: "center" } as const;

/** Case- and accent-insensitive form for matching ("Ä" finds "ä" and "a"). */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * The names to show, in order. Up to the threshold: as the account lists them.
 * Above it: the active name first, then A to Z; while searching, the names
 * that start with the query before those that only contain it.
 */
export function orderNames(names: string[], activeName: string | null, query: string): string[] {
  const unique = [...new Set(names.filter(Boolean))];
  const q = fold(query.trim());
  if (!q) {
    if (unique.length <= NAME_SEARCH_THRESHOLD) return unique;
    const rest = unique
      .filter((n) => n !== activeName)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    return activeName && unique.includes(activeName) ? [activeName, ...rest] : rest;
  }
  const matches = unique.filter((n) => fold(n).includes(q));
  const starts = (n: string) => (fold(n).startsWith(q) ? 0 : 1);
  return matches.sort((a, b) => starts(a) - starts(b) || a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export interface NameSwitcherProps {
  /** Every name the account owns. */
  names: string[];
  activeName: string | null;
  /** The active name's avatar URL when the caller already has it loaded. */
  activeAvatar?: string;
  onPick: (name: string) => void;
  /** Focus the search field when it appears (desktop menus; phones would pop the keyboard). */
  autoFocusSearch?: boolean;
  /** Height of the scrolling list; the search field stays above it. */
  maxListHeight?: number | string;
  /** Escape in an empty search field: close whatever holds the switcher. */
  onEscape?: () => void;
}

/**
 * The account's names as a menu of avatar rows with the active one checked,
 * shared by the header's account menu and Settings. An account with more than
 * NAME_SEARCH_THRESHOLD names gets a search field; ↓ moves from it into the
 * list, Enter picks the first match, Escape clears the query (then closes).
 * Each avatar loads only once its row scrolls into view (NameAvatar).
 */
export function NameSwitcher({
  names,
  activeName,
  activeAvatar,
  onPick,
  autoFocusSearch = false,
  maxListHeight,
  onEscape,
}: NameSwitcherProps) {
  const [query, setQuery] = useState("");
  const searchable = new Set(names.filter(Boolean)).size > NAME_SEARCH_THRESHOLD;
  const shown = useMemo(
    () => orderNames(names, activeName, searchable ? query : ""),
    [names, activeName, query, searchable]
  );
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const trimmed = query.trim();

  const focusFirstRow = () => listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusFirstRow();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (shown[0]) onPick(shown[0]);
    } else if (event.key === "Escape" && query) {
      // First Escape clears the query; the next one reaches the menu and closes it.
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    } else if (event.key === "Escape") {
      onEscape?.();
    }
  };

  // Capture phase: MenuList's own ↑ handler would already have wrapped focus to the last row.
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    // ↑ on the first row goes back to the search field instead of wrapping to the last row.
    if (!searchable || event.key !== "ArrowUp") return;
    const first = listRef.current?.querySelector('[role^="menuitem"]');
    if (first && event.target === first) {
      event.preventDefault();
      event.stopPropagation();
      searchRef.current?.focus();
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {searchable && (
        <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
          <TextField
            inputRef={searchRef}
            size="small"
            fullWidth
            autoFocus={autoFocusSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={`Find one of your ${new Set(names.filter(Boolean)).size} names`}
            autoComplete="off"
            slotProps={{
              htmlInput: {
                "aria-label": "Find one of your names",
                "aria-controls": listId,
                autoCapitalize: "none",
                spellCheck: false,
              },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: query ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear the search"
                      edge="end"
                      size="small"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                      sx={{
                        [`@media ${PHONE_MEDIA}`]: {
                          minWidth: 44,
                          minHeight: 44,
                        },
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            // A 44 px field on phones: the small input is 40 px (23 px line + 8.5 px padding).
            sx={{ "& .MuiInputBase-input": { [`@media ${PHONE_MEDIA}`]: { py: "10.5px" } } }}
          />
        </Box>
      )}
      {searchable && trimmed && shown.length === 0 && (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
          No name matches “{trimmed}”.
        </Typography>
      )}
      <MenuList
        ref={listRef}
        id={listId}
        aria-label="Your names"
        disablePadding
        autoFocusItem={false}
        onKeyDownCapture={onListKey}
        sx={{
          maxHeight: maxListHeight,
          overflowY: maxListHeight ? "auto" : undefined,
          overscrollBehavior: "contain",
        }}
      >
        {shown.map((name) => {
          const active = name === activeName;
          return (
            <MenuItem
              key={name}
              role="menuitemradio"
              aria-checked={active}
              selected={active}
              // The highlight splits the text into spans, which can drop a space from the computed name.
              aria-label={name}
              onClick={() => onPick(name)}
              sx={ROW_SX}
            >
              <ListItemIcon sx={LEAD_SX}>
                {/* The active name reuses the header's avatar URL, already loaded. */}
                <NameAvatar name={name} src={active ? activeAvatar : undefined} size={32} />
              </ListItemIcon>
              <ListItemText
                primary={
                  searchable && trimmed
                    ? splitNameHighlight(name, trimmed).map((part, i) =>
                        part.match ? (
                          <Box key={i} component="span" sx={{ color: "primary.main", fontWeight: 700 }}>
                            {part.text}
                          </Box>
                        ) : (
                          <span key={i}>{part.text}</span>
                        )
                      )
                    : name
                }
                slotProps={{ primary: { noWrap: true } }}
              />
              {active && <CheckIcon fontSize="small" sx={{ color: "primary.main", ml: 1, flexShrink: 0 }} />}
            </MenuItem>
          );
        })}
      </MenuList>
    </Box>
  );
}
