import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";
import { CurrentStore, DataContainer, ProductDataContainer } from "./globalSlice";
import { ForeignCoins } from "../../components/modals/CreateStoreModal";
import { CoinFilter } from "../../pages/Store/Store/Store";

interface GlobalState {
  products: Product[];
  filteredProducts: Product[];
  myStores: Store[];
  hashMapProducts: Record<string, Product>;
  isFiltering: boolean;
  filterValue: string;
  hashMapStores: Record<string, Store>;
  storeId: string | null;
  storeOwner: string | null;
  stores: Store[];
  storeReviews: StoreReview[];
  hashMapStoreReviews: Record<string, StoreReview>;
  currentViewedStore: CurrentStore | null;
  viewedStoreDataContainer: DataContainer | null;
  viewedStoreListProducts: {
    sort: string;
    products: ProductDataContainer[];
    categories: string[];
  };
  preferredCoin: CoinFilter
}

const initialState: GlobalState = {
  products: [],
  filteredProducts: [],
  myStores: [],
  hashMapProducts: {},
  isFiltering: false,
  filterValue: "",
  hashMapStores: {},
  storeId: null,
  storeOwner: null,
  stores: [],
  storeReviews: [],
  hashMapStoreReviews: {},
  // user is viewing this shop, doesn't own it
  currentViewedStore: null, 
  viewedStoreDataContainer: null,
  viewedStoreListProducts: {
    sort: "created",
    products: [],
    categories: []
  },
  preferredCoin: CoinFilter.qort
};

export interface Price {
  currency: string;
  value: number;
}
export interface Product {
  title?: string;
  description?: string;
  created: number;
  user: string;
  id: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  updated?: number;
  isValid?: boolean;
  price?: Price[];
  images?: string[];
  type?: string;
  catalogueId: string;
  status?: string;
  mainImageIndex?: number;
  isUpdate?: boolean;
}

export interface Store {
  title: string;
  description: string;
  created: number;
  owner: string;
  id: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
  updated?: number;
  isValid?: boolean;
  logo?: string;
  location?: string;
  shipsTo?: string;
  shortStoreId?: string;
  foreignCoins?: ForeignCoins;
  supportedCoins?: string[];
}

export interface StoreReview {
  id: string;
  name: string;
  title: string;
  description: string;
  created: number;
  rating: number;
  updated?: number;
}

export const storeSlice = createSlice({
  name: "store",
  initialState,
  reducers: {
    setAllMyStores: (state, action) => {
      state.myStores = action.payload;
    },
    addToAllMyStores: (state, action) => {
      state.myStores.push(action.payload);
    },
    setViewedStoreDataContainer: (state, action) => {
      let categories: any = {};
      state.viewedStoreDataContainer = action.payload;
      const mappedProducts = Object.keys(action.payload.products)
        .map((key) => {
          const category = action.payload?.products[key]?.category;
          if (category) {
            categories[category] = true;
          }
          return {
            ...action.payload.products[key],
            productId: key,
            user: action.payload.owner
          };
        })
        .sort((a, b) => b.created - a.created);
      state.viewedStoreListProducts.sort = "created";
      state.viewedStoreListProducts.products = mappedProducts;
      state.viewedStoreListProducts.categories = Object.keys(categories).map((cat) => cat);
    },
    clearViewedStoreDataContainer: (state) => {
      state.viewedStoreDataContainer = null;
      state.viewedStoreListProducts = {
        sort: "created",
        products: [],
        categories: []
      };
    },
    addToHashMap: (state, action) => {
      const post = action.payload;
      state.hashMapProducts[post.id] = post;
    },
    addToHashMapStores: (state, action) => {
      const store = action.payload;
      state.hashMapStores[store?.id] = store;
    },
    removeFromHashMapStores: (state, action) => {
      const storeId = action.payload;
      delete state.hashMapStores[storeId];
    },
    addToHashMapStoreReviews: (state, action) => {
      const review = action.payload;
      state.hashMapStoreReviews[review.id] = review;
    },
    updateInHashMap: (state, action) => {
      const { id } = action.payload;
      const post = action.payload;
      state.hashMapProducts[id] = { ...post };
    },
    removeFromHashMap: (state, action) => {
      const idToDelete = action.payload;
      delete state.hashMapProducts[idToDelete];
    },
    addArrayToHashMap: (state, action) => {
      const products = action.payload;
      products.forEach((post: Product) => {
        state.hashMapProducts[post.id] = post;
      });
    },
    setStoreId: (state, action) => {
      state.storeId = action.payload;
    },
    setStoreOwner: (state, action) => {
      state.storeOwner = action.payload;
    },
    setCurrentViewedStore: (state, action) => {
      state.currentViewedStore = action.payload;
    },
    upsertPosts: (state, action) => {
      action.payload.forEach((post: Product) => {
        const index = state.products.findIndex((p) => p.id === post.id);
        if (index !== -1) {
          state.products[index] = post;
        } else {
          state.products.push(post);
        }
      });
    },
    upsertStores: (state, action) => {
      action.payload.forEach((store: Store) => {
        const index = state.stores.findIndex((p) => p.id === store.id);
        if (index !== -1) {
          state.stores[index] = store;
        } else {
          state.stores.push(store);
        }
      });
    },
    upsertReviews: (state, action) => {
      action.payload.forEach((review: StoreReview) => {
        const index = state.storeReviews.findIndex((p) => p.id === review.id);
        if (index !== -1) {
          state.storeReviews[index] = review;
        } else {
          state.storeReviews.push(review);
        }
      });
    },
    addToStores: (state, action) => {
      const newStore = action.payload;
      state.stores.unshift(newStore);
    },
    addToReviews: (state, action) => {
      const newReview = action.payload;
      state.storeReviews.unshift(newReview);
    },
    upsertFilteredPosts: (state, action) => {
      action.payload.forEach((post: Product) => {
        const index = state.filteredProducts.findIndex((p) => p.id === post.id);
        if (index !== -1) {
          state.filteredProducts[index] = post;
        } else {
          state.filteredProducts.push(post);
        }
      });
    },
    upsertPostsBeginning: (state, action) => {
      action.payload.reverse().forEach((post: Product) => {
        const index = state.products.findIndex((p) => p.id === post.id);
        if (index !== -1) {
          state.products[index] = post;
        } else {
          state.products.unshift(post);
        }
      });
    },
    clearReviews: (state) => {
      state.storeReviews = [];
    },
    blockUser: (state, action) => {
      const username = action.payload;
      state.products = state.products.filter((item) => item.user !== username);
      state.filteredProducts = state.filteredProducts.filter(
        (item) => item.user !== username
      );
    },
    setPreferredCoin: (state, action) => {
      const coin: CoinFilter = action.payload;
      state.preferredCoin = coin
    },
  }
});

export const {
  addToAllMyStores,
  setAllMyStores,
  setCurrentViewedStore,
  setViewedStoreDataContainer,
  clearViewedStoreDataContainer,
  addToHashMap,
  updateInHashMap,
  removeFromHashMap,
  upsertPosts,
  blockUser,
  upsertPostsBeginning,
  upsertFilteredPosts,
  addToHashMapStores,
  removeFromHashMapStores,
  setStoreId,
  setStoreOwner,
  upsertStores,
  upsertReviews,
  clearReviews,
  addToStores,
  addToHashMapStoreReviews,
  addToReviews,
  setPreferredCoin
} = storeSlice.actions;

export default storeSlice.reducer;
