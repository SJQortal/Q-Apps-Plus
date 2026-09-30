import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../../components/common/mobile/BottomSheet";
import { useNarrowLayout } from "../../hooks/usePhoneLayout";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { RootState } from "../../state/store";
import { FileGridSkeleton, FileList } from "./FileList.tsx";
import { useFetchFiles, useListedFiles } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { PageRetry } from "../../components/common/PageRetry.tsx";
import { FiltersRail } from "./FileList-styles.tsx";
import { changefilterName, changefilterSearch } from "../../state/features/fileSlice.ts";
import { allCategoryData } from "../../constants/Categories/1stCategories.ts";
import { CategoryList, CategoryListRef } from "../../components/common/CategoryList/CategoryList.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";
import { NameSuggestField } from "../../components/common/NameSuggestField.tsx";
import { QDN_PAGE } from "../../utils/qdnSearch.ts";
import { isNameHidden, useAppSettings } from "../../utils/settings.ts";
import { requestOpenPublish } from "../../constants/events.ts";

export type { SortOrder } from "../../utils/settings.ts";
import type { SortOrder } from "../../utils/settings.ts";

/** The filters a search ran with; the form fields may have changed since. */
interface AppliedFilters {
  name: string;
  keywords: string;
  categories: string[];
}

interface ListQuery {
  applied: AppliedFilters;
  sort: SortOrder;
  following: boolean;
  hasMore: boolean;
}

/**
 * The query behind state.file.files. Home remounts on Back with the rows still
 * in the store, and must show and page the same list, not its defaults.
 */
let listQuery: ListQuery | null = null;

/** The most specific category picked, e.g. "Music" for Audio › Music. */
export function categoryLabel(ids: string[]): string {
  let label = "";
  ids.forEach((id, index) => {
    if (!id) return;
    const options =
      index === 0 ? allCategoryData.category : allCategoryData.subCategories[index - 1]?.[ids[index - 1]];
    const match = options?.find((option) => option.id === +id);
    if (match) label = match.name;
  });
  return label;
}

