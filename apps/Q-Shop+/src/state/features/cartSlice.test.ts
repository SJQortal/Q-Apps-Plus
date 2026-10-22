import { describe, expect, it } from 'vitest';
import reducer, {
  MAX_QUANTITY,
  allCartsItemCount,
  cartFor,
  cartKeyOf,
  loadStoredCarts,
  removeCartFromCarts,
  removeProductFromCart,
  restoreCartItem,
  saveCarts,
  setCartQuantity,
  setProductToCart,
  subtractQuantityFromCart,
} from './cartSlice';
import { CART_STORAGE_KEY } from '../../constants/plus';

const add = (productId: string, quantity?: number, storeOwner = 'Seller', storeId = 's1') =>
  setProductToCart({ storeId, storeOwner, productId, catalogueId: 'c1', quantity });

const line = (productId: string, storeOwner = 'Seller', storeId = 's1') => ({ storeId, storeOwner, productId });

describe('cart', () => {
  it('adds, caps at 99, and removes a shop cart when it empties', () => {
    let state = reducer(undefined, add('p1'));
    state = reducer(state, add('p1', 3));
    expect(state.carts.s1.orders.p1.quantity).toBe(4);
    state = reducer(state, setCartQuantity({ ...line('p1'), quantity: 500 }));
    expect(state.carts.s1.orders.p1.quantity).toBe(MAX_QUANTITY);
    state = reducer(state, add('p2'));
    expect(allCartsItemCount(state.carts)).toBe(MAX_QUANTITY + 1);
    state = reducer(state, removeProductFromCart(line('p1')));
    state = reducer(state, subtractQuantityFromCart(line('p2')));
    expect(state.carts.s1).toBeUndefined();
  });

  it('puts a removed line back in its place, recreating an emptied cart', () => {
    let state = reducer(undefined, add('p1'));
    state = reducer(state, add('p2', 2));
    state = reducer(state, add('p3'));
    const { lastUpdated } = state.carts.s1;
    state = reducer(state, removeProductFromCart(line('p2')));
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
    single = reducer(single, removeProductFromCart(line('p9')));
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
    localStorage.setItem(CART_STORAGE_KEY, '[1]');
    expect(loadStoredCarts()).toEqual({});
  });
});

describe('carts of two owners with the same shop id', () => {
  // Sellers choose their shop ids: Alice and Mallory can both run "shop".
  const alice = (productId: string, quantity?: number) => add(productId, quantity, 'Alice', 'shop');
  const mallory = (productId: string, quantity?: number) => add(productId, quantity, 'Mallory', 'shop');

  it('keeps a product in the cart of the owner whose shop it was added on', () => {
    let state = reducer(undefined, mallory('copy'));
    state = reducer(state, alice('real', 2));
    // Alice's product never joins Mallory's cart (it would be priced from, and paid to, Mallory).
    expect(cartFor(state.carts, 'Mallory', 'shop')?.orders).toEqual({ copy: { productId: 'copy', catalogueId: 'c1', quantity: 1 } });
    expect(cartFor(state.carts, 'Alice', 'shop')).toMatchObject({
      storeId: 'shop',
      storeOwner: 'Alice',
      orders: { real: { productId: 'real', catalogueId: 'c1', quantity: 2 } },
    });
    expect(Object.keys(state.carts)).toHaveLength(2);
    expect(allCartsItemCount(state.carts)).toBe(3);

    // Each owner's lines change only in that owner's cart.
    state = reducer(state, alice('real'));
    state = reducer(state, setCartQuantity({ storeId: 'shop', storeOwner: 'Mallory', productId: 'copy', quantity: 5 }));
    expect(cartFor(state.carts, 'Alice', 'shop')?.orders.real.quantity).toBe(3);
    expect(cartFor(state.carts, 'Mallory', 'shop')?.orders.copy.quantity).toBe(5);
    state = reducer(state, removeProductFromCart({ storeId: 'shop', storeOwner: 'Alice', productId: 'copy' }));
    expect(cartFor(state.carts, 'Mallory', 'shop')?.orders.copy).toBeDefined();

    // Checking out Mallory's cart leaves Alice's.
    state = reducer(state, removeCartFromCarts({ storeId: 'shop', storeOwner: 'Mallory' }));
    expect(cartFor(state.carts, 'Mallory', 'shop')).toBeUndefined();
    expect(cartFor(state.carts, 'Alice', 'shop')?.orders.real.quantity).toBe(3);

    // A line put back goes to its own owner's cart.
    state = reducer(
      state,
      restoreCartItem({ storeId: 'shop', storeOwner: 'Mallory', order: { productId: 'copy', catalogueId: 'c1', quantity: 1 }, index: 0 })
    );
    expect(Object.keys(cartFor(state.carts, 'Alice', 'shop')!.orders)).toEqual(['real']);
    expect(Object.keys(cartFor(state.carts, 'Mallory', 'shop')!.orders)).toEqual(['copy']);
    // A cart without an owner is its own cart too.
    expect(cartKeyOf(state.carts, null, 'shop')).toBeNull();
  });

  it('loads carts stored before owners were told apart, and both owners\' carts after', () => {
    // The old shape: keyed by shop id, carrying the owner.
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ shop: { orders: { real: { productId: 'real', catalogueId: 'c1', quantity: 2 } }, lastUpdated: 5, storeId: 'shop', storeOwner: 'Alice' } })
    );
    let carts = loadStoredCarts();
    expect(cartFor(carts, 'Alice', 'shop')?.orders.real.quantity).toBe(2);

    // An add on Mallory's "shop" after the reload starts Mallory's own cart.
    let state = reducer({ carts, isOpen: false }, mallory('copy'));
    saveCarts(state.carts);
    carts = loadStoredCarts();
    expect(carts).toEqual(state.carts);
    expect(cartFor(carts, 'Mallory', 'shop')?.orders).toEqual({ copy: { productId: 'copy', catalogueId: 'c1', quantity: 1 } });
    expect(cartFor(carts, 'Alice', 'shop')?.orders).toEqual({ real: { productId: 'real', catalogueId: 'c1', quantity: 2 } });

    // Two stored carts of one owner's shop come back as one.
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        shop: { orders: { a: { catalogueId: 'c1', quantity: 1 } }, lastUpdated: 1, storeId: 'shop', storeOwner: 'Alice' },
        x: { orders: { a: { catalogueId: 'c1', quantity: 9 }, b: { catalogueId: 'c1', quantity: 2 } }, lastUpdated: 7, storeId: 'shop', storeOwner: 'Alice' },
      })
    );
    carts = loadStoredCarts();
    expect(Object.keys(carts)).toEqual(['shop']);
    expect(carts.shop.orders).toEqual({
      a: { productId: 'a', catalogueId: 'c1', quantity: 1 },
      b: { productId: 'b', catalogueId: 'c1', quantity: 2 },
    });
    expect(carts.shop.lastUpdated).toBe(7);
    state = reducer({ carts, isOpen: false }, alice('a'));
    expect(state.carts.shop.orders.a.quantity).toBe(2);
  });
});
