import { describe, expect, it } from 'vitest';
import reducer, {
  MAX_QUANTITY,
  allCartsItemCount,
  loadStoredCarts,
  removeProductFromCart,
  restoreCartItem,
  saveCarts,
  setCartQuantity,
  setProductToCart,
  subtractQuantityFromCart,
} from './cartSlice';
import { CART_STORAGE_KEY } from '../../constants/plus';

const add = (productId: string, quantity?: number) =>
  setProductToCart({ storeId: 's1', storeOwner: 'Seller', productId, catalogueId: 'c1', quantity });

describe('cart', () => {
  it('adds, caps at 99, and removes a shop cart when it empties', () => {
    let state = reducer(undefined, add('p1'));
    state = reducer(state, add('p1', 3));
    expect(state.carts.s1.orders.p1.quantity).toBe(4);
    state = reducer(state, setCartQuantity({ storeId: 's1', productId: 'p1', quantity: 500 }));
    expect(state.carts.s1.orders.p1.quantity).toBe(MAX_QUANTITY);
    state = reducer(state, add('p2'));
    expect(allCartsItemCount(state.carts)).toBe(MAX_QUANTITY + 1);
    state = reducer(state, removeProductFromCart({ storeId: 's1', productId: 'p1' }));
    state = reducer(state, subtractQuantityFromCart({ storeId: 's1', productId: 'p2' }));
    expect(state.carts.s1).toBeUndefined();
  });

  it('puts a removed line back in its place, recreating an emptied cart', () => {
    let state = reducer(undefined, add('p1'));
    state = reducer(state, add('p2', 2));
    state = reducer(state, add('p3'));
    const { lastUpdated } = state.carts.s1;
    state = reducer(state, removeProductFromCart({ storeId: 's1', productId: 'p2' }));
    state = reducer(
      state,
      restoreCartItem({ storeId: 's1', storeOwner: 'Seller', order: { productId: 'p2', catalogueId: 'c1', quantity: 2 }, index: 1 })
    );
    expect(Object.keys(state.carts.s1.orders)).toEqual(['p1', 'p2', 'p3']);
    expect(state.carts.s1.orders.p2).toEqual({ productId: 'p2', catalogueId: 'c1', quantity: 2 });

    // Restoring twice changes nothing.
    const again = reducer(
      state,
      restoreCartItem({ storeId: 's1', storeOwner: 'Seller', order: { productId: 'p2', catalogueId: 'c1', quantity: 5 }, index: 0 })
    );
    expect(again.carts.s1.orders).toEqual(state.carts.s1.orders);

    // The last line of a shop: its cart comes back with its old timestamp.
    let single = reducer(undefined, add('p9'));
    single = reducer(single, removeProductFromCart({ storeId: 's1', productId: 'p9' }));
    expect(single.carts.s1).toBeUndefined();
    single = reducer(
      single,
      restoreCartItem({ storeId: 's1', storeOwner: 'Seller', order: { productId: 'p9', catalogueId: 'c1', quantity: 1 }, index: 0, lastUpdated })
    );
    expect(single.carts.s1).toEqual({
      orders: { p9: { productId: 'p9', catalogueId: 'c1', quantity: 1 } },
      lastUpdated,
      storeId: 's1',
      storeOwner: 'Seller',
    });
  });

  it('survives a reload and drops anything that is not a cart', () => {
    const state = reducer(undefined, add('p1', 2));
    saveCarts(state.carts);
    expect(loadStoredCarts()).toEqual({ s1: { ...state.carts.s1 } });
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ s1: { orders: { p1: { quantity: 'x', catalogueId: 'c1' }, p2: { quantity: 2 } } }, s2: 'nope' })
    );
    expect(loadStoredCarts()).toEqual({});
    localStorage.setItem(CART_STORAGE_KEY, '{not json');
    expect(loadStoredCarts()).toEqual({});
  });
});
