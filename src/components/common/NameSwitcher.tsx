/**
 * The account's names as a dropdown: a button showing the active name and its
 * avatar opens a list of every name, the active one first and checked, the
 * rest A to Z. With more than NAME_SEARCH_THRESHOLD names (Simon has 86) the
 * list gets a search field that filters as you type, ignoring case and
 * accents and matching anywhere in the name, with a match count.
 *
 * Desktop and medium layouts show the list in a popover under the button;
 * phones (< 600 px) and landscape frames (Hub's 703×201 at 844×390, where a
 * popover would scroll around a scrolling list) in a full-screen sheet. Avatars load only for rows that
 * scroll into view (NameAvatar → useLazyAvatarUrl).
 *
 * Keyboard: typing filters (from the field, or from a row: the key goes to the
 * field), ↓ moves from the field into the list, ↑ on the first row goes back,
 * Enter in the field picks the first match, Escape clears the query and then
 * closes. Adapted from Q-Share+'s NameSwitcher (never imported across apps).
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { useLayoutMode } from '../../layout/useLayoutMode';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { ResponsiveDialog } from './ResponsiveDialog';
import { NameAvatar } from './NameAvatar';

/** Above this many names the list gets a search field. */
export const NAME_SEARCH_THRESHOLD = 15;

const ROW_SX = { minHeight: 48 } as const;
/** Out of sight, still read out (the live match count in a short frame). */
const VISUALLY_HIDDEN_SX = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
/** 32 px avatars in MenuItem's icon column. */
const LEAD_SX = { minWidth: 0, width: 36, mr: 1.5, justifyContent: 'center' } as const;

/** One character in its case- and accent-free form ("Ä" → "a", "ς" → "σ"). */
function foldChar(char: string): string {
  return char
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/ς/g, 'σ');
}

/**
 * `text` folded for matching, plus where in `text` each folded character came
 * from, so a match found in the folded form can be highlighted in the original.
 */
