import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Avatar, Box, CircularProgress, Paper, Popper, TextField, Typography, type PopperProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ClearFieldButton } from "./ClearFieldButton";
import {
  NAME_SEARCH_DEBOUNCE_MS,
  avatarKnownMissing,
  cachedNameSearch,
  namesContaining,
  rankNameSuggestions,
  rememberMissingAvatar,
  searchNames,
  splitNameHighlight,
  suggestionAvatarUrl,
} from "../../utils/nameSearch";

interface NameSearchResult {
  query: string;
  names: string[];
  failed: boolean;
}

/**
 * Searches names for the text typed, NAME_SEARCH_DEBOUNCE_MS after the last
 * keystroke; a query this session already asked answers at once. An answer
 * to a query the field has moved on from is dropped.
 */
export function useNameSearch() {
  const [result, setResult] = useState<NameSearchResult>({ query: "", names: [], failed: false });
  const [pending, setPending] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const requestId = useRef(0);

  useEffect(() => {
    const requests = requestId;
    const debounce = timer;
    return () => {
      requests.current++;
      window.clearTimeout(debounce.current);
    };
  }, []);

  const cancel = useCallback(() => {
    requestId.current++;
    window.clearTimeout(timer.current);
    setPending(false);
  }, []);

  const search = useCallback((text: string) => {
    const id = ++requestId.current;
    window.clearTimeout(timer.current);
    const query = text.trim();
    const cached = query ? cachedNameSearch(query) : undefined;
    if (!query || cached) {
      if (cached) setResult({ query, names: cached, failed: false });
      setPending(false);
      return;
    }
    setPending(true);
    timer.current = window.setTimeout(() => {
      searchNames(query).then(
        (names) => {
          if (id !== requestId.current) return;
          setResult({ query, names, failed: false });
          setPending(false);
        },
        () => {
          if (id !== requestId.current) return;
          setResult({ query, names: [], failed: true });
          setPending(false);
        }
      );
    }, NAME_SEARCH_DEBOUNCE_MS);
  }, []);

  return { result, pending, search, cancel };
}

const NO_NAMES: string[] = [];

const srOnly = {
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

/**
 * The list's gap from the field. Above the field it clears the outlined
 * field's floating label too, which sits about 10 px above the field's box.
 */
export function suggestionListOffset({ placement }: { placement: string }): [number, number] {
  return [0, placement.startsWith("top") ? 14 : 4];
}

const POPPER_MODIFIERS: PopperProps["modifiers"] = [
  { name: "offset", options: { offset: suggestionListOffset } },
  { name: "preventOverflow", options: { padding: 8 } },
  // As wide as the field, on every update (the Hub pane or a phone can resize).
  {
    name: "sameWidth",
    enabled: true,
    phase: "beforeWrite",
    requires: ["computeStyles"],
    fn: ({ state }) => {
      state.styles.popper.width = `${state.rects.reference.width}px`;
    },
    effect: ({ state }) => {
      state.elements.popper.style.width = `${(state.elements.reference as HTMLElement).offsetWidth}px`;
    },
  },
];

export interface NameSuggestFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** A suggestion was chosen: the caller puts it in the field and applies it. */
  onPick: (name: string) => void;
  /** Names publishing in the list on screen: ranked up, and offered while the field is empty. */
  seenNames?: string[];
  /** Marks those names in the list, and heads it while the field is empty. */
  seenLabel?: string;
  /** The suggestion list's accessible name. */
  listLabel?: string;
  /** Accessible name of the ✕ that empties the field. */
  clearLabel?: string;
}

/**
 * A name field with a list of registered names that match what is typed,
 * after Torq's user search: debounced, ranked, the typed part highlighted,
 * each name with its avatar. An ARIA combobox: ↑/↓ move through the list,
 * Enter picks the highlighted name (or, with none, leaves the text to the
 * form), Escape closes the list and nothing else. The list is a Popper above
 * dialogs and bottom sheets, so a sheet's scrolling never clips it.
 */
