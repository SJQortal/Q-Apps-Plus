import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface GlobalState {
  isLoadingGlobal: boolean;
  downloads: any;
  userAvatarHash: Record<string, string>;
  publishNames: string[] | null;
  totalFilesPublished: number;
  totalNamesPublished: number;
  filesPerNamePublished: number;
}
const initialState: GlobalState = {
  isLoadingGlobal: false,
  downloads: {},
  userAvatarHash: {},
  publishNames: null,
  totalFilesPublished: null,
  totalNamesPublished: null,
  filesPerNamePublished: null,
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
    /** Drop one entry from the downloads list (it does not cancel a fetch). */
    removeDownload: (state, action: PayloadAction<string>) => {
      delete state.downloads[action.payload];
    },
    /** Drop every download whose status is READY. */
    clearFinishedDownloads: (state) => {
      for (const identifier of Object.keys(state.downloads)) {
        if (state.downloads[identifier]?.status?.status === "READY") {
          delete state.downloads[identifier];
        }
      }
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
    setTotalFilesPublished: (state, action) => {
      state.totalFilesPublished = action.payload;
    },
    setTotalNamesPublished: (state, action) => {
      state.totalNamesPublished = action.payload;
    },
    setFilesPerNamePublished: (state, action) => {
      state.filesPerNamePublished = action.payload;
    },
  },
});

export const {
  setIsLoadingGlobal,
  setAddToDownloads,
  updateDownloads,
  removeDownload,
  clearFinishedDownloads,
  setUserAvatarHash,
  addPublishNames,
  setTotalFilesPublished,
  setTotalNamesPublished,
  setFilesPerNamePublished,
} = globalSlice.actions;

export default globalSlice.reducer;
