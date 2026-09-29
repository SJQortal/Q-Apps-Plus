import { createSlice } from "@reduxjs/toolkit";
import { RootState } from "../store";

interface CartState {
  // hashMapCarts: Record<string, Cart>
  carts: Record<string, Cart>;
  isOpen: boolean;
}
const initialState: CartState = {
  // hashMapCarts: {},
  carts: {},
  isOpen: false
};

export interface Order {
  productId: string;
  quantity: number;
  catalogueId: string;
}

export interface Cart {
  orders: Record<string, Order>;
  lastUpdated: number;
  storeId: string | null;
  storeOwner: string | null;
}

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setProductToCart: (state, action) => {
      const { storeId, storeOwner, productId, catalogueId } = action.payload;

      if (state.carts[storeId]) {
        // If the cart already exists, check if the order exists.
        if (state.carts[storeId].orders[productId]) {
          // If an order already exists, increment its quantity.
          state.carts[storeId].orders[productId].quantity += 1;
        } else {
          // If no order exists, create a new one with quantity 1.
          state.carts[storeId].orders[productId] = {
            quantity: 1,
            productId,
            catalogueId
          };
        }
      } else {
        // If the cart doesn't exist yet, create a new one with the order.
        state.carts[storeId] = {
          orders: {
            [productId]: {
              quantity: 1,
              productId,
              catalogueId
            }
          },
          lastUpdated: Date.now(),
          storeId,
          storeOwner
        };
      }
    },
    setIsOpen: (state, action) => {
      state.isOpen = action.payload;
    },
    addQuantityToCart: (state, action) => {
      const { storeId, productId } = action.payload;
      state.carts[storeId].orders[productId].quantity += 1;
    },
    subtractQuantityFromCart: (state, action) => {
      const { storeId, productId } = action.payload;
      state.carts[storeId].orders[productId].quantity -= 1;
      if (state.carts[storeId].orders[productId].quantity === 0) {
        delete state.carts[storeId].orders[productId];
      }
    },
    removeProductFromCart: (state, action) => {
      const { storeId, productId } = action.payload;
      delete state.carts[storeId].orders[productId];
    },
    removeCartFromCarts: (state, action) => {
      const { storeId } = action.payload;
      delete state.carts[storeId];
    }
  }
});

export const {
  setProductToCart,
  setIsOpen,
  addQuantityToCart,
  subtractQuantityFromCart,
  removeCartFromCarts,
  removeProductFromCart
} = cartSlice.actions;

export default cartSlice.reducer;