export function NameSuggestField({
  label,
  value,
  onChange,
  onPick,
  seenNames = NO_NAMES,
  seenLabel = "In this list",
  listLabel = "Suggested names",
  clearLabel = "Clear the name",
}: NameSuggestFieldProps) {
  const theme = useTheme();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  // The list's scrolling box: avatars load as their rows scroll into it.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  // The highlighted suggestion, by name: an answer that reorders the list keeps it.
  const [activeName, setActiveName] = useState<string | null>(null);
  const { result, pending, search, cancel } = useNameSearch();

  const query = value.trim();
  const needle = query.toLowerCase();
  const current = result.query.toLowerCase() === needle;
  const suggestions = useMemo(() => {
    // An answer for what was typed before: the names in it that still match.
    const found = current ? result.names : namesContaining(result.names, query);
    return rankNameSuggestions([...namesContaining(seenNames, query), ...found], query, seenNames);
  }, [current, result, query, seenNames]);
  const seen = useMemo(() => new Set(seenNames.map((name) => name.toLowerCase())), [seenNames]);

  const expanded = open && suggestions.length > 0;
  const activeIndex = activeName === null ? -1 : suggestions.indexOf(activeName);
  const activeId = expanded && activeIndex >= 0 ? `${baseId}-option-${activeIndex}` : undefined;
  // With no names to list, the popup still says why once something is typed.
  const message =
    !open || suggestions.length > 0 || !query
      ? null
      : pending
        ? "Searching names…"
        : current && result.failed
          ? "Couldn't search names. Check that your node is running."
          : current
            ? "No names match"
            : null;
  const announcement =
    !open || pending
      ? ""
      : (message ?? (suggestions.length === 0 ? "" : suggestions.length === 1 ? "1 name suggested" : `${suggestions.length} names suggested`));

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const close = () => {
    setOpen(false);
    setActiveName(null);
  };

  const pick = (name: string) => {
    cancel();
    close();
    onPick(name);
  };

  const openList = () => {
    if (open) return;
    setOpen(true);
    // Closing dropped any search in flight; a failed one gets another try.
    if (query && (!current || result.failed)) search(query);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          openList();
          return;
        }
        if (!suggestions.length) return;
        // -1 is the text as typed: Up from the first name goes back to it.
        const next = Math.min(Math.max(activeIndex + (event.key === "ArrowDown" ? 1 : -1), -1), suggestions.length - 1);
        setActiveName(next < 0 ? null : suggestions[next]);
        return;
      }
      case "Enter":
        if (expanded && activeIndex >= 0) {
          event.preventDefault();
          pick(suggestions[activeIndex]);
          return;
        }
        // No name highlighted: the form searches for the text as typed.
        cancel();
        close();
        return;
      case "Escape":
        if (!expanded && message === null) return;
        // Only the list closes, not the sheet or dialog around the field.
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      case "Tab":
        close();
        return;
    }
  };

  return (
    <Box sx={{ position: "relative" }}>
      <TextField
        ref={setAnchor}
        fullWidth
        size="small"
        label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveName(null);
          search(event.target.value);
        }}
        onClick={openList}
        onKeyDown={onKeyDown}
        onBlur={() => {
          cancel();
          close();
        }}
        slotProps={{
          htmlInput: {
            role: "combobox",
            "aria-autocomplete": "list",
            "aria-expanded": expanded,
            "aria-controls": expanded ? listId : undefined,
            "aria-activedescendant": activeId,
            autoComplete: "off",
            autoCapitalize: "none",
            spellCheck: false,
            enterKeyHint: "search",
          },
          input: {
            endAdornment: value ? (
              <ClearFieldButton
                label={clearLabel}
                onClear={() => {
                  cancel();
                  close();
                  onChange("");
                }}
              />
            ) : undefined,
          },
        }}
      />
      <Box role="status" aria-live="polite" aria-atomic="true" sx={srOnly}>
        {announcement}
      </Box>
      <Popper
        open={Boolean(anchor) && (expanded || message !== null)}
        anchorEl={anchor}
        placement="bottom-start"
        modifiers={POPPER_MODIFIERS}
        // Fixed, not absolute: in Hub's frame the body is taller than the viewport,
        // and an absolute popper flipped above a field in the bottom sheet landed
        // off-screen (bottom: 0 of the page, not of the frame).
        popperOptions={{ strategy: "fixed" }}
        // Not a tooltip (Popper's default role): the listbox inside is what the field controls.
        role="presentation"
        sx={{ zIndex: theme.zIndex.modal + 1 }}
      >
        {/* The field keeps focus (and a phone its keyboard) while a name is tapped or the list scrolled. */}
        <Paper
          ref={setScroller}
          elevation={8}
          onMouseDown={(event) => event.preventDefault()}
          sx={{
            // Under half the frame, so it fits above or below the field even in a
            // landscape phone's 266 px Hub frame (Popper flips it to the side with room).
            maxHeight: "min(360px, 40dvh)",
            overflowY: "auto",
            overscrollBehavior: "contain",
            border: 1,
            borderColor: "divider",
          }}
        >
          {message ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 44, px: 2, py: 1 }}>
              {pending && <CircularProgress size={16} />}
              <Typography variant="body2" color="text.secondary">
                {message}
              </Typography>
            </Box>
          ) : (
            <>
              {!query && (
                <Typography
                  aria-hidden
                  sx={{ px: 2, pt: 1.25, pb: 0.25, fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "text.secondary" }}
                >
                  {seenLabel}
                </Typography>
              )}
              <Box component="ul" role="listbox" id={listId} aria-label={listLabel} sx={{ listStyle: "none", m: 0, p: 0.5 }}>
                {suggestions.map((name, index) => (
                  <SuggestionRow
                    key={name}
                    id={`${baseId}-option-${index}`}
                    name={name}
                    query={query}
                    active={index === activeIndex}
                    badge={query && seen.has(name.toLowerCase()) ? seenLabel : undefined}
                    scrollRoot={scroller}
                    onPick={pick}
                    onHover={setActiveName}
                  />
                ))}
              </Box>
            </>
          )}
        </Paper>
      </Popper>
    </Box>
  );
}

