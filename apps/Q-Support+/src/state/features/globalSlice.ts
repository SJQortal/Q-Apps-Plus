import { createSlice } from "@reduxjs/toolkit";
import { FeePrice } from "../../constants/PublishFees/FeePricePublish/FeePricePublish.ts";

interface GlobalState {
  isLoadingGlobal: boolean;
  downloads: any;
  userAvatarHash: Record<string, string>;
  publishNames: string[] | null;
  videoPlaying: any | null;
  totalFilesPublished: number;
  totalNamesPublished: number;
  filesPerNamePublished: number;
  feeData: FeePrice[];
}
const initialState: GlobalState = {
  isLoadingGlobal: false,
  downloads: {},
  userAvatarHash: {},
  publishNames: null,
  videoPlaying: null,
  totalFilesPublished: null,
  totalNamesPublished: null,
  filesPerNamePublished: null,
  feeData: [],
};

export const globalSlice = createSlice({
  name: "global",
  initialState,
  reducers: {
    setIsLoadingGlobal: (state, action) => {
      state.isLoadingGlobal = action.payload;
    },
    setAddToDownloads: (state, action) => {
      const download = action.payload;
      state.downloads[download.identifier] = download;
    },
    updateDownloads: (state, action) => {
      const { identifier } = action.payload;
      const download = action.payload;
      state.downloads[identifier] = {
        ...state.downloads[identifier],
        ...download,
      };
    },
    setUserAvatarHash: (state, action) => {
      const avatar = action.payload;
      if (avatar?.name && avatar?.url) {
        state.userAvatarHash[avatar?.name] = avatar?.url;
      }
    },
    addPublishNames: (state, action) => {
      state.publishNames = action.payload;
    },
    setVideoPlaying: (state, action) => {
      state.videoPlaying = action.payload;
    },
    setTotalFilesPublished: (state, action) => {
      state.totalFilesPublished = action.payload;
    },
    setTotalNamesPublished: (state, action) => {
      state.totalNamesPublished = action.payload;
    },
    setFilesPerNamePublished: (state, action) => {
      state.filesPerNamePublished = action.payload;
    },
    setFeeData: (state, action) => {
      state.feeData = action.payload;
    },
  },
});

export const {
  setIsLoadingGlobal,
  setAddToDownloads,
  updateDownloads,
  setUserAvatarHash,
  addPublishNames,
  setVideoPlaying,
  setTotalFilesPublished,
  setTotalNamesPublished,
  setFilesPerNamePublished,
  setFeeData,
} = globalSlice.actions;

export default globalSlice.reducer;
