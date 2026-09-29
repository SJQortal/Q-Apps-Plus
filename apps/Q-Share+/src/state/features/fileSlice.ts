import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";

interface GlobalState {
  files: Video[];
  filteredFiles: Video[];
  hashMapFiles: Record<string, Video>;
  countNewFiles: number;
  isFiltering: boolean;
  filterValue: string;
  filterType: string;
  filterSearch: string;
  filterName: string;
  selectedCategoryFiles: any[];
  editFileProperties: any;
  editPlaylistProperties: any;
}
const initialState: GlobalState = {
  files: [],
  filteredFiles: [],
  hashMapFiles: {},
  countNewFiles: 0,
  isFiltering: false,
  filterValue: "",
  filterType: "videos",
  filterSearch: "",
  filterName: "",
  selectedCategoryFiles: [null, null, null, null],
  editFileProperties: null,
  editPlaylistProperties: null,
};

export interface Video {
  title: string;
  description: string;
  created: number | string;
  user: string;
  service?: string;
  videoImage?: string;
  id: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  updated?: number | string;
  isValid?: boolean;
  code?: string;
}

export const fileSlice = createSlice({
  name: "file",
  initialState,
  reducers: {
    setEditFile: (state, action) => {
      state.editFileProperties = action.payload;
    },
    setEditPlaylist: (state, action) => {
      state.editPlaylistProperties = action.payload;
    },
    changeFilterType: (state, action) => {
      state.filterType = action.payload;
    },
    changefilterSearch: (state, action) => {
      state.filterSearch = action.payload;
    },
    changefilterName: (state, action) => {
      state.filterName = action.payload;
    },
    setCountNewFiles: (state, action) => {
      state.countNewFiles = action.payload;
    },
    addFiles: (state, action) => {
      state.files = action.payload;
    },
    addFilteredFiles: (state, action) => {
      state.filteredFiles = action.payload;
    },
    removeFile: (state, action) => {
      const idToDelete = action.payload;
      state.files = state.files.filter(item => item.id !== idToDelete);
      state.filteredFiles = state.filteredFiles.filter(
        item => item.id !== idToDelete
      );
    },
    addFileToBeginning: (state, action) => {
      state.files.unshift(action.payload);
    },
    clearFileList: state => {
      state.files = [];
    },
    updateFile: (state, action) => {
      const { id } = action.payload;
      const index = state.files.findIndex(video => video.id === id);
      if (index !== -1) {
        state.files[index] = { ...action.payload };
      }
      const index2 = state.filteredFiles.findIndex(video => video.id === id);
      if (index2 !== -1) {
        state.filteredFiles[index2] = { ...action.payload };
      }
    },
    addToHashMap: (state, action) => {
      const video = action.payload;
      state.hashMapFiles[video.id] = video;
    },
    updateInHashMap: (state, action) => {
      const { id } = action.payload;
      const video = action.payload;
      state.hashMapFiles[id] = { ...video };
    },
    removeFromHashMap: (state, action) => {
      const idToDelete = action.payload;
      delete state.hashMapFiles[idToDelete];
    },
    addArrayToHashMap: (state, action) => {
      const videos = action.payload;
      videos.forEach((video: Video) => {
        state.hashMapFiles[video.id] = video;
      });
    },
    upsertFiles: (state, action) => {
      action.payload.forEach((video: Video) => {
        const index = state.files.findIndex(p => p.id === video.id);
        if (index !== -1) {
          state.files[index] = video;
        } else {
          state.files.push(video);
        }
      });
    },
    upsertFilteredFiles: (state, action) => {
      action.payload.forEach((video: Video) => {
        const index = state.filteredFiles.findIndex(p => p.id === video.id);
        if (index !== -1) {
          state.filteredFiles[index] = video;
        } else {
          state.filteredFiles.push(video);
        }
      });
    },
    upsertFilesBeginning: (state, action) => {
      action.payload.reverse().forEach((video: Video) => {
        const index = state.files.findIndex(p => p.id === video.id);
        if (index !== -1) {
          state.files[index] = video;
        } else {
          state.files.unshift(video);
        }
      });
    },
    setIsFiltering: (state, action) => {
      state.isFiltering = action.payload;
    },
    setFilterValue: (state, action) => {
      state.filterValue = action.payload;
    },
    blockUser: (state, action) => {
      const username = action.payload;
      state.files = state.files.filter(item => item.user !== username);
    },
  },
});

export const {
  setCountNewFiles,
  addFiles,
  addFilteredFiles,
  removeFile,
  addFileToBeginning,
  updateFile,
  addToHashMap,
  updateInHashMap,
  removeFromHashMap,
  addArrayToHashMap,
  upsertFiles,
  upsertFilteredFiles,
  upsertFilesBeginning,
  setIsFiltering,
  setFilterValue,
  clearFileList,
  changeFilterType,
  changefilterSearch,
  changefilterName,
  blockUser,
  setEditFile,
  setEditPlaylist,
} = fileSlice.actions;

export default fileSlice.reducer;
