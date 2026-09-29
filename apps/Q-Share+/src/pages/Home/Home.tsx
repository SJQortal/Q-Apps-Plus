import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import FilterListIcon from "@mui/icons-material/FilterList";
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

export type SortOrder = "newest" | "oldest";

export const Home = () => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("md"));
  const dispatch = useDispatch();
  const categoryListRef = useRef<CategoryListRef>(null);
  const files = useSelector((state: RootState) => state.file.files);
  const filterSearch = useSelector((state: RootState) => state.file.filterSearch);
  const filterName = useSelector((state: RootState) => state.file.filterName);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const listVersion = useSelector((state: RootState) => state.file.listVersion);
  const [sort, setSort] = useState<SortOrder>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const isFetching = useRef(false);
  const mounted = useRef(false);

  const { getFiles } = useFetchFiles();

  const runSearch = useCallback(
    async (reset: boolean, overrides: { name?: string; sort?: SortOrder; clear?: boolean } = {}) => {
      if (isFetching.current) return;
      if (!reset && !hasMore) return;
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
          },
          reset
        );
        setHasMore(count >= QDN_PAGE);
      } catch (e) {
        setError("The list could not be loaded. Check that your node is running, then try again.");
      } finally {
        isFetching.current = false;
        setIsLoading(false);
      }
    },
    [getFiles, filterName, filterSearch, sort, hasMore]
  );

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (files.length === 0) runSearch(true);
  }, [files.length, runSearch]);

  // A publish or update from this session: reload page one so the new share shows.
  const seenVersion = useRef(listVersion);
  useEffect(() => {
    if (seenVersion.current === listVersion) return;
    seenVersion.current = listVersion;
    isFetching.current = false;
    runSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listVersion]);

  const resetFilters = () => {
    dispatch(changefilterSearch(""));
    dispatch(changefilterName(""));
    categoryListRef.current?.clearCategories();
    setSort("newest");
    runSearch(true, { clear: true, sort: "newest" });
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
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button type="submit" variant="contained" fullWidth>
          Search
        </Button>
        <Button type="button" variant="outlined" fullWidth onClick={resetFilters}>
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
      <FiltersRail>
        {phone ? (
          <>
            <Button
              variant={filtersOpen ? "contained" : "outlined"}
              startIcon={<FilterListIcon />}
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="home-filters"
            >
              {filtersOpen ? "Hide filters" : activeFilters ? "Filters (on)" : "Filters"}
            </Button>
            <Collapse in={filtersOpen} id="home-filters">
              {filterForm}
            </Collapse>
          </>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "text.secondary" }}>
              Filters
            </Typography>
            {filterForm}
          </>
        )}
      </FiltersRail>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, minWidth: 120 }}>
            {filterName ? `Shares by ${filterName}` : "Latest shares"}
          </Typography>
          {username && (
            <Chip
              label="My shares"
              variant={filterName === username ? "filled" : "outlined"}
              color={filterName === username ? "primary" : "default"}
              onClick={showMine}
              clickable
            />
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={sort}
            onChange={(_e, v) => changeSort(v)}
            aria-label="Sort order"
          >
            <ToggleButton value="newest">Newest</ToggleButton>
            <ToggleButton value="oldest">Oldest</ToggleButton>
          </ToggleButtonGroup>
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
            title={activeFilters ? "No shares match these filters" : "No shares yet"}
            description={
              activeFilters
                ? "Try fewer filters or a different spelling."
                : username
                  ? "Be the first: use Share in the top bar to publish files."
                  : "Sign in to Hub with a Qortal name to share files."
            }
            actionLabel={activeFilters ? "Reset filters" : undefined}
            onAction={activeFilters ? resetFilters : undefined}
          />
        ) : (
          <>
            <FileList files={files} />
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
