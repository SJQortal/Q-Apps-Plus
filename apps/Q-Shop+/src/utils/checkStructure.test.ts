import { describe, expect, it } from 'vitest';
import {
  checkStructure,
  checkStructureOrders,
  checkStructureStore,
  checkStructureStoreReviews,
} from './checkStructure';

// These validators decide which QDN resources the app accepts. They are part
// of the data contract with the original Q-Shop, so lock their rules down.
describe('checkStructure (product)', () => {
  const valid = {
    title: 'Mug',
    created: 1,
    description: 'A mug',
    type: 'physical',
    images: [],
    price: [{ currency: 'QORT', value: 1 }],
  };
  it('accepts a product with every required field', () => {
    expect(checkStructure(valid)).toBe(true);
  });
  it.each(['title', 'created', 'description', 'type', 'images', 'price'])('rejects a product without %s', (key) => {
    expect(checkStructure({ ...valid, [key]: undefined })).toBe(false);
  });
  it('requires images and price to be arrays', () => {
    expect(checkStructure({ ...valid, images: 'x' })).toBe(false);
    expect(checkStructure({ ...valid, price: {} })).toBe(false);
  });
});

describe('checkStructureOrders', () => {
  const valid = { delivery: {}, created: 1, details: {}, payment: {}, communicationMethod: [] };
  it('accepts a decrypted order', () => {
    expect(checkStructureOrders(valid)).toBe(true);
  });
  it('rejects an order without a payment block', () => {
    expect(checkStructureOrders({ ...valid, payment: undefined })).toBe(false);
  });
  it('rejects an order whose communicationMethod is not an array', () => {
    expect(checkStructureOrders({ ...valid, communicationMethod: 'Q-Mail' })).toBe(false);
  });
});

describe('checkStructureStore', () => {
  const valid = { title: 'Shop', created: 1, description: 'd', shipsTo: 'Worldwide', shortStoreId: 'abc' };
  it('accepts a store with a shortStoreId', () => {
    expect(checkStructureStore(valid)).toBe(true);
  });
  it('rejects a store without shortStoreId', () => {
    expect(checkStructureStore({ ...valid, shortStoreId: '' })).toBe(false);
  });
});

describe('checkStructureStoreReviews', () => {
  it('rejects a review with rating 0 (upstream behaviour, kept)', () => {
    expect(checkStructureStoreReviews({ title: 't', created: 1, description: 'd', rating: 0 })).toBe(false);
  });
  it('accepts a five star review', () => {
    expect(checkStructureStoreReviews({ title: 't', created: 1, description: 'd', rating: 5 })).toBe(true);
  });
});
