import React, { useEffect } from "react";
import { styled } from "@mui/system";
import { Grid } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../state/store.ts";
import { useFetchFiles } from "../hooks/useFetchFiles.tsx";

export const StatsData = () => {
  const StatsCol = styled(Grid)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    width: "100%",
    padding: "20px 0px",
    backgroundColor: theme.palette.background.default,
  }));

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

  const totalVideosPublished = useSelector(
    (state: RootState) => state.global.totalFilesPublished
  );
  const totalNamesPublished = useSelector(
    (state: RootState) => state.global.totalNamesPublished
  );
  const videosPerNamePublished = useSelector(
    (state: RootState) => state.global.filesPerNamePublished
  );

  useEffect(() => {
    getFilesCount();
  }, [getFilesCount]);

  return (
    <StatsCol>
      <div>
        Shares:{" "}
        <span style={{ fontWeight: "bold" }}>{totalVideosPublished}</span>
      </div>
      <div>
        Publishers:{" "}
        <span style={{ fontWeight: "bold" }}>{totalNamesPublished}</span>
      </div>
      <div>
        Average:{" "}
        <span style={{ fontWeight: "bold" }}>
          {videosPerNamePublished > 0 &&
            Number(videosPerNamePublished).toFixed(0)}
        </span>
      </div>
    </StatsCol>
  );
};
