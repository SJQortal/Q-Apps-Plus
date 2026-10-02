import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { type Collection, type CollectionSummary, collectionKey } from "../../utils/collections";

interface CollectionsState {
  /** The signed-in name's collections (first page), or null until loaded. */
  mine: CollectionSummary[] | null;
  /** Which name `mine` was loaded for, so a name switch reloads it. */
  mineName: string | null;
  loadingMine: boolean;
  mineError: boolean;
  /** Fetched bodies keyed by `name/identifier`. */
  byKey: Record<string, Collection>;
}

const initialState: CollectionsState = {
  mine: null,
  mineName: null,
  loadingMine: false,
  mineError: false,
  byKey: {},
};

export const collectionsSlice = createSlice({
  name: "collections",
  initialState,
  reducers: {
    setLoadingMine: (state, action: PayloadAction<string>) => {
      state.loadingMine = true;
      state.mineError = false;
      state.mineName = action.payload;
    },
    setMine: (state, action: PayloadAction<{ name: string; rows: CollectionSummary[] }>) => {
      state.mine = action.payload.rows;
      state.mineName = action.payload.name;
      state.loadingMine = false;
      state.mineError = false;
    },
    setMineError: (state, action: PayloadAction<string>) => {
      state.mine = null;
      state.mineName = action.payload;
      state.loadingMine = false;
      state.mineError = true;
    },
    /** A collection the user just created (or one that was missing from `mine`). */
    addToMine: (state, action: PayloadAction<CollectionSummary>) => {
      const summary = action.payload;
      if (!state.mine) state.mine = [];
      const index = state.mine.findIndex(
        (row) => row.name === summary.name && row.identifier === summary.identifier
      );
      if (index === -1) state.mine.unshift(summary);
      else state.mine[index] = { ...state.mine[index], ...summary };
    },
    upsertCollection: (state, action: PayloadAction<Collection>) => {
      const collection = action.payload;
      state.byKey[collectionKey(collection.name, collection.identifier)] = collection;
      if (state.mine) {
        const index = state.mine.findIndex(
          (row) => row.name === collection.name && row.identifier === collection.identifier
        );
        if (index !== -1) {
          state.mine[index] = {
            ...state.mine[index],
            title: collection.title,
            description: collection.description,
            updated: collection.updated,
          };
        }
      }
    },
    clearMine: (state) => {
      state.mine = null;
      state.mineName = null;
      state.loadingMine = false;
      state.mineError = false;
    },
  },
});

export const { setLoadingMine, setMine, setMineError, addToMine, upsertCollection, clearMine } =
  collectionsSlice.actions;

export default collectionsSlice.reducer;
