import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, InputAdornment, Skeleton, TextField, Typography } from "@mui/material";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { ClearFieldButton } from "../../components/common/ClearFieldButton";
import { EmptyState } from "../../components/common/EmptyState";
import LazyLoad from "../../components/common/LazyLoad";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import type { RootState } from "../../state/store";
import { isEmptyCollection } from "../../utils/collectionFolders";
import { collectionKey } from "../../utils/collections";
import { isNameHidden, useAppSettings } from "../../utils/settings";
import { CollectionCard } from "./CollectionsPage";
import { CardList } from "./Collections-styles";
import { useCollectionList } from "./useCollectionList";

/** How long typing pauses before the search runs, in ms (Enter runs it at once). */
export const EXPLORE_SEARCH_DELAY_MS = 400;

interface ExploreCollectionsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Everyone else's collections, newest first, with a search of their own:
 * one paged collection search per query (Core's `query` looks in the title,
 * description and name), cached for the session like every search. Your own
 * collections, hidden names and deleted (emptied) collections are left out.
 */
export default function ExploreCollectionsDialog({ open, onClose }: ExploreCollectionsDialogProps) {
  const phone = usePhoneLayout();
  const user = useSelector((state: RootState) => state.auth.user);
  const byKey = useSelector((state: RootState) => state.collections.byKey);
  const settings = useAppSettings();
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");

  // Typing pauses, then the search runs.
  useEffect(() => {
    const next = typed.trim();
    if (next === query) return;
    const timer = window.setTimeout(() => setQuery(next), EXPLORE_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [typed, query]);

  const { rows, loading, error, complete, loadMore, reload } = useCollectionList(undefined, query);
  const mine = useMemo(
    () =>
      new Set(
        [user?.name, ...(user?.names ?? []).map((record) => record.name)]
          .filter((name): name is string => Boolean(name))
          .map((name) => name.toLowerCase())
      ),
    [user]
  );
  const visible = rows.filter((row) => {
    if (mine.has(row.name.toLowerCase()) || isNameHidden(row.name, settings)) return false;
    const known = byKey[collectionKey(row.name, row.identifier)];
    return !known || !isEmptyCollection(known);
  });

  const clear = () => {
    setTyped("");
    setQuery("");
  };

  const search = (
    <Box
      component="form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        setQuery(typed.trim());
      }}
    >
      <TextField
        fullWidth
        size="small"
        label="Search collections"
        placeholder="Title, description or name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        // On phones the keyboard would cover the list before anyone asked for it.
        autoFocus={!phone}
        slotProps={{
          htmlInput: { enterKeyHint: "search" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: typed ? <ClearFieldButton label="Clear the collection search" onClear={clear} /> : undefined,
          },
        }}
      />
    </Box>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <CardList aria-busy="true" aria-label="Loading collections">
        {[0, 1, 2, 3].map((n) => (
          <li key={n}>
            <Skeleton variant="rounded" sx={{ width: "100%", height: 84 }} />
          </li>
        ))}
      </CardList>
    );
  } else if (error) {
    body = (
      <EmptyState
        title="Couldn't load collections"
        description="Check that your node is running, then try again."
        actionLabel="Retry"
        onAction={() => {
          void reload();
        }}
      />
    );
  } else if (visible.length === 0 && complete) {
    body = query ? (
      <EmptyState
        icon={<SearchIcon />}
        title={`No collections match “${query}”`}
        description="Try another word, or part of a name."
        actionLabel="Clear search"
        onAction={clear}
      />
    ) : (
      <EmptyState
        icon={<CollectionsBookmarkOutlinedIcon />}
        title="No collections by others yet"
        description="A collection is a public list of shares. Anyone can make one with the bookmark on a share."
      />
    );
  } else {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {visible.length > 0 ? (
          <CardList aria-label={query ? `Collections matching ${query}` : "Collections by others"}>
            {visible.map((row) => (
              <CollectionCard key={collectionKey(row.name, row.identifier)} row={row} onOpen={onClose} />
            ))}
          </CardList>
        ) : null}
        {complete ? (
          <Typography variant="body2" color="text.secondary" align="center">
            {query ? "That's every match." : "That's every collection."}
          </Typography>
        ) : (
          <LazyLoad onLoadMore={loadMore} />
        )}
      </Box>
    );
  }

  return (
    <ResponsiveDialog open={open} onClose={onClose} title="Explore collections" header={search} maxWidth="md" tall>
      {body}
    </ResponsiveDialog>
  );
}
