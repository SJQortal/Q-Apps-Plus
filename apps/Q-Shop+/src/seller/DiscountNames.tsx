/**
 * Who a discount is for (seller/DiscountDialog.tsx): Qortal names, suggested
 * as they're typed, as many as wanted (up to MAX_DISCOUNT_NAMES), and a
 * Q-Chat group's members added in one go (discounts/people.ts).
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Autocomplete, Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { autocompletePaperProps } from "../components/common/menuStyle";
import { useDebounced } from "../pages/Store/ProductList";
import { MAX_DISCOUNT_NAMES } from "../discounts/model";
import { NAME_SEARCH_MIN, allGroups, groupMemberNames, groupsOf, matchGroups, searchNames, type QortalGroup } from "../discounts/people";

/** `names` with `more` added, without repeats (names compare in any case), at most MAX_DISCOUNT_NAMES. */
export function mergeNames(names: readonly string[], more: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...names, ...more]) {
    const name = raw.trim();
    if (!name || name.length > 40 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.slice(0, MAX_DISCOUNT_NAMES);
}

function GroupDialog({ onAdd, onClose }: { onAdd: (group: QortalGroup, names: string[], note: string) => void; onClose: () => void }) {
  const address = useSelector((state: RootState) => state.auth.user?.address ?? "");
  const [input, setInput] = useState("");
  const typed = useDebounced(input.trim(), 250);
  const [mine, setMine] = useState<QortalGroup[]>([]);
  const [all, setAll] = useState<QortalGroup[] | null>(null);
  const [group, setGroup] = useState<QortalGroup | null>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void groupsOf(address).then(
      (groups) => alive && setMine(groups),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [address]);
  // Every group is read only once someone searches beyond their own.
  const searching = typed.length >= NAME_SEARCH_MIN;
  useEffect(() => {
    if (!searching || all) return;
    let alive = true;
    void allGroups().then(
      (groups) => alive && setAll(groups),
      () => alive && setAll([])
    );
    return () => {
      alive = false;
    };
  }, [searching, all]);
  const options = searching ? matchGroups([...mine, ...(all ?? []).filter((g) => !mine.some((m) => m.id === g.id))], typed).slice(0, 50) : mine;
  const add = async () => {
    if (!group) return;
    setReading(true);
    setProblem(null);
    try {
      const read = await groupMemberNames(group.id);
      if (read.names.length === 0) {
        setProblem("None of this group's members has a Qortal name.");
        return;
      }
      const parts = [`${read.names.length === 1 ? "1 name" : `${read.names.length} names`} from ${group.name}`];
      if (read.withoutName > 0) parts.push(`${read.withoutName === 1 ? "1 member has" : `${read.withoutName} members have`} no name`);
      if (read.truncated) parts.push("only its first 1,000 members were read");
      onAdd(group, read.names, parts.join("; "));
    } catch {
      setProblem("The group's members couldn't be read from your node. Try again in a moment.");
    } finally {
      setReading(false);
    }
  };
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Add a group's members"
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void add()} disabled={!group || reading}>
            {reading ? "Reading the members…" : "Add their names"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          The discount is for the members it has now, each by their Qortal name. Members who join later aren&apos;t added by themselves.
        </Typography>
        {/* Its list stays in the dialog (its landmark) but is placed "fixed", so this short dialog's scroll area doesn't cut it to two groups (Simon's Hub, 2026-10-26). */}
        <Autocomplete<QortalGroup>
          disablePortal
          options={options}
          value={group}
          onChange={(_, value) => setGroup(value)}
          inputValue={input}
          onInputChange={(_, value) => setInput(value)}
          getOptionLabel={(g) => g.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(list) => list}
          loading={searching && !all}
          loadingText="Reading the groups…"
          noOptionsText={searching ? "No group has that in its name." : "You're in no groups yet: type a group's name."}
          openOnFocus
          autoHighlight
          slotProps={{ paper: autocompletePaperProps, popper: { popperOptions: { strategy: "fixed" } } }}
          renderOption={(props, g) => {
            const { key, ...rest } = props as typeof props & { key: string };
            return (
              <Box component="li" key={key} {...rest} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                <span>{g.name}</span>
                <Typography component="span" variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {mine.some((m) => m.id === g.id) ? "Yours" : ""}
                  {g.memberCount !== undefined ? `${mine.some((m) => m.id === g.id) ? " · " : ""}${g.memberCount} members` : ""}
                </Typography>
              </Box>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Q-Chat group"
              placeholder="Your groups, or type a group's name"
              autoFocus
              slotProps={{
                ...params.slotProps,
                inputLabel: { ...params.slotProps.inputLabel, shrink: true },
                input: {
                  ...params.slotProps.input,
                  endAdornment: (
                    <>
                      {searching && !all && <CircularProgress size={18} aria-label="Reading the groups" />}
                      {params.slotProps.input.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
        {problem && (
          <Typography role="alert" color="error" variant="body2">
            {problem}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}

export function DiscountNamesField({
  names,
  onChange,
  onKnown,
  hidden,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  /** Names that came from the node's own lists (suggestions, a group): they needn't be checked again. */
  onKnown: (names: string[]) => void;
  /** Names set on another device this one can't read: how many. */
  hidden: number;
}) {
  const [input, setInput] = useState("");
  const typed = useDebounced(input.trim(), 250);
  const [hits, setHits] = useState<{ q: string; names: string[] }>({ q: "", names: [] });
  const [groupOpen, setGroupOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (typed.length < NAME_SEARCH_MIN) return;
    let alive = true;
    void searchNames(typed).then(
      (found) => alive && setHits({ q: typed, names: found }),
      () => alive && setHits({ q: typed, names: [] })
    );
    return () => {
      alive = false;
    };
  }, [typed]);
  const suggestions = typed.length >= NAME_SEARCH_MIN && hits.q === typed ? hits.names.filter((n) => !names.some((x) => x.toLowerCase() === n.toLowerCase())) : [];
  const full = names.length >= MAX_DISCOUNT_NAMES;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Autocomplete<string, true, false, true>
        multiple
        freeSolo
        disablePortal
        filterSelectedOptions
        options={suggestions}
        filterOptions={(list) => list}
        value={names}
        inputValue={input}
        onInputChange={(_, value, reason) => reason !== "reset" && setInput(value)}
        onChange={(_, value, reason, details) => {
          if (reason === "selectOption" && details?.option) onKnown([details.option]);
          onChange(mergeNames([], value));
          setInput("");
        }}
        limitTags={12}
        getLimitTagsText={(more) => `+${more} more`}
        noOptionsText="No name starts like that"
        // Placed "fixed", so the dialog's scroll area doesn't cut the suggestions off near its bottom.
        slotProps={{ paper: autocompletePaperProps, popper: { popperOptions: { strategy: "fixed" } } }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Only for these Qortal names (optional)"
            placeholder={names.length === 0 ? (hidden ? "Kept as they are" : "Type a name") : full ? "" : "Add another"}
            helperText={
              hidden && names.length === 0
                ? `Set on another device for ${hidden === 1 ? "one Qortal name" : `${hidden} Qortal names`}: add names to change it, or leave it to keep it.`
                : "Leave the code empty and their checkouts apply it by themselves. Press Enter after a name."
            }
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, maxLength: 40, autoComplete: "off", spellCheck: false },
              inputLabel: { ...params.slotProps.inputLabel, shrink: true },
            }}
          />
        )}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Button startIcon={<GroupsOutlinedIcon />} onClick={() => setGroupOpen(true)} disabled={full} sx={{ minHeight: 44 }}>
          Add a Q-Chat group&apos;s members
        </Button>
        {names.length > 1 && (
          <Button color="inherit" onClick={() => onChange([])} sx={{ minHeight: 44 }}>
            Remove all {names.length}
          </Button>
        )}
      </Box>
      {note && (
        <Typography variant="body2" color="text.secondary" role="status">
          {note}
        </Typography>
      )}
      {groupOpen && (
        <GroupDialog
          onClose={() => setGroupOpen(false)}
          onAdd={(_, more, text) => {
            const next = mergeNames(names, more);
            onKnown(more);
            onChange(next);
            const capped = next.length >= MAX_DISCOUNT_NAMES && names.length + more.length > MAX_DISCOUNT_NAMES;
            setNote(`Added ${text}.${capped ? ` A discount is for ${MAX_DISCOUNT_NAMES} names at most.` : ""}`);
            setGroupOpen(false);
          }}
        />
      )}
    </Box>
  );
}
