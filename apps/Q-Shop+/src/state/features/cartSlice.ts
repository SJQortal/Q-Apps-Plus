import { createSlice } from "@reduxjs/toolkit";
import { CART_STORAGE_KEY } from "../../constants/plus";

interface CartState {
  carts: Record<string, Cart>;
  isOpen: boolean;
}

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

/** Most of one product a cart holds (the original's product page allowed 99). */
export const MAX_QUANTITY = 99;

/**
 * Carts survive a reload (the original kept them in memory only). Read
 * tolerantly: anything that doesn't look like a cart is dropped.
 */
export function loadStoredCarts(): Record<string, Cart> {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Cart>;
    const carts: Record<string, Cart> = {};
    for (const [storeId, cart] of Object.entries(parsed ?? {})) {
      if (!cart || typeof cart !== "object" || !cart.orders || typeof cart.orders !== "object") continue;
      const orders: Record<string, Order> = {};
      for (const [productId, order] of Object.entries(cart.orders)) {
        const quantity = Math.floor(Number(order?.quantity));
        if (!order?.catalogueId || !(quantity > 0)) continue;
        orders[productId] = { productId, catalogueId: String(order.catalogueId), quantity: Math.min(quantity, MAX_QUANTITY) };
      }
      if (Object.keys(orders).length === 0) continue;
      carts[storeId] = {
        orders,
        lastUpdated: Number(cart.lastUpdated) || 0,
        storeId,
        storeOwner: typeof cart.storeOwner === "string" ? cart.storeOwner : null,
      };
    }
    return carts;
  } catch {
    return {};
  }
}

export function saveCarts(carts: Record<string, Cart>): void {
  try {
    if (Object.keys(carts).length === 0) localStorage.removeItem(CART_STORAGE_KEY);
    else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carts));
  } catch {
    // Storage full or blocked: the cart still works for this visit.
  }
}

const initialState: CartState = {
  carts: loadStoredCarts(),
  isOpen: false,
};

function touch(cart: Cart | undefined) {
  if (cart) cart.lastUpdated = Date.now();
}

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setProductToCart: (state, action) => {
      const { storeId, storeOwner, productId, catalogueId } = action.payload;
      const quantity = Math.max(1, Math.floor(Number(action.payload.quantity ?? 1)));

      if (state.carts[storeId]) {
        // If the cart already exists, check if the order exists.
        if (state.carts[storeId].orders[productId]) {
          // If an order already exists, increment its quantity.
          state.carts[storeId].orders[productId].quantity = Math.min(
            state.carts[storeId].orders[productId].quantity + quantity,
            MAX_QUANTITY
          );
        } else {
          // If no order exists, create a new one.
          state.carts[storeId].orders[productId] = {
            quantity: Math.min(quantity, MAX_QUANTITY),
            productId,
            catalogueId
          };
        }
        touch(state.carts[storeId]);
      } else {
        // If the cart doesn't exist yet, create a new one with the order.
        state.carts[storeId] = {
          orders: {
            [productId]: {
              quantity: Math.min(quantity, MAX_QUANTITY),
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
      const order = state.carts[storeId]?.orders[productId];
      if (!order) return;
      order.quantity = Math.min(order.quantity + 1, MAX_QUANTITY);
      touch(state.carts[storeId]);
    },
    subtractQuantityFromCart: (state, action) => {
      const { storeId, productId } = action.payload;
      const cart = state.carts[storeId];
      const order = cart?.orders[productId];
      if (!cart || !order) return;
      order.quantity -= 1;
      if (order.quantity <= 0) {
        delete cart.orders[productId];
      }
      if (Object.keys(cart.orders).length === 0) delete state.carts[storeId];
      else touch(cart);
    },
    setCartQuantity: (state, action) => {
      const { storeId, productId } = action.payload;
      const cart = state.carts[storeId];
      const order = cart?.orders[productId];
      if (!cart || !order) return;
      const quantity = Math.floor(Number(action.payload.quantity));
      if (!(quantity > 0)) delete cart.orders[productId];
      else order.quantity = Math.min(quantity, MAX_QUANTITY);
      if (Object.keys(cart.orders).length === 0) delete state.carts[storeId];
      else touch(cart);
    },
    removeProductFromCart: (state, action) => {
      const { storeId, productId } = action.payload;
      const cart = state.carts[storeId];
      if (!cart) return;
      delete cart.orders[productId];
      if (Object.keys(cart.orders).length === 0) delete state.carts[storeId];
      else touch(cart);
    },
    removeCartFromCarts: (state, action) => {
      const { storeId } = action.payload;
      delete state.carts[storeId];
    },
    /**
     * Puts a removed line back where it was (the cart page's Undo). Recreates
     * the shop's cart, with its old `lastUpdated`, if removing the line had
     * emptied it. A line that is back in the cart already is left alone.
     */
    restoreCartItem: (state, action) => {
      const { storeId, storeOwner, order, index, lastUpdated } = action.payload as {
        storeId: string;
        storeOwner: string | null;
        order: Order;
        index: number;
        lastUpdated?: number;
      };
      const quantity = Math.min(Math.max(1, Math.floor(Number(order?.quantity) || 1)), MAX_QUANTITY);
      if (!order?.productId || !order.catalogueId) return;
      const cart =
        state.carts[storeId] ??
        (state.carts[storeId] = { orders: {}, lastUpdated: lastUpdated ?? Date.now(), storeId, storeOwner });
      if (cart.orders[order.productId]) return;
      const entries = Object.entries(cart.orders);
      const at = Math.max(0, Math.min(Math.floor(Number(index) || 0), entries.length));
      entries.splice(at, 0, [order.productId, { productId: order.productId, catalogueId: order.catalogueId, quantity }]);
      cart.orders = Object.fromEntries(entries);
    }
  }
});

export const {
  setProductToCart,
  setIsOpen,
  addQuantityToCart,
  subtractQuantityFromCart,
  setCartQuantity,
  removeCartFromCarts,
  removeProductFromCart,
  restoreCartItem
} = cartSlice.actions;

/** Items in one shop's cart. */
export function cartItemCount(cart: Cart | undefined): number {
  if (!cart) return 0;
  return Object.values(cart.orders).reduce((sum, order) => sum + order.quantity, 0);
}

/** Items in every cart (the bottom bar's badge). */
export function allCartsItemCount(carts: Record<string, Cart>): number {
  return Object.values(carts).reduce((sum, cart) => sum + cartItemCount(cart), 0);
}

export default cartSlice.reducer;
