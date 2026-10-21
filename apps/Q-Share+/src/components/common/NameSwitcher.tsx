import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
/** Read out, not shown: the live match count. */
const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/** One character in its case- and accent-free form ("Ä" → "a", "ς" → "σ"). */
function foldChar(char: string): string {
  return char
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/ς/g, "σ");
}

/**
 * `text` folded for matching, plus where in `text` each folded character came
 * from, so a match found in the folded form can be highlighted in the original.
 * Folding a character at a time keeps the two in step.
 */
function foldIndexed(text: string): { folded: string; from: number[] } {
  let folded = "";
  const from: number[] = [];
  let at = 0;
  for (const char of text) {
    const f = foldChar(char);
    for (let k = 0; k < f.length; k++) from.push(at);
    folded += f;
    at += char.length;
  }
  return { folded, from };
}

const fold = (text: string) => foldIndexed(text).folded;

/** The query as matched; one that folds away entirely (a lone accent) is matched as typed. */
function foldQuery(query: string): string {
  const raw = query.trim();
  return raw ? fold(raw) || raw.toLowerCase() : "";
}

/** `name` split around each match of the folded query `q`, so "jose" marks "José". */
export function highlightParts(name: string, q: string): Array<{ text: string; match: boolean }> {
  const { folded, from } = foldIndexed(name);
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let found = q ? folded.indexOf(q) : -1;
  while (found !== -1) {
    const start = from[found];
    const next = found + q.length;
    // Up to where the next folded character starts: accents typed as their own character come along.
    const end = next < folded.length ? from[next] : name.length;
    if (start > cursor) parts.push({ text: name.slice(cursor, start), match: false });
    if (end > start) parts.push({ text: name.slice(start, end), match: true });
    cursor = Math.max(cursor, end);
    found = folded.indexOf(q, next);
  }
  if (cursor < name.length) parts.push({ text: name.slice(cursor), match: false });
  return parts;
}

/**
 * The names to show, in order. Up to the threshold: as the account lists them.
 * Above it: the active name first, then A to Z; while searching, the names
 * that start with the query before those that only contain it.
 */
export function orderNames(names: string[], activeName: string | null, query: string): string[] {
  const unique = [...new Set(names.filter(Boolean))];
  const q = foldQuery(query);
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
  // The order is set when the switcher opens: picking a name must not reshuffle
  // the list while the menu fades out. The check mark follows the live name.
  const [openedActive] = useState(activeName);
  const searchable = new Set(names.filter(Boolean)).size > NAME_SEARCH_THRESHOLD;
  const shown = useMemo(
    () => orderNames(names, openedActive, searchable ? query : ""),
    [names, openedActive, query, searchable]
  );
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const trimmed = query.trim();
  const q = foldQuery(query);
  const announcement =
    !searchable || !trimmed
      ? ""
      : shown.length === 0
        ? `No name matches “${trimmed}”.`
        : shown.length === 1
          ? "1 name matches."
          : `${shown.length} names match.`;

  // Up to the threshold the list keeps the account's order, so the active name
  // can sit below the fold: scroll it into view (the list only, not the page).
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!list || !row) return;
    const bottom = row.offsetTop + row.offsetHeight;
    if (bottom > list.clientHeight) list.scrollTop = bottom - list.clientHeight + row.offsetHeight / 2;
  }, []);

  const focusFirstRow = () => listRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keys that confirm or cancel an input method's composition belong to it.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
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
      {searchable && (
        // Mounted before the first keystroke, so screen readers pick up every change.
        <Box role="status" aria-live="polite" aria-atomic="true" sx={SR_ONLY}>
          {announcement}
        </Box>
      )}
      {searchable && trimmed && shown.length === 0 && (
        <Typography aria-hidden variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
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
          // In a phone sheet a swipe past the list's end scrolls the sheet on to the rows below.
          [`@media ${PHONE_MEDIA}`]: { overscrollBehavior: "auto" },
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
                  searchable && q
                    ? highlightParts(name, q).map((part, i) =>
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
