import { createSlice } from "@reduxjs/toolkit";

export interface OwnerReview {
  id: string;
  name: string;
  title: string;
  description: string;
  created: number;
  rating: number;
  updated?: number;
}
interface GlobalState {
  isLoadingGlobal: boolean;
  downloads: any;
  userAvatarHash: Record<string, string>;
  videoPlaying: any | null;
  ownerReviews: OwnerReview[];
  hashMapOwnerReviews: Record<string, OwnerReview>;
}

const initialState: GlobalState = {
  isLoadingGlobal: false,
  downloads: {},
  userAvatarHash: {},
  videoPlaying: null,
  ownerReviews: [],
  hashMapOwnerReviews: {},
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
    setVideoPlaying: (state, action) => {
      state.videoPlaying = action.payload;
    },
    addToReviews: (state, action) => {
      const newReview = action.payload;
      state.ownerReviews.unshift(newReview);
    },
    addToHashMapOwnerReviews: (state, action) => {
      const review = action.payload;
      state.hashMapOwnerReviews[review.id] = review;
    },
    upsertReviews: (state, action) => {
      action.payload.forEach((review: OwnerReview) => {
        const index = state.ownerReviews.findIndex(p => p.id === review.id);
        if (index !== -1) {
          state.ownerReviews[index] = review;
        } else {
          state.ownerReviews.push(review);
        }
      });
    },
  },
});

export const {
  setIsLoadingGlobal,
  setAddToDownloads,
  updateDownloads,
  setUserAvatarHash,
  setVideoPlaying,
  addToReviews,
  addToHashMapOwnerReviews,
  upsertReviews,
} = globalSlice.actions;

export default globalSlice.reducer;
