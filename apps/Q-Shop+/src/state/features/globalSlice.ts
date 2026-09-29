import { createSlice } from "@reduxjs/toolkit";
import { Product } from "./storeSlice";
import { Order } from "./orderSlice";

export interface ProductDataContainer {
  created: number;
  priceQort: number;
  category: string;
  catalogueId: string;
  productId?: string;
  user?: string;
  status: string;
}

interface ForeignCoins {
  [key: string]: string;
}
export interface CurrentStore {
  created: number;
  id: string;
  title: string;
  description: string;
  owner: string;
  shortStoreId: string;
  logo?: string;
  location?: string;
  shipsTo?: string;
  foreignCoins: ForeignCoins;
  supportedCoins: string[];
}

export interface DataContainer {
  storeId: string;
  shortStoreId: string;
  owner: string;
  products: Record<string, ProductDataContainer>;
  catalogues: CatalogueDataContainer[];
  id: string;
}

export interface CatalogueDataContainer {
  id: string;
  products: Record<string, true>;
}
export interface Catalogue {
  id: string;
  products: Record<string, Product>;
  user?: string;
}
interface GlobalState {
  isOpenCreateStoreModal: boolean;
  isLoadingCurrentBlog: boolean;
  isLoadingGlobal: boolean;
  isOpenEditStoreModal: boolean;
  currentStore: CurrentStore | null;
  downloads: any;
  userAvatarHash: Record<string, string>;
  dataContainer: DataContainer | null;
  listProducts: {
    sort: string;
    products: ProductDataContainer[];
    categories: string[];
  };
  productsToSave: Record<string, Product>;
  catalogueHashMap: Record<string, Catalogue>;
  products: Product[];
  myOrders: Order[];
  recentlyVisitedStoreId: string;
  productsToSaveCategories: string[];
}

const initialState: GlobalState = {
  isOpenCreateStoreModal: false,
  isLoadingCurrentBlog: true,
  isLoadingGlobal: false,
  currentStore: null, // user owns this shop
  isOpenEditStoreModal: false,
  downloads: {},
  userAvatarHash: {},
  dataContainer: null,
  listProducts: {
    sort: "created",
    products: [],
    categories: []
  },
  products: [],
  productsToSave: {},
  catalogueHashMap: {},
  myOrders: [],
  recentlyVisitedStoreId: "",
  productsToSaveCategories: []
};

export const globalSlice = createSlice({
  name: "global",
  initialState,
  reducers: {
    toggleCreateStoreModal: (state, action) => {
      state.isOpenCreateStoreModal = action.payload;
    },
    toggleEditStoreModal: (state, action) => {
      state.isOpenEditStoreModal = action.payload;
    },
    setCurrentStore: (state, action) => {
      state.currentStore = action.payload;
      state.isLoadingCurrentBlog = false;
    },

    setDataContainer: (state, action) => {
      let categories: any = {};
      state.dataContainer = action.payload;
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
      state.listProducts.sort = "created";
      state.listProducts.products = mappedProducts;
      state.listProducts.categories = Object.keys(categories).map((cat) => cat);
    },
    setProducts: (state, action) => {
      state.products = action.payload;
    },
    setIsLoadingGlobal: (state, action) => {
      state.isLoadingGlobal = action.payload;
    },
    setAddToDownloads: (state, action) => {
      const download = action.payload;
      state.downloads[download.identifier] = download;
    },
    clearAllProductsToSave: (state) => {
      state.productsToSave = {};
    },
    removeFromProductsToSave: (state, action) => {
      const productId = action.payload;
      // Create a copy of the productsToSave object
      const updatedProductsToSave = { ...state.productsToSave };
      // Remove the nested object based on the ID
      delete updatedProductsToSave[productId];
      // Return the updated state with the removed object
      state.productsToSave = updatedProductsToSave;
    },
    setProductsToSave: (state, action) => {
      const product = action.payload;
      state.productsToSave[product.id] = product;
    },
    updateDownloads: (state, action) => {
      const { identifier } = action.payload;
      const download = action.payload;
      state.downloads[identifier] = {
        ...state.downloads[identifier],
        ...download
      };
    },
    setUserAvatarHash: (state, action) => {
      const avatar = action.payload;
      if (avatar?.name && avatar?.url) {
        state.userAvatarHash[avatar?.name] = avatar?.url;
      }
    },
    updateCatalogueHashMap: (state, action) => {
      const catalogue = action.payload;
      Object.keys(catalogue).forEach((key) => {
        state.catalogueHashMap[key] = catalogue[key];
      });
    },
    setCatalogueHashMap: (state, action) => {
      const catalogue = action.payload;
      state.catalogueHashMap[catalogue.id] = catalogue;
    },
    upsertProducts: (state, action) => {
      action.payload.forEach((product: Product) => {
        const index = state.products.findIndex((p) => p.id === product.id);
        if (index !== -1) {
          state.products[index] = product;
        } else {
          state.products.push(product);
        }
      });
    },
    upsertMyOrders: (state, action) => {
      action.payload.forEach((order: Order) => {
        const index = state.myOrders.findIndex((p) => p.id === order.id);
        if (index !== -1) {
          state.myOrders[index] = order;
        } else {
          state.myOrders.push(order);
        }
      });
    },
    updateRecentlyVisitedStoreId: (state, action) => {
      state.recentlyVisitedStoreId = action.payload;
    },
    addProductsToSaveCategory: (state, action) => {
      const newCategory = action.payload;
      state.productsToSaveCategories.push(newCategory);
    },
    resetProducts: (state) => {
      state.products = [];
      state.productsToSave = {};
    },
    resetListProducts: (state) => {
      state.listProducts = {
        sort: "created",
        products: [],
        categories: []
      };
    },
    clearDataCotainer: (state) => {
      state.dataContainer = null;
    }
  }
});

export const {
  toggleCreateStoreModal,
  setCurrentStore,
  setDataContainer,
  setIsLoadingGlobal,
  toggleEditStoreModal,
  setAddToDownloads,
  updateRecentlyVisitedStoreId,
  updateDownloads,
  setUserAvatarHash,
  removeFromProductsToSave,
  setProductsToSave,
  setCatalogueHashMap,
  updateCatalogueHashMap,
  upsertProducts,
  upsertMyOrders,
  resetProducts,
  clearAllProductsToSave,
  resetListProducts,
  setProducts,
  addProductsToSaveCategory,
  clearDataCotainer
} = globalSlice.actions;

export default globalSlice.reducer;
