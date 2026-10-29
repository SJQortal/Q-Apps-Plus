import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
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

/*
 * Which cart a line belongs to: a shop is its owner's name plus its shop id.
 * Sellers choose their shop ids, so two names can both run
 * `q-store-general-shop` (or copy another shop's id on purpose); a product
 * added on one owner's shop must never join the other owner's cart, where it
 * would be priced from, and paid to, the wrong name.
 *
 * The keys of `carts` are opaque. The first cart of a shop id is keyed by the
 * shop id alone, as every cart was before owners were told apart (so stored
 * carts load as they are); a cart of another owner's shop with the same id is
 * keyed by `owner\nshopId`. Find carts by owner + shop id (cartKeyOf, cartFor),
 * never by a key built by hand.
 */

/** Names a cart: its shop id and owner, as the shop and product pages pass them. */
export interface CartRef {
  storeId: string;
  storeOwner: string | null | undefined;
}

export interface CartLineRef extends CartRef {
  productId: string;
}

function ownerOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function hasKey(carts: Record<string, Cart>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(carts, key);
}

/** The key of this owner's cart for this shop id, or null when there is none. */
export function cartKeyOf(carts: Record<string, Cart>, storeOwner: string | null | undefined, storeId: string): string | null {
  const owner = ownerOf(storeOwner);
  if (hasKey(carts, storeId) && carts[storeId].storeId === storeId && carts[storeId].storeOwner === owner) return storeId;
  for (const [key, cart] of Object.entries(carts)) {
    if (cart.storeId === storeId && cart.storeOwner === owner) return key;
  }
  return null;
}

/** This owner's cart for this shop id. */
export function cartFor(carts: Record<string, Cart>, storeOwner: string | null | undefined, storeId: string): Cart | undefined {
  const key = cartKeyOf(carts, storeOwner, storeId);
  return key === null ? undefined : carts[key];
}

/** The key a new cart gets: the shop id while no cart has it, otherwise the owner and the shop id. */
function newCartKey(carts: Record<string, Cart>, owner: string | null, storeId: string): string {
  if (!hasKey(carts, storeId)) return storeId;
  const base = `${owner ?? ""}\n${storeId}`;
  let key = base;
  for (let n = 2; hasKey(carts, key); n++) key = `${base}\n${n}`;
  return key;
}

function cleanQuantity(value: unknown): number {
  return Math.floor(Number(value));
}

/**
 * Carts survive a reload (the original kept them in memory only). Read
 * tolerantly: anything that doesn't look like a cart is dropped. Carts
 * stored before owners were told apart are keyed by their shop id and carry
 * their owner, so they load under the same key; two stored carts of one
 * owner's shop are merged.
 */
