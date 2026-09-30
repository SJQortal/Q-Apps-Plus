import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { BottomSheet } from "../../components/common/mobile/BottomSheet";
import { useNarrowLayout } from "../../hooks/usePhoneLayout";
import { usePullToRefresh } from "../../hooks/usePullToRefresh";
import { RootState } from "../../state/store";
import { FileList } from "./FileList.tsx";
import { useFetchFiles } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { FiltersRail } from "./FileList-styles.tsx";
import { changefilterName, changefilterSearch } from "../../state/features/fileSlice.ts";
import { allCategoryData } from "../../constants/Categories/1stCategories.ts";
import { CategoryList, CategoryListRef } from "../../components/common/CategoryList/CategoryList.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";
import { QDN_PAGE } from "../../utils/qdnSearch.ts";
import { isNameHidden, useAppSettings } from "../../utils/settings.ts";

export type { SortOrder } from "../../utils/settings.ts";
import type { SortOrder } from "../../utils/settings.ts";

export const Home = () => {
  const phone = useNarrowLayout();
  const dispatch = useDispatch();
  const categoryListRef = useRef<CategoryListRef>(null);
  const files = useSelector((state: RootState) => state.file.files);
  const filterSearch = useSelector((state: RootState) => state.file.filterSearch);
  const filterName = useSelector((state: RootState) => state.file.filterName);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const listVersion = useSelector((state: RootState) => state.file.listVersion);
  const settings = useAppSettings();
  const [sort, setSort] = useState<SortOrder>(settings.defaultSort);
  const [following, setFollowing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);
  const requestId = useRef(0);
  const mounted = useRef(false);

  const { getFiles } = useFetchFiles();

  const runSearch = useCallback(
    async (reset: boolean, overrides: { name?: string; sort?: SortOrder; clear?: boolean; following?: boolean } = {}) => {
      // A next page waits for the one in flight; a reset (filters, sort, refresh)
      // always starts, and whatever was in flight is ignored when it lands.
      if (!reset && (isFetching.current || !hasMore)) return;
      const id = ++requestId.current;
      const current = () => id === requestId.current;
      isFetching.current = true;
      setIsLoading(true);
      setError(null);
      try {
        const count = await getFiles(
          {
            name: overrides.clear ? "" : (overrides.name ?? filterName),
            categories: overrides.clear ? [] : categoryListRef.current?.getSelectedCategories() || [],
            keywords: overrides.clear ? "" : filterSearch,
            sort: overrides.sort ?? sort,
            following: overrides.clear ? false : (overrides.following ?? following),
          },
          reset,
          undefined,
          undefined,
          current
        );
        if (!current()) return;
        setHasMore(count >= QDN_PAGE);
      } catch (e) {
        if (current()) setError("The list could not be loaded. Check that your node is running, then try again.");
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

  const hasFiles = files.length > 0;
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!hasFiles) queueMicrotask(() => void runSearch(true));
  }, [hasFiles, runSearch]);

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

  const showMine = () => {
    if (!username) return;
    dispatch(changefilterName(username));
    runSearch(true, { name: username });
  };

  const toggleFollowing = () => {
    const next = !following;
    setFollowing(next);
    runSearch(true, { following: next });
  };

  const visibleFiles = settings.hiddenNames.length
    ? files.filter((f) => !isNameHidden(f.user, settings))
    : files;

  const sortToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={sort}
      onChange={(_e, v) => changeSort(v)}
      aria-label="Sort order"
      sx={{ "& .MuiToggleButton-root": { minHeight: 40, px: 2 } }}
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
      <TextField
        size="small"
        label="Publisher name (exact)"
        value={filterName}
        onChange={(e) => dispatch(changefilterName(e.target.value))}
      />
      <CategoryList categoryData={allCategoryData} ref={categoryListRef} dense />
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

  const activeFilters = Boolean(filterSearch || filterName);

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
        <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters and sort">
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

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", "& .MuiChip-root": { minHeight: 36 } }}>
          <Typography component="h1" variant="h6" sx={{ fontWeight: 700, flex: "1 1 160px", minWidth: 0, wordBreak: "break-word" }}>
            {filterName ? `Shares by ${filterName}` : following ? "From names you follow" : "Latest shares"}
          </Typography>
          {phone && (
            <Button
              variant={activeFilters ? "contained" : "outlined"}
              size="small"
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              sx={{ minHeight: 40 }}
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
              variant={filterName === username ? "filled" : "outlined"}
              color={filterName === username ? "primary" : "default"}
              onClick={showMine}
              clickable
              aria-pressed={filterName === username}
            />
          )}
          {!phone && sortToggle}
        </Box>

        {error ? (
          <EmptyState title="Could not load shares" description={error} actionLabel="Retry" onAction={() => runSearch(true)} />
        ) : files.length === 0 && isLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={64} />
            ))}
          </Box>
        ) : files.length === 0 ? (
          <EmptyState
            title={following ? "Nothing from the names you follow yet" : activeFilters ? "No shares match these filters" : "No shares yet"}
            description={
              following
                ? "Follow a publisher from their profile and their shares appear here."
                : activeFilters
                ? "Try fewer filters or a different spelling."
                : username
                  ? "Be the first: use Share in the top bar to publish files."
                  : "Sign in to Hub with a Qortal name to share files."
            }
            actionLabel={activeFilters || following ? "Reset filters" : undefined}
            onAction={activeFilters || following ? resetFilters : undefined}
          />
        ) : (
          <>
            <FileList files={visibleFiles} />
            <LazyLoad onLoadMore={() => runSearch(false)} isLoading={isLoading} />
            {!hasMore && files.length > 0 && (
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
