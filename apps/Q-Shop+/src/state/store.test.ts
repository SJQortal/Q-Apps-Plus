/**
 * The carts in browser storage: saved on every change, and in step with the
 * app's other tabs (Hub tabs share one origin, so they share the storage).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createAppStore, persistCarts } from './store';
import { cartFor, saveCarts, setProductToCart, type Cart } from './features/cartSlice';
import { CART_STORAGE_KEY } from '../constants/plus';

const cart = (storeId: string, productId: string): Cart => ({
  orders: { [productId]: { productId, catalogueId: 'c1', quantity: 1 } },
  lastUpdated: 1,
  storeId,
  storeOwner: 'Seller',
});

const add = (storeId: string, productId: string) =>
  setProductToCart({ storeId, storeOwner: 'Seller', productId, catalogueId: 'c1', quantity: 1 });

/** What another tab does: save its carts, which fires `storage` here. */
function otherTabSaves(carts: Record<string, Cart>) {
  saveCarts(carts);
  window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
}

function stored(): Record<string, Cart> {
  return JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '{}');
}

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

describe('carts across tabs', () => {
  it('takes the carts another tab saved, and never writes back lines it paid for', () => {
    const store = createAppStore();
    stop = persistCarts(store);
    store.dispatch(add('shop-x', 'bought'));
    expect(Object.keys(stored())).toEqual(['shop-x']);

    // The other tab checks out shop X (its cart goes) and starts a cart at shop Y.
    otherTabSaves({ 'shop-y': cart('shop-y', 'later') });
    expect(cartFor(store.getState().cart.carts, 'Seller', 'shop-x')).toBeUndefined();
    expect(cartFor(store.getState().cart.carts, 'Seller', 'shop-y')?.orders.later).toBeDefined();

    // This tab's next change keeps the other tab's carts and doesn't bring X back.
    store.dispatch(add('shop-z', 'new'));
    expect(Object.keys(stored()).sort()).toEqual(['shop-y', 'shop-z']);
  });

  it('empties its carts when another tab empties them, and ignores other keys', () => {
    const store = createAppStore();
    stop = persistCarts(store);
    store.dispatch(add('shop-x', 'p1'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));
    expect(Object.keys(store.getState().cart.carts)).toEqual(['shop-x']);

    otherTabSaves({});
    expect(store.getState().cart.carts).toEqual({});
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});