export function loadStoredCarts(): Record<string, Cart> {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const carts: Record<string, Cart> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const cart = value as Partial<Cart> | null;
      if (!cart || typeof cart !== "object" || !cart.orders || typeof cart.orders !== "object") continue;
      const orders: Record<string, Order> = {};
      for (const [productId, order] of Object.entries(cart.orders)) {
        const quantity = cleanQuantity(order?.quantity);
        if (!order?.catalogueId || !(quantity > 0)) continue;
        orders[productId] = { productId, catalogueId: String(order.catalogueId), quantity: Math.min(quantity, MAX_QUANTITY) };
      }
      if (Object.keys(orders).length === 0) continue;
      const storeId = typeof cart.storeId === "string" && cart.storeId ? cart.storeId : key;
      const storeOwner = ownerOf(cart.storeOwner);
      const lastUpdated = Number(cart.lastUpdated) || 0;
      const same = cartKeyOf(carts, storeOwner, storeId);
      if (same !== null) {
        const into = carts[same];
        for (const order of Object.values(orders)) {
          if (!into.orders[order.productId]) into.orders[order.productId] = order;
        }
        into.lastUpdated = Math.max(into.lastUpdated, lastUpdated);
        continue;
      }
      const keepKey = (key === storeId || key === `${storeOwner ?? ""}\n${storeId}`) && !hasKey(carts, key);
      carts[keepKey ? key : newCartKey(carts, storeOwner, storeId)] = { orders, lastUpdated, storeId, storeOwner };
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

/** Drops a cart once its last line is gone; otherwise marks it changed. */
function settle(state: CartState, key: string) {
  const cart = state.carts[key];
  if (!cart) return;
  if (Object.keys(cart.orders).length === 0) delete state.carts[key];
  else touch(cart);
}

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    /**
     * Adds to the cart of the shop the product was added on: `storeOwner`
     * picks the cart as much as `storeId` does (dispatched by the shop and
     * product pages as `{storeId, storeOwner, productId, catalogueId, quantity}`).
     */
    setProductToCart: (state, action) => {
      const { storeId, productId, catalogueId } = action.payload;
      const storeOwner = ownerOf(action.payload.storeOwner);
      const quantity = Math.max(1, Math.floor(Number(action.payload.quantity ?? 1)));
      const key = cartKeyOf(state.carts, storeOwner, storeId);

      if (key !== null) {
        const cart = state.carts[key];
        if (cart.orders[productId]) {
          // If an order already exists, increment its quantity.
          cart.orders[productId].quantity = Math.min(cart.orders[productId].quantity + quantity, MAX_QUANTITY);
        } else {
          cart.orders[productId] = {
            quantity: Math.min(quantity, MAX_QUANTITY),
            productId,
            catalogueId
          };
        }
        touch(cart);
      } else {
        // No cart for this owner's shop yet: start one.
        state.carts[newCartKey(state.carts, storeOwner, storeId)] = {
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
    /** Every cart at once, as another tab saved them (store.ts syncs tabs). */
    replaceCarts: (state, action: PayloadAction<Record<string, Cart>>) => {
      state.carts = action.payload;
    },
    addQuantityToCart: (state, action: PayloadAction<CartLineRef>) => {
      const { storeId, storeOwner, productId } = action.payload;
      const key = cartKeyOf(state.carts, storeOwner, storeId);
      const order = key === null ? undefined : state.carts[key].orders[productId];
      if (key === null || !order) return;
      order.quantity = Math.min(order.quantity + 1, MAX_QUANTITY);
      touch(state.carts[key]);
    },
    subtractQuantityFromCart: (state, action: PayloadAction<CartLineRef>) => {
      const { storeId, storeOwner, productId } = action.payload;
      const key = cartKeyOf(state.carts, storeOwner, storeId);
      const order = key === null ? undefined : state.carts[key].orders[productId];
      if (key === null || !order) return;
      order.quantity -= 1;
      if (order.quantity <= 0) delete state.carts[key].orders[productId];
      settle(state, key);
    },
    setCartQuantity: (state, action: PayloadAction<CartLineRef & { quantity: number }>) => {
      const { storeId, storeOwner, productId } = action.payload;
      const key = cartKeyOf(state.carts, storeOwner, storeId);
      const order = key === null ? undefined : state.carts[key].orders[productId];
      if (key === null || !order) return;
      const quantity = cleanQuantity(action.payload.quantity);
      if (!(quantity > 0)) delete state.carts[key].orders[productId];
      else order.quantity = Math.min(quantity, MAX_QUANTITY);
      settle(state, key);
    },
    removeProductFromCart: (state, action: PayloadAction<CartLineRef>) => {
      const { storeId, storeOwner, productId } = action.payload;
      const key = cartKeyOf(state.carts, storeOwner, storeId);
      if (key === null) return;
      delete state.carts[key].orders[productId];
      settle(state, key);
    },
    removeCartFromCarts: (state, action: PayloadAction<CartRef>) => {
      const { storeId, storeOwner } = action.payload;
      const key = cartKeyOf(state.carts, storeOwner, storeId);
      if (key !== null) delete state.carts[key];
    },
    /**
     * Puts a removed line back where it was (the cart page's Undo). Recreates
     * the shop's cart, with its old `lastUpdated`, if removing the line had
     * emptied it. A line that is back in the cart already is left alone.
     */
    restoreCartItem: (
      state,
      action: PayloadAction<CartRef & { order: Order; index: number; lastUpdated?: number }>
    ) => {
      const { storeId, order, index, lastUpdated } = action.payload;
      const storeOwner = ownerOf(action.payload.storeOwner);
      const quantity = Math.min(Math.max(1, Math.floor(Number(order?.quantity) || 1)), MAX_QUANTITY);
      if (!order?.productId || !order.catalogueId) return;
      let key = cartKeyOf(state.carts, storeOwner, storeId);
      if (key === null) {
        key = newCartKey(state.carts, storeOwner, storeId);
        state.carts[key] = { orders: {}, lastUpdated: lastUpdated ?? Date.now(), storeId, storeOwner };
      }
      const cart = state.carts[key];
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
  replaceCarts,
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