interface SuggestionRowProps {
  id: string;
  name: string;
  query: string;
  active: boolean;
  badge?: string;
  scrollRoot: Element | null;
  onPick: (name: string) => void;
  onHover: (name: string) => void;
}

function SuggestionRow({ id, name, query, active, badge, scrollRoot, onPick, onHover }: SuggestionRowProps) {
  return (
    <Box
      component="li"
      id={id}
      role="option"
      aria-selected={active}
      onClick={() => onPick(name)}
      onMouseMove={() => {
        if (!active) onHover(name);
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        minHeight: 44,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: active ? "action.selected" : "transparent",
        boxShadow: (t) => (active ? `inset 3px 0 0 ${t.palette.primary.main}` : "none"),
      }}
    >
      <SuggestionAvatar name={name} scrollRoot={scrollRoot} />
      <Typography component="span" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 14 }}>
        {splitNameHighlight(name, query).map((part, index) =>
          part.match ? (
            <Box key={index} component="mark" sx={{ bgcolor: "transparent", color: "primary.main", fontWeight: 700 }}>
              {part.text}
            </Box>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </Typography>
      {badge && (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {badge}
        </Typography>
      )}
    </Box>
  );
}

/**
 * True once `node` has been seen inside `root`'s scrolling box, and from then
 * on. Without IntersectionObserver, at once.
 */
function useSeenInside(root: Element | null, node: Element | null, skip: boolean): boolean {
  const [seen, setSeen] = useState(false);
  const observable = typeof IntersectionObserver !== "undefined";
  useEffect(() => {
    if (skip || seen || !observable || !root || !node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setSeen(true);
      },
      { root }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [skip, seen, observable, root, node]);
  return seen || !observable;
}

/**
 * The name's initial, covered by its avatar once that has loaded. The avatar
 * is asked for only when its row scrolls into the list's box. (MUI's Avatar
 * preloads its `src` with `new Image()` whatever `loading` says, so with a
 * `src` every row fetched at once, the hidden ones too.) A missing avatar
 * leaves the initial, and rows for that name don't ask again for a while.
 */
function SuggestionAvatar({ name, scrollRoot }: { name: string; scrollRoot: Element | null }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"waiting" | "loaded" | "missing">(() => (avatarKnownMissing(name) ? "missing" : "waiting"));
  const inView = useSeenInside(scrollRoot, node, status === "missing");
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <Avatar
      ref={setNode}
      aria-hidden
      sx={{ width: 28, height: 28, fontSize: 14, ...(status === "loaded" && { bgcolor: "transparent" }) }}
    >
      {status !== "loaded" && initial}
      {inView && status !== "missing" && (
        <Box
          component="img"
          src={suggestionAvatarUrl(name)}
          alt=""
          decoding="async"
          onLoad={() => setStatus("loaded")}
          onError={() => {
            rememberMissingAvatar(name);
            setStatus("missing");
          }}
          sx={{ position: "absolute", inset: 0, width: 1, height: 1, objectFit: "cover", opacity: status === "loaded" ? 1 : 0 }}
        />
      )}
    </Avatar>
  );
}
