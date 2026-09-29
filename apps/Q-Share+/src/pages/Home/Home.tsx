import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { FileList } from "./FileList.tsx";
import { Box, Button, Grid, Input, useTheme } from "@mui/material";
import { useFetchFiles } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { FiltersCol, FiltersContainer } from "./FileList-styles.tsx";
import { SubtitleContainer } from "./Home-styles";
import {
  changefilterName,
  changefilterSearch,
  changeFilterType,
} from "../../state/features/fileSlice.ts";
import { allCategoryData } from "../../constants/Categories/1stCategories.ts";
import {
  CategoryList,
  CategoryListRef,
} from "../../components/common/CategoryList/CategoryList.tsx";
import { StatsData } from "../../components/StatsData.tsx";

interface HomeProps {
  mode?: string;
}
export const Home = ({ mode }: HomeProps) => {
  const theme = useTheme();
  const prevVal = useRef("");
  const categoryListRef = useRef<CategoryListRef>(null);
  const isFiltering = useSelector((state: RootState) => state.file.isFiltering);
  const filterValue = useSelector((state: RootState) => state.file.filterValue);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const filterType = useSelector((state: RootState) => state.file.filterType);
  const totalFilesPublished = useSelector(
    (state: RootState) => state.global.totalFilesPublished
  );
  const totalNamesPublished = useSelector(
    (state: RootState) => state.global.totalNamesPublished
  );
  const filesPerNamePublished = useSelector(
    (state: RootState) => state.global.filesPerNamePublished
  );
  const setFilterType = payload => {
    dispatch(changeFilterType(payload));
  };
  const filterSearch = useSelector(
    (state: RootState) => state.file.filterSearch
  );

  const setFilterSearch = payload => {
    dispatch(changefilterSearch(payload));
  };
  const filterName = useSelector((state: RootState) => state.file.filterName);

  const setFilterName = payload => {
    dispatch(changefilterName(payload));
  };

  const isFilterMode = useRef(false);
  const firstFetch = useRef(false);
  const afterFetch = useRef(false);
  const isFetchingFiltered = useRef(false);
  const isFetching = useRef(false);

  const countNewFiles = useSelector(
    (state: RootState) => state.file.countNewFiles
  );
  const userAvatarHash = useSelector(
    (state: RootState) => state.global.userAvatarHash
  );

  const { files: globalVideos } = useSelector((state: RootState) => state.file);

  const setSelectedCategoryFiles = payload => {};

  const dispatch = useDispatch();
  const filteredFiles = useSelector(
    (state: RootState) => state.file.filteredFiles
  );

  const {
    getFiles,
    checkAndUpdateFile,
    getFile,
    hashMapFiles,
    getNewFiles,
    checkNewFiles,
    getFilesFiltered,
    getFilesCount,
  } = useFetchFiles();

  const getFilesHandler = React.useCallback(
    async (reset?: boolean, resetFilers?: boolean) => {
      if (!firstFetch.current || !afterFetch.current) return;
      if (isFetching.current) return;
      isFetching.current = true;
      const selectedCategories =
        categoryListRef.current.getSelectedCategories() || [];

      await getFiles(
        {
          name: filterName,
          categories: selectedCategories,
          keywords: filterSearch,
          type: filterType,
        },
        reset,
        resetFilers
      );
      isFetching.current = false;
    },
    [
      getFiles,
      filterValue,
      getFilesFiltered,
      isFiltering,
      filterName,
      filterSearch,
      filterType,
    ]
  );

  const searchOnEnter = e => {
    if (e.keyCode == 13) {
      getFilesHandler(true);
    }
  };

  useEffect(() => {
    if (isFiltering && filterValue !== prevVal?.current) {
      prevVal.current = filterValue;
      getFilesHandler();
    }
  }, [filterValue, isFiltering, filteredFiles, getFilesCount]);

  const getFilesHandlerMount = React.useCallback(async () => {
    if (firstFetch.current) return;
    firstFetch.current = true;
    setIsLoading(true);

    await getFiles();
    afterFetch.current = true;
    isFetching.current = false;

    setIsLoading(false);
  }, [getFiles]);

  let videos = globalVideos;

  if (isFiltering) {
    videos = filteredFiles;
    isFilterMode.current = true;
  } else {
    isFilterMode.current = false;
  }

  // const interval = useRef<any>(null);

  // const checkNewVideosFunc = useCallback(() => {
  //   let isCalling = false;
  //   interval.current = setInterval(async () => {
  //     if (isCalling || !firstFetch.current) return;
  //     isCalling = true;
  //     await checkNewVideos();
  //     isCalling = false;
  //   }, 30000); // 1 second interval
  // }, [checkNewVideos]);

  // useEffect(() => {
  //   if (isFiltering && interval.current) {
  //     clearInterval(interval.current);
  //     return;
  //   }
  //   checkNewVideosFunc();

  //   return () => {
  //     if (interval?.current) {
  //       clearInterval(interval.current);
  //     }
  //   };
  // }, [mode, checkNewVideosFunc, isFiltering]);

  useEffect(() => {
    if (
      !firstFetch.current &&
      !isFilterMode.current &&
      globalVideos.length === 0
    ) {
      isFetching.current = true;
      getFilesHandlerMount();
    } else {
      firstFetch.current = true;
      afterFetch.current = true;
    }
  }, [getFilesHandlerMount, globalVideos]);

  const filtersToDefault = async () => {
    setFilterType("videos");
    setFilterSearch("");
    setFilterName("");
    categoryListRef.current?.clearCategories();

    ReactDOM.flushSync(() => {
      getFilesHandler(true, true);
    });
  };

  return (
    <Grid container sx={{ width: "100%" }}>
      <FiltersCol item xs={12} md={2} sm={3}>
        <FiltersContainer>
          <StatsData />
          <Input
            id="standard-adornment-name"
            onChange={e => {
              setFilterSearch(e.target.value);
            }}
            onKeyDown={searchOnEnter}
            value={filterSearch}
            placeholder="Search"
            sx={{
              borderBottom: "1px solid white",
              "&&:before": {
                borderBottom: "none",
              },
              "&&:after": {
                borderBottom: "none",
              },
              "&&:hover:before": {
                borderBottom: "none",
              },
              "&&.Mui-focused:before": {
                borderBottom: "none",
              },
              "&&.Mui-focused": {
                outline: "none",
              },
              fontSize: "18px",
            }}
          />
          <Input
            id="standard-adornment-name"
            onChange={e => {
              setFilterName(e.target.value);
            }}
            onKeyDown={searchOnEnter}
            value={filterName}
            placeholder="User's Name (Exact)"
            sx={{
              marginTop: "20px",
              borderBottom: "1px solid white",
              "&&:before": {
                borderBottom: "none",
              },
              "&&:after": {
                borderBottom: "none",
              },
              "&&:hover:before": {
                borderBottom: "none",
              },
              "&&.Mui-focused:before": {
                borderBottom: "none",
              },
              "&&.Mui-focused": {
                outline: "none",
              },
              fontSize: "18px",
            }}
          />
          <CategoryList categoryData={allCategoryData} ref={categoryListRef} />

          <Button
            onClick={() => {
              filtersToDefault();
            }}
            sx={{
              marginTop: "20px",
            }}
            variant="contained"
          >
            reset
          </Button>
          <Button
            onClick={() => {
              getFilesHandler(true);
            }}
            sx={{
              marginTop: "20px",
            }}
            variant="contained"
          >
            Search
          </Button>
        </FiltersContainer>
      </FiltersCol>
      <Grid item xs={12} md={10} sm={9}>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "20px",
          }}
        >
          <SubtitleContainer
            sx={{
              justifyContent: "flex-start",
              paddingLeft: "15px",
              width: "100%",
              maxWidth: "1400px",
            }}
          ></SubtitleContainer>
          <FileList files={videos} />
          <LazyLoad
            onLoadMore={getFilesHandler}
            isLoading={isLoading}
          ></LazyLoad>
        </Box>
      </Grid>
    </Grid>
  );
};
