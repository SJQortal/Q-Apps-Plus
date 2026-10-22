/**
 * Pure builders for every QDN write the shop makes, other than the order
 * itself (src/money/order.ts). Each one reproduces the original Q-Shop's
 * payload exactly, key order included (docs/apps/Q-Shop+.md → Data contract;
 * pinned by payloads.test.ts and the *.pin tests that run the components).
 */
import {
  CATALOGUE_BASE,
  dataContainerIdentifier,
  statusIdentifierForOrder,
  storeIdentifier,
  reviewIdentifier,
} from "./identifiers";

/** UTF-8 JSON as base64, byte for byte what the original's objectToBase64 produces. */
export function jsonToBase64(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToJson<T = any>(data64: string): T {
  const binary = atob(data64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export interface PublishResource {
  action?: "PUBLISH_QDN_RESOURCE";
  name: string;
  service: string;
  identifier: string;
  data64: string;
  filename?: string;
  title?: string;
  description?: string;
  encrypt?: boolean;
  publicKeys?: string[];
}

// ---------------------------------------------------------------- stores

export interface StoreFields {
  title: string;
  description: string;
  location: string;
  shipsTo: string;
  logo: string;
  foreignCoins: Record<string, string>;
  supportedCoins: string[];
  /** + app, additive: Qortal assets the shop accepts. Omitted when empty. */
  acceptedAssets?: { id: number; name: string }[];
}

/** QDN metadata description of a shop, exactly as the original writes it. */
export function storeMetaDescription(description: string, supportedCoins: string[]): string {
  return `**coins:QORTtrue,ARRR${supportedCoins.includes("ARRR")}**` + description.slice(0, 180);
}

function withAssets<T extends object>(obj: T, assets: StoreFields["acceptedAssets"]): T {
  return assets && assets.length > 0 ? { ...obj, acceptedAssets: assets } : obj;
}

/** The empty product index the original publishes with a new shop. */
export function emptyDataContainer(storeId: string, shortStoreId: string, owner: string) {
  return { storeId, shortStoreId, owner, products: {} as Record<string, unknown> };
}

/**
 * Create shop: the STORE and its empty data container in one
 * PUBLISH_MULTIPLE_QDN_RESOURCES (GlobalWrapper.createStore upstream).
 */
export function buildCreateStorePublish(args: {
  name: string;
  shortStoreId: string;
  fields: StoreFields;
  created: number;
}) {
  const { name, shortStoreId, fields, created } = args;
  const identifier = storeIdentifier(shortStoreId);
  const storeObj = withAssets(
    {
      title: fields.title,
      description: fields.description,
      location: fields.location,
      shipsTo: fields.shipsTo,
      created,
      shortStoreId,
      logo: fields.logo,
      foreignCoins: fields.foreignCoins,
      supportedCoins: fields.supportedCoins,
    },
    fields.acceptedAssets
  );
  const dataContainer = emptyDataContainer(identifier, shortStoreId, name);
  const resourceStore: PublishResource = {
    action: "PUBLISH_QDN_RESOURCE",
    name,
    service: "STORE",
    data64: jsonToBase64(storeObj),
    filename: "store.json",
    title: fields.title,
    description: storeMetaDescription(fields.description, fields.supportedCoins),
    identifier,
  };
  const resourceDataContainer: PublishResource = {
    action: "PUBLISH_QDN_RESOURCE",
    name,
    service: "DOCUMENT",
    data64: jsonToBase64(dataContainer),
    identifier: dataContainerIdentifier(identifier),
    filename: "datacontainer.json",
  };
  return {
    identifier,
    storeObj,
    dataContainer,
    request: {
      action: "PUBLISH_MULTIPLE_QDN_RESOURCES" as const,
      resources: [resourceStore, resourceDataContainer],
    },
  };
}

/**
 * Edit shop: the whole current store object with the edited fields, as the
 * original republishes it (its in-memory store, so `id`, `category`, `tags`
 * and so on go along).
 */
export function buildEditStorePublish(args: {
  name: string;
  currentStore: Record<string, any> & { id: string; shortStoreId?: string };
  fields: StoreFields;
}) {
  const { name, currentStore, fields } = args;
  const shortFromId = currentStore.id.split("q-store-general-")[1];
  let storeObj: Record<string, any> = {
    ...currentStore,
    title: fields.title,
    description: fields.description,
    location: fields.location,
    shipsTo: fields.shipsTo,
    logo: fields.logo,
    shortStoreId: currentStore.shortStoreId ?? shortFromId,
    foreignCoins: fields.foreignCoins,
    supportedCoins: fields.supportedCoins,
  };
  if (fields.acceptedAssets !== undefined) {
    if (fields.acceptedAssets.length > 0) storeObj = { ...storeObj, acceptedAssets: fields.acceptedAssets };
    else {
      const rest = { ...storeObj };
      delete rest.acceptedAssets;
      storeObj = rest;
    }
  }
  return {
    storeObj,
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name,
      service: "STORE",
      data64: jsonToBase64(storeObj),
      filename: "store.json",
      title: fields.title,
      description: storeMetaDescription(fields.description, fields.supportedCoins),
      identifier: currentStore.id,
    },
  };
}

/**
 * Settings → "Recreate shop data": a new, empty product index (the original's
 * EditStoreModal.handleRecreateShopData, which sends no filename). Only on the
 * seller's explicit request: it hides every product of the shop.
 */
export function buildRecreateDataContainerPublish(args: { name: string; storeId: string; shortStoreId: string }) {
  const dataContainer = emptyDataContainer(args.storeId, args.shortStoreId, args.name);
  return {
    dataContainer,
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.name,
      service: "DOCUMENT",
      data64: jsonToBase64(dataContainer),
      identifier: dataContainerIdentifier(args.storeId),
    },
  };
}

// ---------------------------------------------------------------- products

export interface ProductPrice {
  currency: string;
  value: number;
}

export interface ProductDraft {
  id: string;
  created: number;
  price?: ProductPrice[];
  category?: string;
  catalogueId?: string;
  status?: string;
  isUpdate?: boolean;
  [key: string]: unknown;
}

export interface CatalogueDoc {
  id: string;
  products: Record<string, any>;
  [key: string]: unknown;
}

export interface DataContainerDoc {
  storeId: string;
  shortStoreId: string;
  owner: string;
  products: Record<string, { created: number; priceQort: number; category: string; catalogueId: string; status: string }>;
  catalogues?: { id: string; products: Record<string, true> }[];
  id: string;
  [key: string]: unknown;
}

export const MAX_PRODUCTS_PER_CATALOGUE = 10;

function qortPriceOf(product: { price?: ProductPrice[] }): number | undefined {
  return product?.price?.find((item) => item?.currency === "qort")?.value;
}

/**
 * Save products: new drafts fill the shop's last catalogue up to 10 products,
 * then new catalogues open; edited products replace themselves in their
 * catalogue; the data container is updated and goes last. This is
 * ProductManager.publishQDNResource from the original, with its two QDN reads
 * passed in (`fetchCatalogue`) so the result can be tested.
 */
export async function buildProductPublish(args: {
  name: string;
  shortStoreId: string;
  dataContainer: DataContainerDoc;
  productsToSave: Record<string, ProductDraft>;
  fetchCatalogue: (catalogueId: string) => Promise<CatalogueDoc | null>;
  newUid: () => string;
}) {
  const { name, shortStoreId, dataContainer, productsToSave, fetchCatalogue, newUid } = args;
  const lastCatalogue = dataContainer?.catalogues?.at(-1);
  let catalogue: CatalogueDoc | null = null;
  const list: CatalogueDoc[] = [];
  const dc: DataContainerDoc = {
    ...dataContainer,
    products: structuredClone(dataContainer.products),
    catalogues: structuredClone(dataContainer.catalogues),
  };

  if (lastCatalogue && Object.keys(lastCatalogue.products).length < MAX_PRODUCTS_PER_CATALOGUE) {
    const fetched = await fetchCatalogue(lastCatalogue.id);
    if (fetched && !(fetched as { error?: unknown }).error) catalogue = fetched;
  }
  if (catalogue) list.push(catalogue);

  const indexCatalogue = (catalogueId: string, key: string) => {
    if (!dc.catalogues) dc.catalogues = [];
    const at = dc.catalogues.findIndex((item) => item.id === catalogueId);
    if (at >= 0) dc.catalogues[at].products[key] = true;
    else dc.catalogues = [...dc.catalogues, { id: catalogueId, products: { [key]: true } }];
  };

  for (const key of Object.keys(productsToSave).filter((k) => !productsToSave[k]?.isUpdate)) {
    const product = productsToSave[key];
    const priceInQort = qortPriceOf(product);
    if (!priceInQort) throw new Error("Cannot find price for one of your products");
    const last = list.at(-1);
    if (last && Object.keys(last.products).length < MAX_PRODUCTS_PER_CATALOGUE) {
      last.products[key] = { ...product, catalogueId: last.id };
      dc.products[key] = {
        created: product.created,
        priceQort: priceInQort,
        category: (product.category as string) || "",
        catalogueId: last.id,
        status: "AVAILABLE",
      };
      indexCatalogue(last.id, key);
    } else {
      const catalogueId = `${CATALOGUE_BASE}-${shortStoreId}-${newUid()}`;
      list.push({ id: catalogueId, products: { [key]: { ...product, catalogueId } } });
      dc.products[key] = {
        created: product.created,
        priceQort: priceInQort,
        category: (product.category as string) || "",
        catalogueId,
        status: "AVAILABLE",
      };
      indexCatalogue(catalogueId, key);
    }
  }

  const updates = Object.keys(productsToSave)
    .filter((k) => !!productsToSave[k]?.isUpdate)
    .map((k) => productsToSave[k]);
  for (const product of updates) {
    const priceInQort = qortPriceOf(product);
    if (!priceInQort) throw new Error("Cannot find price for one of your products");
    if (priceInQort <= 0) throw new Error("Price cannot be less than or equal to 0");
    dc.products[product.id] = {
      created: product.created,
      priceQort: priceInQort,
      category: (product.category as string) || "",
      catalogueId: product.catalogueId as string,
      status: (product.status as string) || "",
    };
    const at = list.findIndex((cat) => cat.id === product.catalogueId);
    if (at >= 0) {
      list[at].products[product.id] = product;
    } else {
      const fetched = await fetchCatalogue(product.catalogueId as string);
      if (fetched && !(fetched as { error?: unknown }).error) {
        const copy = structuredClone(fetched);
        copy.products[product.id] = product;
        list.push(copy);
      }
    }
  }

  const resources: PublishResource[] = [
    ...list.map((cat) => ({
      name,
      service: "DOCUMENT",
      identifier: cat.id,
      filename: "catalogue.json",
      data64: jsonToBase64(cat),
    })),
    {
      name,
      service: "DOCUMENT",
      identifier: dc.id,
      filename: "datacontainer.json",
      data64: jsonToBase64(dc),
    },
  ];
  return { catalogues: list, dataContainer: dc, resources };
}

// ---------------------------------------------------------------- reviews

export function buildReviewPublish(args: {
  name: string;
  shortStoreId: string;
  uid: string;
  rating: number;
  title: string;
  description: string;
  created: number;
}) {
  const identifier = reviewIdentifier(args.shortStoreId, args.uid, args.rating);
  const review = { title: args.title, description: args.description, rating: args.rating, created: args.created };
  return {
    identifier,
    review,
    /** The original checks the identifier is free first (LIST_QDN_RESOURCES). */
    existsCheck: {
      action: "LIST_QDN_RESOURCES" as const,
      service: "DOCUMENT",
      name: args.name,
      identifier,
      includeMetadata: true,
      limit: 1,
    },
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.name,
      service: "DOCUMENT",
      identifier,
      data64: jsonToBase64(review),
      filename: "review.json",
      title: args.title.slice(0, 60),
      description: args.description.slice(0, 150),
    },
  };
}

// ---------------------------------------------------------------- order status

export const ORDER_STATUSES = ["Received", "Shipped", "Refunded"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The seller's status note for an order, encrypted to the buyer and the seller. */
export function buildStatusPublish(args: {
  orderId: string;
  seller: string;
  status: string;
  note: string;
  buyerPublicKey: string;
  sellerPublicKey: string;
}) {
  return {
    action: "PUBLISH_QDN_RESOURCE" as const,
    identifier: statusIdentifierForOrder(args.orderId),
    name: args.seller,
    service: "DOCUMENT_PRIVATE",
    filename: `${args.orderId}_status.json`,
    data64: jsonToBase64({ status: args.status, note: args.note }),
    encrypt: true,
    publicKeys: [args.buyerPublicKey, args.sellerPublicKey],
  };
}
