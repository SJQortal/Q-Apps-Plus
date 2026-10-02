import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface GlobalState {
  files: Video[];
  filteredFiles: Video[];
  hashMapFiles: Record<string, Video>;
  /**
   * Bodies from a second name under an identifier whose hashMapFiles slot
   * already holds another name's body, by shareKey. Read both through heldShare.
   */
  reusedIdFiles: Record<string, Video>;
  /** Shares (shareKey) whose JSON body could not be fetched after every retry (not on this node yet). */
  unavailableFiles: Record<string, true>;
  countNewFiles: number;
  isFiltering: boolean;
  filterValue: string;
  filterType: string;
  filterSearch: string;
  filterName: string;
  selectedCategoryFiles: any[];
  editFileProperties: any;
  editPlaylistProperties: any;
  /** Bumped after a publish or update so lists know to refresh. */
  listVersion: number;
}
const initialState: GlobalState = {
  files: [],
  filteredFiles: [],
  hashMapFiles: {},
  reusedIdFiles: {},
  unavailableFiles: {},
  countNewFiles: 0,
  isFiltering: false,
  filterValue: "",
  filterType: "videos",
  filterSearch: "",
  filterName: "",
  selectedCategoryFiles: [null, null, null, null],
  editFileProperties: null,
  editPlaylistProperties: null,
  listVersion: 0,
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
  /** The body was not a JSON object ("D", "\n"): the publisher deleted the share. */
  deleted?: boolean;
  code?: string;
}

/** Qortal names are unique whatever their case: "PixelMage" and "pixelmage" are one name. */
export const sameName = (a: unknown, b: unknown): boolean =>
  typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

/** One publisher's share: any name can publish a DOCUMENT under another name's identifier. */
export const shareKey = (user: string | undefined, id: string): string =>
  JSON.stringify([user?.toLowerCase() ?? "", id]);

/** Where share bodies are held (the file slice, or just these two maps of it). */
export interface HeldShares {
  hashMapFiles: Record<string, Video>;
  reusedIdFiles: Record<string, Video>;
}

/**
 * The body held for one publisher's share. hashMapFiles is keyed by
 * identifier alone, as upstream, and holds the first name's body; a second
 * name's body under the same identifier goes to reusedIdFiles, so both rows
 * keep their own. A body held for a different name is never shown, marked
 * deleted or dropped for this share.
 */
export function heldShare(held: HeldShares, name: string | undefined, id: string): Video | undefined {
  const first = held.hashMapFiles[id];
  if (first && sameName(first.user, name)) return first;
  return held.reusedIdFiles[shareKey(name, id)];
}

/** Store a fetched body next to, never over, another name's body under the same identifier. */
function holdShare(state: GlobalState, video: Video) {
  const first = state.hashMapFiles[video.id];
  if (!first || sameName(first.user, video.user)) state.hashMapFiles[video.id] = video;
  else state.reusedIdFiles[shareKey(video.user, video.id)] = video;
  delete state.unavailableFiles[shareKey(video.user, video.id)];
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
      holdShare(state, action.payload);
    },
    updateInHashMap: (state, action) => {
      holdShare(state, { ...action.payload });
    },
    /**
     * Kept apart from hashMapFiles on purpose: the share page treats any
     * hashMapFiles entry as loaded, and a missing entry is what makes the next
     * search queue the body again.
     */
    markUnavailable: (state, action: PayloadAction<{ user: string; id: string }>) => {
      state.unavailableFiles[shareKey(action.payload.user, action.payload.id)] = true;
    },
    /** Forgets every name's body under this identifier. */
    removeFromHashMap: (state, action) => {
      const idToDelete = action.payload;
      delete state.hashMapFiles[idToDelete];
      for (const [key, video] of Object.entries(state.reusedIdFiles)) {
        if (video.id === idToDelete) delete state.reusedIdFiles[key];
      }
    },
    addArrayToHashMap: (state, action) => {
      action.payload.forEach((video: Video) => holdShare(state, video));
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
    markSharesChanged: state => {
      state.listVersion += 1;
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
  markUnavailable,
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
  markSharesChanged,
  setEditFile,
  setEditPlaylist,
} = fileSlice.actions;

export default fileSlice.reducer;