function foldIndexed(text: string): { folded: string; from: number[] } {
  let folded = '';
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

/** `text` without case or accents, for matching. */
export const foldName = (text: string): string => foldIndexed(text).folded;

/** The query as matched; one that folds away entirely (a lone accent) is matched as typed. */
function foldQuery(query: string): string {
  const raw = query.trim();
  return raw ? foldName(raw) || raw.toLowerCase() : '';
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** `name` split around each match of the folded query `q`, so "jose" marks "José". */
export function highlightParts(name: string, q: string): Array<{ text: string; match: boolean }> {
  const { folded, from } = foldIndexed(name);
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  let found = q ? folded.indexOf(q) : -1;
  while (found !== -1) {
    const start = from[found];
    const next = found + q.length;
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
 * The names to show, in order: `first` (the active name) at the top, then A to
 * Z. With a query: only the names that contain it, ignoring case and accents,
 * those that start with it before those that only contain it, then A to Z.
 */
export function orderNames(names: string[], first: string | null, query = ''): string[] {
  const unique = [...new Set(names.filter(Boolean))];
  const q = foldQuery(query);
  if (!q) {
    const rest = unique.filter((n) => n !== first).sort(byName);
    return first && unique.includes(first) ? [first, ...rest] : rest;
  }
  const starts = (n: string) => (foldName(n).startsWith(q) ? 0 : 1);
  return unique.filter((n) => foldName(n).includes(q)).sort((a, b) => starts(a) - starts(b) || byName(a, b));
}

/** What the count line under the search field says. */
export function matchCountText(total: number, shown: number, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return `${total} names`;
  if (shown === 0) return `No name matches “${trimmed}”.`;
  return shown === 1 ? `1 of ${total} names matches.` : `${shown} of ${total} names match.`;
}

/**
 * A row above the names that is not a name (Settings → Footer's "All names
 * (default)"). Picking it calls onPick(''), and it is checked while the
 * active name is empty. Hidden while a search query is typed.
 */
export interface NameSwitcherLeadRow {
  label: string;
  /** Shown in the avatar column (and on the button while it is picked). */
  icon: ReactNode;
}

export interface NameSwitcherListProps {
  /** Every name the account owns. */
  names: string[];
  activeName: string | null;
  /** The active name's avatar URL when the caller already has it loaded. */
  activeAvatar?: string;
  onPick: (name: string) => void;
  /** Focus the search field (or, without one, the checked row) on mount. Not on phones: the keyboard would pop up. */
  autoFocus?: boolean;
  /** Height of the scrolling list; the search field stays above it. */
  maxListHeight?: number | string;
  /** Fill the parent's height, the list scrolling under a fixed search field (the phone sheet). */
  fill?: boolean;
  /** A short frame: tighter padding, and the match count only for screen readers. */
  compact?: boolean;
  /** A row above the names, picked as ''. */
  leadRow?: NameSwitcherLeadRow;
  /** A second line under a name (e.g. "Own footer"); none when it returns nothing. */
  secondaryText?: (name: string) => string | undefined;
}

/** The list itself, with its search field above NAME_SEARCH_THRESHOLD names. */
export function NameSwitcherList({
  names,
  activeName,
  activeAvatar,
  onPick,
  autoFocus = false,
  maxListHeight,
  fill = false,
  compact = false,
  leadRow,
  secondaryText,
}: NameSwitcherListProps) {
  const [query, setQuery] = useState('');
  // The order is set when the list opens: a pick must not reshuffle the rows
  // while the popover closes. The check mark follows the live name.
  const [openedActive] = useState(activeName);
  const total = new Set(names.filter(Boolean)).size;
  const searchable = total > NAME_SEARCH_THRESHOLD;
  const shown = useMemo(
    () => orderNames(names, openedActive, searchable ? query : ''),
    [names, openedActive, query, searchable]
  );
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const countId = useId();
  const q = searchable ? foldQuery(query) : '';

  useEffect(() => {
    if (!autoFocus || searchable) return;
    listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [autoFocus, searchable]);

  const rowsOf = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keys that confirm or cancel an input method's composition belong to it.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      rowsOf()[0]?.focus();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (shown[0]) onPick(shown[0]);
    } else if (event.key === 'Escape' && query) {
      // The first Escape clears the query; the next one reaches the popover and closes it.
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
    }
  };

  // Capture phase: MenuList's own handlers would already have moved focus.
  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!searchable) return;
    const rows = rowsOf();
    if (event.key === 'ArrowUp' && rows[0] && event.target === rows[0]) {
      // ↑ on the first row goes back to the search field instead of wrapping to the last row.
      event.preventDefault();
      event.stopPropagation();
      searchRef.current?.focus();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
      // Type-to-filter from a row: the character goes to the search field.
      const typed = event.key;
      event.preventDefault();
      event.stopPropagation();
      setQuery((current) => current + typed);
      searchRef.current?.focus();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, ...(fill ? { flex: 1 } : {}) }}>
      {searchable && (
        <Box sx={{ px: 1.5, pt: compact ? 0.75 : 1.5, pb: 0.5 }}>
          <TextField
            inputRef={searchRef}
            size="small"
            fullWidth
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={`Find one of your ${total} names`}
            autoComplete="off"
            slotProps={{
              htmlInput: {
                'aria-label': 'Find one of your names',
                'aria-controls': listId,
                'aria-describedby': countId,
                autoCapitalize: 'none',
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
                      onClick={() => {
                        setQuery('');
                        searchRef.current?.focus();
                      }}
                      sx={{ width: 44, height: 44 }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            // A 44 px field: the small input is 40 px.
            sx={{ '& .MuiInputBase-root': { minHeight: 44 } }}
          />
          {/* The count is the live region: mounted before the first keystroke, so every change is read out. */}
          <Typography
            id={countId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            variant="body2"
            color="text.secondary"
            sx={compact ? VISUALLY_HIDDEN_SX : { px: 0.5, pt: 0.75 }}
          >
            {matchCountText(total, shown.length, query)}
          </Typography>
        </Box>
      )}
      <MenuList
        ref={listRef}
        id={listId}
        aria-label="Your names"
        autoFocusItem={false}
        onKeyDownCapture={onListKey}
        sx={{
          maxHeight: maxListHeight,
          overflowY: maxListHeight || fill ? 'auto' : undefined,
          ...(fill ? { flex: 1, minHeight: 0 } : {}),
          overscrollBehavior: 'contain',
          py: 0.5,
        }}
      >
        {leadRow && !q && (
          <MenuItem
            role="menuitemradio"
            aria-checked={!activeName}
            selected={!activeName}
            aria-label={leadRow.label}
            onClick={() => onPick('')}
            sx={ROW_SX}
          >
            <ListItemIcon sx={LEAD_SX}>{leadRow.icon}</ListItemIcon>
            <ListItemText primary={leadRow.label} slotProps={{ primary: { noWrap: true } }} />
            {!activeName && <CheckIcon fontSize="small" sx={{ color: 'primary.main', ml: 1, flexShrink: 0 }} />}
          </MenuItem>
        )}
        {shown.map((name) => {
          const active = name === activeName;
          const secondary = secondaryText?.(name) || undefined;
          return (
            <MenuItem
              key={name}
              role="menuitemradio"
              aria-checked={active}
              selected={active}
              // The highlight splits the text into spans; the label keeps the name whole.
              aria-label={secondary ? `${name}, ${secondary}` : name}
              onClick={() => onPick(name)}
              sx={ROW_SX}
            >
              <ListItemIcon sx={LEAD_SX}>
                <NameAvatar name={name} size={32} known={active ? activeAvatar : undefined} />
              </ListItemIcon>
              <ListItemText
                primary={
                  q
                    ? highlightParts(name, q).map((part, i) =>
                        part.match ? (
                          <Box key={i} component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                            {part.text}
                          </Box>
                        ) : (
                          <span key={i}>{part.text}</span>
                        )
                      )
                    : name
                }
                secondary={secondary}
                slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
              />
              {active && <CheckIcon fontSize="small" sx={{ color: 'primary.main', ml: 1, flexShrink: 0 }} />}
            </MenuItem>
          );
        })}
      </MenuList>
    </Box>
  );
}

export interface NameSwitcherProps {
  names: string[];
  activeName: string | null;
  activeAvatar?: string;
  onPick: (name: string) => void;
  /** What the names are, for the button's accessible name and the sheet's title. */
  label?: string;
  /** The sheet's or popover's title, when "Switch <label>" does not read well. */
  title?: string;
  leadRow?: NameSwitcherLeadRow;
  secondaryText?: (name: string) => string | undefined;
}

/**
 * The dropdown: a button with the active name and its avatar that opens the
 * list in a popover, or in a full-screen sheet on phones.
 */
export function NameSwitcher({
  names,
  activeName,
  activeAvatar,
  onPick,
  label = 'Active mailbox',
  title: titleProp,
  leadRow,
  secondaryText,
}: NameSwitcherProps) {
  const isPhone = useLayoutMode() === 'phone';
  const landscape = useLandscapeFrame();
  const useSheet = isPhone || landscape;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);
  const close = () => setAnchor(null);
  const pick = (name: string) => {
    close();
    if (name !== activeName) onPick(name);
  };
  const title = titleProp || `Switch ${label.toLowerCase()}`;
  const leadPicked = Boolean(leadRow && !activeName);
  const shownName = activeName || (leadPicked ? leadRow!.label : '');

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${shownName || 'none'}. Change`}
        onClick={(event) => setAnchor(event.currentTarget)}
        startIcon={leadPicked ? leadRow!.icon : <NameAvatar name={activeName || '?'} size={28} known={activeAvatar} />}
        endIcon={<ExpandMoreIcon />}
        sx={{
          minHeight: 44,
          maxWidth: '100%',
          width: { xs: '100%', sm: 'auto' },
          minWidth: { sm: 260 },
          justifyContent: 'flex-start',
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 600,
          borderColor: 'divider',
          '& .MuiButton-endIcon': { ml: 'auto', pl: 1 },
        }}
      >
        <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shownName || 'Choose a name'}
        </Box>
      </Button>
      {useSheet ? (
        <ResponsiveDialog open={open} onClose={close} title={title} flush fullScreen>
          <NameSwitcherList
            names={names}
            activeName={activeName}
            activeAvatar={activeAvatar}
            onPick={pick}
            fill
            compact={landscape}
            leadRow={leadRow}
            secondaryText={secondaryText}
          />
        </ResponsiveDialog>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={close}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              role: 'dialog',
              'aria-label': title,
              sx: { width: Math.max(320, anchor?.offsetWidth ?? 0), maxWidth: 'calc(100vw - 32px)', mt: 0.5 },
            },
          }}
        >
          {open && (
            <NameSwitcherList
              names={names}
              activeName={activeName}
              activeAvatar={activeAvatar}
              onPick={pick}
              leadRow={leadRow}
              secondaryText={secondaryText}
              autoFocus
              maxListHeight="max(144px, min(420px, calc(var(--qmail-app-height, 100dvh) - 240px)))"
            />
          )}
        </Popover>
      )}
    </>
  );
}
