/**
 * One small shop, as the original Q-Shop publishes it, for tests. Names with
 * a space and a `+` on purpose (docs/QORTAL.md → Unusual names).
 *
 * The shapes follow the original app's code (docs/apps/Q-Shop+.md → Data
 * contract); tests that pin a write compare against objects built from these.
 */
export const SELLER = "Seller Name";
export const SELLER_ADDRESS = "QSeLLeRAddressxxxxxxxxxxxxxx9f3c2a";
export const SELLER_PK = "SellerPublicKey1111111111111111111111111111";

export const BUYER = "Buyer+One";
export const BUYER_ADDRESS = "QBuyeRAddressxxxxxxxxxxxxxxxx7b1d0e";
export const BUYER_PK = "BuyerPublicKey22222222222222222222222222222";

export const SHORT_STORE_ID = "my-shop";
export const STORE_ID = `q-store-general-${SHORT_STORE_ID}`;
export const DATA_CONTAINER_ID = `${STORE_ID}-datacontainer`;
export const CATALOGUE_ID = `q-store-catalogue-${SHORT_STORE_ID}-CATxxxxxx1`;
export const ARRR_ADDRESS = "zs1arrrpayoutaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

export const STORE_TITLE = "Seller's Shop";

/** The store JSON (service STORE, identifier STORE_ID, filename store.json). */
export const storeJson = {
  title: STORE_TITLE,
  description: "Mugs, posters and digital art",
  location: "Lisbon",
  shipsTo: "Europe",
  created: 1690000000000,
  shortStoreId: SHORT_STORE_ID,
  logo: "data:image/webp;base64,TE9HTw==",
  foreignCoins: { ARRR: ` ${ARRR_ADDRESS} ` },
  supportedCoins: ["QORT", "ARRR"],
};

/** What Redux holds as the viewed store (Store.tsx getStore). */
export const viewedStore = {
  created: storeJson.created,
  id: STORE_ID,
  title: storeJson.title,
  location: storeJson.location,
  shipsTo: storeJson.shipsTo,
  description: storeJson.description,
  category: undefined,
  tags: [],
  logo: storeJson.logo,
  shortStoreId: SHORT_STORE_ID,
  supportedCoins: storeJson.supportedCoins,
  foreignCoins: storeJson.foreignCoins,
};

const productBase = {
  created: 1690000100000,
  version: 1,
  images: ["data:image/webp;base64,SU1H"],
  mainImageIndex: 0,
  storeId: STORE_ID,
  shortStoreId: SHORT_STORE_ID,
  status: "AVAILABLE",
  user: SELLER,
  catalogueId: CATALOGUE_ID,
};

/** Digital, QORT price only. */
export const mug = {
  ...productBase,
  id: `q-store-product-${SHORT_STORE_ID}-MUGxxxxxx1`,
  title: "Mug",
  description: "A mug",
  type: "digital",
  category: "Kitchen",
  price: [{ currency: "qort", value: 1.5 }],
};

/** Digital, QORT and its own ARRR price. */
export const poster = {
  ...productBase,
  id: `q-store-product-${SHORT_STORE_ID}-POSTERxxx2`,
  title: "Poster",
  description: "A poster",
  type: "digital",
  category: "Art",
  price: [
    { currency: "qort", value: 0.1 },
    { currency: "ARRR", value: 0.25 },
  ],
};

/** Physical, QORT price only. */
export const chair = {
  ...productBase,
  id: `q-store-product-${SHORT_STORE_ID}-CHAIRxxxx3`,
  title: "Chair",
  description: "A chair",
  type: "physical",
  category: "Furniture",
  price: [{ currency: "qort", value: 12 }],
};

/** The catalogue (DOCUMENT CATALOGUE_ID, filename catalogue.json). */
export const catalogue = {
  id: CATALOGUE_ID,
  products: {
    [mug.id]: mug,
    [poster.id]: poster,
    [chair.id]: chair,
  },
};

/** The data container (DOCUMENT DATA_CONTAINER_ID, filename datacontainer.json). */
export const dataContainer = {
  storeId: STORE_ID,
  shortStoreId: SHORT_STORE_ID,
  owner: SELLER,
  products: {
    [mug.id]: { created: mug.created, priceQort: 1.5, category: "Kitchen", catalogueId: CATALOGUE_ID, status: "AVAILABLE" },
    [poster.id]: { created: poster.created, priceQort: 0.1, category: "Art", catalogueId: CATALOGUE_ID, status: "AVAILABLE" },
    [chair.id]: { created: chair.created, priceQort: 12, category: "Furniture", catalogueId: CATALOGUE_ID, status: "AVAILABLE" },
  },
  catalogues: [{ id: CATALOGUE_ID, products: { [mug.id]: true, [poster.id]: true, [chair.id]: true } }],
  id: DATA_CONTAINER_ID,
};

/** Decodes a data64 payload (UTF-8 JSON) the way Core stores it. */
export function decodeData64(data64: unknown): any {
  const bin = atob(String(data64));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Encodes an object as data64 (UTF-8 JSON). */
export function encodeData64(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