export const Home = () => {
  const phone = useNarrowLayout();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const categoryListRef = useRef<CategoryListRef>(null);
  const files = useSelector((state: RootState) => state.file.files);
  const filterSearch = useSelector((state: RootState) => state.file.filterSearch);
  const filterName = useSelector((state: RootState) => state.file.filterName);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const listVersion = useSelector((state: RootState) => state.file.listVersion);
  const settings = useAppSettings();
  // Back on Home with rows still loaded: pick up the query that loaded them. A
  // Following list whose chip is gone (Following feed switched off in Settings,
  // or signed out) is not restored: it would page followed shares with no way
  // to turn that off. The default list loads over it instead.
  const [{ restored, reloadDefault }] = useState(() => {
    const query = files.length > 0 ? listQuery : null;
    const chipGone = Boolean(query?.following) && !(username && settings.followingFeed);
    return { restored: chipGone ? null : query, reloadDefault: chipGone };
  });
  const [sort, setSort] = useState<SortOrder>(restored?.sort ?? settings.defaultSort);
  const [following, setFollowing] = useState(restored?.following ?? false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // A next page failed: the rows stay, with a Retry for that page.
  const [pageError, setPageError] = useState(false);
  const [hasMore, setHasMore] = useState(restored?.hasMore ?? true);
  const [applied, setApplied] = useState<AppliedFilters>(
    () => restored?.applied ?? { name: filterName, keywords: filterSearch, categories: [] }
  );
  // The same, for next-page loads, which must not pick up edits that weren't applied.
  const appliedRef = useRef(applied);
  const isFetching = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);
  // Holds the list's rows, for Retry to move focus to the first row its page adds.
  const listColumn = useRef<HTMLDivElement>(null);
  // A new one for each new list (filters, sort, refresh), so paging starts a fresh budget.
  const [listId, setListId] = useState(0);

  const { getFiles, queueBodies } = useFetchFiles();

  const runSearch = useCallback(
    async (reset: boolean, overrides: { name?: string; sort?: SortOrder; clear?: boolean; following?: boolean } = {}) => {
      // A next page waits for the one in flight; a reset (filters, sort, refresh)
      // always starts, and whatever was in flight is ignored when it lands.
      if (!reset && (isFetching.current || !hasMore)) return;
      const id = ++requestId.current;
      const current = () => id === requestId.current;
      if (reset) setListId((n) => n + 1);
      isFetching.current = true;
      setIsLoading(true);
      setError(null);
      setPageError(false);
      const filters: AppliedFilters = reset
        ? {
            name: overrides.clear ? "" : (overrides.name ?? filterName),
            keywords: overrides.clear ? "" : filterSearch,
            categories: overrides.clear ? [] : (categoryListRef.current?.getSelectedCategories() ?? []),
          }
        : appliedRef.current;
      if (reset) {
        appliedRef.current = filters;
        setApplied(filters);
      }
      const listSort = overrides.sort ?? sort;
      const listFollowing = overrides.clear ? false : (overrides.following ?? following);
      try {
        const count = await getFiles({ ...filters, sort: listSort, following: listFollowing }, reset, undefined, undefined, current);
        if (!current()) return;
        const more = count >= QDN_PAGE;
        setHasMore(more);
        // Only once its rows are in the store: a reset that fails leaves the old list, and its query.
        if (reset) listQuery = { applied: filters, sort: listSort, following: listFollowing, hasMore: more };
        else if (listQuery) listQuery = { ...listQuery, hasMore: more };
      } catch (e) {
        // A failed reset takes the whole list: the old rows still in the store don't
        // belong under the new heading. A failed next page keeps the rows it follows.
        if (!current()) return;
        if (reset) setError("The list could not be loaded. Check that your node is running, then try again.");
        else setPageError(true);
      } finally {
        if (current()) {
          isFetching.current = false;
          setIsLoading(false);
        }
      }
    },
    [getFiles, filterName, filterSearch, sort, following, hasMore]
  );

  const { pull, refreshing } = usePullToRefresh(() => runSearch(true), true);

  // The picker starts on the applied categories: one that mounts again (Back, or
  // the layout crossing 900 px) matches the list on screen, which later searches read.
  const pickerCategories = applied.categories.some(Boolean) ? applied.categories : undefined;

  const hasFiles = files.length > 0;
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!hasFiles) queueMicrotask(() => void runSearch(true));
    else if (reloadDefault) queueMicrotask(() => void runSearch(true, { following: false }));
    // Back on Home: rows whose name was hidden when they loaded (and un-hidden
    // in Settings since) still need their body.
    else queueBodies(files, false);
  }, [hasFiles, reloadDefault, runSearch, queueBodies, files]);

  // Leaving Home drops the search in flight, so the rows in the store always
  // match listQuery when Home mounts again.
  useEffect(() => {
    const requests = requestId;
    return () => {
      requests.current++;
    };
  }, []);

  // A publish or update from this session: reload page one so the new share shows.
  const seenVersion = useRef(listVersion);
  useEffect(() => {
    if (seenVersion.current === listVersion) return;
    seenVersion.current = listVersion;
    isFetching.current = false;
    queueMicrotask(() => void runSearch(true));
  }, [listVersion, runSearch]);

  const resetFilters = () => {
    dispatch(changefilterSearch(""));
    dispatch(changefilterName(""));
    categoryListRef.current?.clearCategories();
    setSort(settings.defaultSort);
    setFollowing(false);
    runSearch(true, { clear: true, sort: settings.defaultSort, following: false });
  };

  const changeSort = (next: SortOrder | null) => {
    if (!next || next === sort) return;
    setSort(next);
    runSearch(true, { sort: next });
  };

  const mine = Boolean(username) && applied.name === username;
  const toggleMine = () => {
    if (!username) return;
    // Like Following, a second tap goes back to everyone's shares.
    const next = mine ? "" : username;
    dispatch(changefilterName(next));
    runSearch(true, { name: next });
  };

  const toggleFollowing = () => {
    const next = !following;
    setFollowing(next);
    runSearch(true, { following: next });
  };

  // Deleted shares ("D" bodies) and hidden names drop out of the list.
  const listedFiles = useListedFiles(files);
  // Memoized so the list's rows keep stable props across Home's own re-renders.
  const visibleFiles = useMemo(
    () => (settings.hiddenNames.length ? listedFiles.filter((f) => !isNameHidden(f.user, settings)) : listedFiles),
    [listedFiles, settings]
  );
  // Rows came back, but every one of them is from a hidden name.
  const hiddenAll = listedFiles.length > 0 && visibleFiles.length === 0;
  // The publishers on screen, in list order: they certainly have shares, so the
  // publisher field ranks them up and offers them before anything is typed.
  const seenPublishers = useMemo(() => [...new Set(visibleFiles.map((f) => f.user).filter(Boolean))], [visibleFiles]);

  // A suggested publisher applies at once; in the phone sheet it also closes the sheet.
  const pickPublisher = (name: string) => {
    dispatch(changefilterName(name));
    runSearch(true, { name });
    if (phone) setFiltersOpen(false);
  };

  const sortToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={sort}
      onChange={(_e, v) => changeSort(v)}
      aria-label="Sort order"
      sx={{
        // 44 px tap targets in the phone sheet; the desktop header keeps the compact size.
        "& .MuiToggleButton-root": { minHeight: phone ? 44 : 40, px: 2 },
      }}
    >
      <ToggleButton value="newest">Newest</ToggleButton>
      <ToggleButton value="oldest">Oldest</ToggleButton>
    </ToggleButtonGroup>
  );

  const filterForm = (
    <Box
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        runSearch(true);
        if (phone) setFiltersOpen(false);
      }}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      {phone && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>Sort</Typography>
          {sortToggle}
        </Box>
      )}
      <TextField
        size="small"
        label="Search titles"
        value={filterSearch}
        onChange={(e) => dispatch(changefilterSearch(e.target.value))}
      />
      <NameSuggestField
        label="Publisher name (exact)"
        value={filterName}
        onChange={(name) => dispatch(changefilterName(name))}
        onPick={pickPublisher}
        seenNames={seenPublishers}
        listLabel="Suggested publishers"
      />
      <CategoryList categoryData={allCategoryData} ref={categoryListRef} initialCategories={pickerCategories} dense />
      <Box sx={{ display: "flex", gap: 1, "& .MuiButton-root": { minHeight: 44 } }}>
        <Button type="submit" variant="contained" fullWidth>
          {phone ? "Apply" : "Search"}
        </Button>
        <Button
          type="button"
          variant="outlined"
          fullWidth
          onClick={() => {
            resetFilters();
            if (phone) setFiltersOpen(false);
          }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );

  const appliedCategory = categoryLabel(applied.categories);
  const categoriesOn = applied.categories.some(Boolean);
  const activeFilters = Boolean(applied.keywords || applied.name || categoriesOn);
  const heading = applied.name
    ? `Shares by ${applied.name}`
    : following
      ? "From names you follow"
      : appliedCategory
        ? `Shares in ${appliedCategory}`
        : activeFilters
          ? "Filtered shares"
          : "Latest shares";

  const emptyState: React.ComponentProps<typeof EmptyState> = following
    ? {
        title: "Nothing from the names you follow yet",
        description: "Follow a publisher from their profile and their shares appear here.",
        actionLabel: "Show latest shares",
        onAction: resetFilters,
      }
    : mine && !applied.keywords && !categoriesOn
      ? {
          title: "You haven't shared anything yet",
          description: "Files you share show up here.",
          actionLabel: "Share files",
          onAction: requestOpenPublish,
        }
      : activeFilters
        ? {
            title: "No shares match these filters",
            description: "Try fewer filters or a different spelling.",
            actionLabel: "Reset filters",
            onAction: resetFilters,
          }
        : username
          ? { title: "No shares yet", description: "Be the first to share files.", actionLabel: "Share files", onAction: requestOpenPublish }
          : { title: "No shares yet", description: "Sign in to Hub with a Qortal name to share files." };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: { xs: 2, md: 3 },
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: { xs: "12px 16px", md: "20px 24px" },
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {(pull > 0 || refreshing) && (
        <Box
          role="status"
          aria-live="polite"
          aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
          sx={{
            position: "fixed",
            top: `calc(56px + env(safe-area-inset-top, 0px) + ${Math.round(pull * 0.5)}px)`,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 20,
            pointerEvents: "none",
            opacity: refreshing ? 1 : Math.min(1, pull / 72),
            transition: "opacity 120ms ease",
          }}
        >
          <CircularProgress size={28} variant={refreshing ? "indeterminate" : "determinate"} value={Math.min(100, (pull / 72) * 100)} />
        </Box>
      )}
      {phone ? (
        // keepMounted: CategoryList holds the selected categories, and every later
        // page, refresh and chip reads them through categoryListRef.
        <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters and sort" keepMounted>
          {filterForm}
        </BottomSheet>
      ) : (
        <FiltersRail>
          <Typography sx={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "text.secondary" }}>
            Filters
          </Typography>
          {filterForm}
        </FiltersRail>
      )}

      <Box ref={listColumn} sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            columnGap: 1,
            rowGap: phone ? 1.5 : 1,
            flexWrap: "wrap",
            // Phones: 44 px chips with a 12 px row gap keep each tap target clear of the next.
            "& .MuiChip-root": phone ? { minHeight: 44, fontSize: 14, px: 0.5 } : { minHeight: 36 },
          }}
        >
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>
            {heading}
          </Typography>
          {phone && (
            <Button
              variant={activeFilters ? "contained" : "outlined"}
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              sx={{ minHeight: 44 }}
            >
              {activeFilters ? "Filters on" : "Filters"}
            </Button>
          )}
          {username && settings.followingFeed && (
            <Chip
              label="Following"
              variant={following ? "filled" : "outlined"}
              color={following ? "primary" : "default"}
              onClick={toggleFollowing}
              clickable
              aria-pressed={following}
            />
          )}
          {username && (
            <Chip
              label="My shares"
              variant={mine ? "filled" : "outlined"}
              color={mine ? "primary" : "default"}
              onClick={toggleMine}
              clickable
              aria-pressed={mine}
            />
          )}
          {!phone && sortToggle}
        </Box>

        {error ? (
          <EmptyState title="Could not load shares" description={error} actionLabel="Retry" onAction={() => runSearch(true)} />
        ) : files.length === 0 && (isLoading || hasMore) ? (
          // The first page's placeholders take the layout the rows will have.
          settings.listView === "grid" ? (
            <FileGridSkeleton count={6} label="Loading shares" />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={64} />
              ))}
            </Box>
          )
        ) : visibleFiles.length === 0 && !hasMore && !isLoading && hiddenAll ? (
          <EmptyState
            icon={<VisibilityOffOutlinedIcon />}
            title="Every share here is from a name you hid"
            description="You can show those names again in Settings."
            actionLabel="Open Settings"
            onAction={() => navigate("/settings")}
          />
        ) : visibleFiles.length === 0 && !hasMore && !isLoading ? (
          <EmptyState {...emptyState} />
        ) : (
          <>
            {hiddenAll && (
              <Typography role="status" variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>
                Every share loaded so far is from a name you hid in Settings.
              </Typography>
            )}
            <FileList files={visibleFiles} />
            {/* hasMore lets it keep paging while hidden names leave the end of the list in view.
                A failed page stops the pager (it would retry at once, up to five times) until Retry. */}
            <LazyLoad key={listId} onLoadMore={() => runSearch(false)} isLoading={isLoading} hasMore={hasMore && !pageError} />
            <PageRetry failed={pageError} onRetry={() => runSearch(false)} rows={listColumn} />
            {!hasMore && visibleFiles.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 1 }}>
                That's every share that matches.
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
