/**
 * A fake Qortal node for tests: answers the app's direct Core fetches
 * (`/arbitrary/…`, `/names/…`, `/crosschain/price/…`, `/transactions/…`) and
 * its `qortalRequest` reads from one small world of shops, products, reviews
 * and orders, and counts every call so tests can measure first loads.
 *
 *   const node = installMockNode(makeWorld({ shops: 24 }));
 *   … render …
 *   node.summary()  // { searches: 3, fetches: { STORE: 20, … }, hub: { GET_USER_ACCOUNT: 1, … } }
 *
 * Writes (PUBLISH_*, SEND_COIN, TRANSFER_ASSET, DECRYPT_DATA) are refused
 * unless a test adds a handler: nothing here can reach a real node.
 */
import { vi } from "vitest";
import { installQortalMock, type QortalMock } from "./qortalMock";
import { encodeData64 } from "./fixtures/shop";

export interface WorldShop {
  owner: string;
  shortStoreId: string;
  title: string;
  description: string;
  created: number;
  updated: number;
  supportedCoins: string[];
  foreignCoins: Record<string, string>;
  products: any[];
  logo?: string;
  /**
   * Its owner deleted it: the shop, its product list and its catalogues serve
   * the delete marker "D". "marked" also retitles the shop's search row
   * "deleted" (Q-Shop+'s delete); "plain" leaves the old metadata (other tools).
   */
  deleted?: "plain" | "marked";
}

export interface WorldReview {
  name: string;
  shortStoreId: string;
  uid: string;
  rating: number;
  title: string;
  description: string;
  created: number;
}

export interface World {
  me: { name: string; address: string; publicKey: string } | null;
  names: Record<string, string>; // address -> name
  shops: WorldShop[];
  reviews: WorldReview[];
  /** Encrypted orders: identifier -> { buyer, json } (DECRYPT_DATA returns the JSON). */
  orders: { identifier: string; buyer: string; created: number; json: any }[];
  statuses: { identifier: string; seller: string; created: number; json: any }[];
  arrrRate: string;
}

const LOGO = "data:image/webp;base64,TE9HTw==";

export function makeWorld(opts: { shops?: number; productsPerShop?: number; me?: World["me"] } = {}): World {
  const shops: WorldShop[] = [];
  const count = opts.shops ?? 24;
  for (let i = 0; i < count; i++) {
    const owner = i === 0 ? "Seller Name" : i === 1 ? "Shop+Plus" : `Seller ${i}`;
    const short = i === 0 ? "my-shop" : `shop-${i}`;
    const products = [];
    for (let p = 0; p < (opts.productsPerShop ?? 12); p++) {
      products.push({
        title: p === 0 ? "A product with a long title that wraps over two lines on phones" : `Product ${p}`,
        description: `Description of product ${p}`,
        created: 1700000000000 + i * 1000 + p,
        version: 1,
        images: [LOGO],
        mainImageIndex: 0,
        type: p % 3 === 0 ? "physical" : "digital",
        price: [{ currency: "qort", value: 1 + p }],
        storeId: `q-store-general-${short}`,
        shortStoreId: short,
        category: p % 2 ? "Art" : "Kitchen",
        id: `q-store-product-${short}-P${String(p).padStart(9, "0")}`,
        status: p === 5 ? "OUT_OF_STOCK" : "AVAILABLE",
        user: owner,
      });
    }
    shops.push({
      owner,
      shortStoreId: short,
      title: i === 0 ? "Seller's Shop" : `Shop number ${i}`,
      description: `Everything shop ${i} sells`,
      created: 1690000000000 + i * 3600_000,
      updated: 1690000000000 + i * 3600_000 + 60_000,
      supportedCoins: i % 2 ? ["QORT"] : ["QORT", "ARRR"],
      foreignCoins: i % 2 ? { ARRR: "" } : { ARRR: "zs1arrr" },
      products,
    });
  }
  const reviews: WorldReview[] = [];
  for (let i = 0; i < 6; i++) {
    reviews.push({
      name: `Reviewer ${i}`,
      shortStoreId: "my-shop",
      uid: `REVIEW${String(i).padStart(4, "0")}`,
      rating: 3 + (i % 3) * 0.5,
      title: `Review ${i}`,
      description: `Review text ${i}`,
      created: 1700000500000 + i,
    });
  }
  return {
    me: opts.me === undefined ? { name: "Buyer+One", address: "QBuyeRAddressxxxxxxxxxxxxxxxx7b1d0e", publicKey: "BuyerPK" } : opts.me,
    names: {},
    shops,
    reviews,
    orders: [],
    statuses: [],
    arrrRate: "25000000",
  };
}

function catalogueIdsOf(shop: WorldShop): string[] {
  const ids: string[] = [];
  for (let i = 0; i < shop.products.length; i += 10) ids.push(`q-store-catalogue-${shop.shortStoreId}-CAT${String(i / 10).padStart(7, "0")}`);
  return ids;
}

export function storeJsonOf(shop: WorldShop) {
  return {
    title: shop.title,
    description: shop.description,
    location: "Lisbon",
    shipsTo: "Europe",
    created: shop.created,
    shortStoreId: shop.shortStoreId,
    logo: shop.logo ?? LOGO,
    foreignCoins: shop.foreignCoins,
    supportedCoins: shop.supportedCoins,
  };
}

export function dataContainerOf(shop: WorldShop) {
  const storeId = `q-store-general-${shop.shortStoreId}`;
  const cats = catalogueIdsOf(shop);
  const products: Record<string, any> = {};
  const catalogues = cats.map((id) => ({ id, products: {} as Record<string, true> }));
  shop.products.forEach((p, idx) => {
    const cat = cats[Math.floor(idx / 10)];
    products[p.id] = { created: p.created, priceQort: p.price[0].value, category: p.category, catalogueId: cat, status: p.status };
    catalogues[Math.floor(idx / 10)].products[p.id] = true;
  });
  return { storeId, shortStoreId: shop.shortStoreId, owner: shop.owner, products, catalogues, id: `${storeId}-datacontainer` };
}

export function catalogueOf(shop: WorldShop, catalogueId: string) {
  const cats = catalogueIdsOf(shop);
  const at = cats.indexOf(catalogueId);
  if (at < 0) return null;
  const products: Record<string, any> = {};
  for (const p of shop.products.slice(at * 10, at * 10 + 10)) products[p.id] = { ...p, catalogueId };
  return { id: catalogueId, products };
}

interface Row {
  name: string;
  service: string;
  identifier: string;
  created: number;
  updated: number;
  size: number;
  metadata?: any;
}

function allRows(world: World): Row[] {
  const rows: Row[] = [];
  for (const s of world.shops) {
    const storeId = `q-store-general-${s.shortStoreId}`;
    rows.push({
      name: s.owner,
      service: "STORE",
      identifier: storeId,
      created: s.created,
      updated: s.updated,
      size: s.deleted ? 32 : 2000,
      metadata:
        s.deleted === "marked"
          ? { title: "deleted", description: "deleted", tags: ["deleted"] }
          : { title: s.title, description: `**coins:QORTtrue,ARRR${s.supportedCoins.includes("ARRR")}**${s.description}` },
    });
    rows.push({
      name: s.owner,
      service: "DOCUMENT",
      identifier: `${storeId}-datacontainer`,
      created: s.created,
      updated: s.updated + 1000,
      size: 150 + 120 * s.products.length,
    });
    for (const id of catalogueIdsOf(s)) {
      rows.push({ name: s.owner, service: "DOCUMENT", identifier: id, created: s.created, updated: s.updated, size: 20000 });
    }
  }
  for (const r of world.reviews) {
    rows.push({
      name: r.name,
      service: "DOCUMENT",
      identifier: `q-store-review-${r.shortStoreId}-${r.uid}-${r.rating * 10}`,
      created: r.created,
      updated: r.created,
      size: 200,
      metadata: { title: r.title, description: r.description },
    });
  }
  for (const o of world.orders) {
    rows.push({ name: o.buyer, service: "DOCUMENT_PRIVATE", identifier: o.identifier, created: o.created, updated: o.created, size: 900 });
  }
  for (const st of world.statuses) {
    rows.push({ name: st.seller, service: "DOCUMENT_PRIVATE", identifier: st.identifier, created: st.created, updated: st.created, size: 300 });
  }
  return rows;
}

function search(world: World, params: URLSearchParams): Row[] {
  const service = params.get("service");
  const identifier = params.get("identifier");
  const query = params.get("query")?.toLowerCase();
  const names = params.getAll("name");
  const prefix = params.get("prefix") === "true";
  const exact = params.get("exactmatchnames") === "true";
  const limit = Number(params.get("limit") ?? 20) || Number.MAX_SAFE_INTEGER;
  const offset = Number(params.get("offset") ?? 0);
  const reverse = params.get("reverse") === "true";
  const withMeta = params.get("includemetadata") === "true";
  let rows = allRows(world).filter((r) => !service || r.service === service);
  // As Core: a prefix with prefix=true, otherwise anywhere in the identifier; both ignore case.
  if (identifier) {
    const needle = identifier.toLowerCase();
    rows = rows.filter((r) => (prefix ? r.identifier.toLowerCase().startsWith(needle) : r.identifier.toLowerCase().includes(needle)));
  }
  if (query)
    rows = rows.filter(
      (r) =>
        r.identifier.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query) ||
        String(r.metadata?.title ?? "").toLowerCase().includes(query) ||
        String(r.metadata?.description ?? "").toLowerCase().includes(query)
    );
  if (names.length) rows = rows.filter((r) => names.some((n) => (exact ? r.name === n : r.name.toLowerCase().includes(n.toLowerCase()))));
  rows.sort((a, b) => a.created - b.created);
  if (reverse) rows.reverse();
  return rows.slice(offset, offset + limit).map((r) => (withMeta ? r : { ...r, metadata: undefined }));
}

export interface MockNode {
  q: QortalMock;
  fetchCalls: string[];
  /** Counts by kind: searches by service, resource fetches by service, other Core paths, Hub actions. */
  summary: () => {
    searches: Record<string, number>;
    unlimitedSearches: number;
    resources: Record<string, number>;
    other: Record<string, number>;
    hub: Record<string, number>;
  };
  reset: () => void;
}

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

export function installMockNode(world: World): MockNode {
  const fetchCalls: string[] = [];
  const findShop = (owner: string, storeId: string) =>
    world.shops.find((s) => s.owner === owner && `q-store-general-${s.shortStoreId}` === storeId);

  const fetchMock = vi.fn(async (input: string) => {
    const url = String(input);
    fetchCalls.push(url);
    const [path, qs] = url.split("?");
    const params = new URLSearchParams(qs ?? "");
    if (path === "/arbitrary/resources/search" || path === "/arbitrary/resources") return json(search(world, params));
    if (path.startsWith("/names/address/")) {
      const address = decodeURIComponent(path.split("/")[3]);
      const name = world.me && world.me.address === address ? world.me.name : world.names[address];
      return json(name ? [{ name, owner: address }] : []);
    }
    if (path.startsWith("/crosschain/price/")) return json(world.arrrRate);
    if (path.startsWith("/transactions/")) return json([]);
    const m = path.match(/^\/arbitrary\/([A-Z_]+)\/([^/]+)\/([^/]+)$/);
    if (m) {
      const [, service, rawName, rawId] = m;
      const name = decodeURIComponent(rawName);
      const id = decodeURIComponent(rawId);
      if (service === "STORE") {
        const shop = findShop(name, id);
        if (shop?.deleted) return json("D");
        return shop ? json(storeJsonOf(shop)) : json({ error: 1401, message: "not found" }, 404);
      }
      if (service === "DOCUMENT" && id.endsWith("-datacontainer")) {
        const shop = findShop(name, id.replace(/-datacontainer$/, ""));
        if (shop?.deleted) return json("D");
        return shop ? json(dataContainerOf(shop)) : json({ error: 1401, message: "not found" }, 404);
      }
      if (service === "DOCUMENT" && id.startsWith("q-store-review-")) {
        const r = world.reviews.find((x) => x.name === name && id.startsWith(`q-store-review-${x.shortStoreId}-${x.uid}`));
        return r ? json({ title: r.title, description: r.description, rating: r.rating, created: r.created }) : json({ error: 1401 }, 404);
      }
      if (service === "DOCUMENT" && id.startsWith("q-store-catalogue-")) {
        const shop = world.shops.find((s) => s.owner === name);
        const cat = shop ? catalogueOf(shop, id) : null;
        if (cat && shop?.deleted) return json("D");
        return cat ? json(cat) : json({ error: 1401 }, 404);
      }
      if (service === "THUMBNAIL") return json({ error: 1401 }, 404);
    }
    return json({ error: 404, message: `mock node: no route for ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);

  const q = installQortalMock({
    GET_USER_ACCOUNT: async () => {
      if (!world.me) throw { error: "No account" };
      return { address: world.me.address, publicKey: world.me.publicKey };
    },
    GET_ACCOUNT_NAMES: async () => (world.me ? [{ name: world.me.name, owner: world.me.address }] : []),
    GET_PRIMARY_NAME: async () => world.me?.name ?? "",
    GET_QDN_RESOURCE_URL: async (p) => `/arbitrary/${p.service}/${encodeURIComponent(String(p.name))}/${p.identifier}`,
    SEARCH_QDN_RESOURCES: async (p) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(p)) {
        if (k === "action" || v === undefined) continue;
        params.set(k === "exactMatchNames" ? "exactmatchnames" : k === "includeMetadata" ? "includemetadata" : k, String(v));
      }
      return search(world, params);
    },
    FETCH_QDN_RESOURCE: async (p) => {
      const name = String(p.name);
      const id = String(p.identifier);
      if (id.startsWith("q-store-catalogue-")) {
        const shop = world.shops.find((s) => s.owner === name);
        const cat = shop ? catalogueOf(shop, id) : null;
        return cat && shop?.deleted ? "D" : cat;
      }
      const order = world.orders.find((o) => o.identifier === id && o.buyer === name);
      if (order) return `ENC:${id}`;
      const status = world.statuses.find((s) => s.identifier === id && s.seller === name);
      if (status) return `ENC:${id}`;
      throw { error: 1401, message: "Not found" };
    },
    DECRYPT_DATA: async (p) => {
      const id = String(p.encryptedData).replace(/^ENC:/, "");
      const order = world.orders.find((o) => o.identifier === id);
      if (order) return encodeData64(order.json);
      const status = world.statuses.find((s) => s.identifier === id);
      if (status) return encodeData64(status.json);
      throw { error: "Unable to decrypt" };
    },
    GET_LIST_ITEMS: async () => [],
    GET_NAME_DATA: async (p) => ({ name: p.name, owner: `Q${String(p.name).replace(/\W/g, "")}Address` }),
    GET_ACCOUNT_DATA: async (p) => ({ address: p.address, publicKey: `${p.address}-pk` }),
  });

  const count = (keys: string[]) => keys.reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {});
  return {
    q,
    fetchCalls,
    summary: () => {
      const searchUrls = fetchCalls.filter((u) => u.startsWith("/arbitrary/resources"));
      const hubSearches = q.callsFor("SEARCH_QDN_RESOURCES");
      return {
        searches: count([
          ...searchUrls.map((u) => new URLSearchParams(u.split("?")[1]).get("service") ?? "?"),
          ...hubSearches.map((c) => `${c.service} (Hub)`),
        ]),
        unlimitedSearches:
          searchUrls.filter((u) => /[?&]limit=0(&|$)/.test(u) || !/[?&]limit=/.test(u)).length +
          hubSearches.filter((c) => !c.limit).length,
        resources: count(
          fetchCalls
            .filter((u) => /^\/arbitrary\/[A-Z_]+\//.test(u) && !u.startsWith("/arbitrary/resources"))
            .map((u) => {
              const id = decodeURIComponent(u.split("/")[4] ?? "");
              const service = u.split("/")[2];
              if (service === "DOCUMENT" && id.endsWith("-datacontainer")) return "data container";
              if (service === "DOCUMENT" && id.startsWith("q-store-review-")) return "review";
              return service;
            })
        ),
        other: count(fetchCalls.filter((u) => !u.startsWith("/arbitrary/")).map((u) => u.split("?")[0].split("/").slice(0, 3).join("/"))),
        hub: count(q.calls.map((c) => (c.action === "FETCH_QDN_RESOURCE" ? `FETCH ${String(c.identifier).split("-").slice(0, 3).join("-")}` : c.action))),
      };
    },
    reset: () => {
      fetchCalls.length = 0;
      q.reset();
    },
  };
}

/** An IntersectionObserver that reports every observed element in view once, so "load more" sentinels fire. */
export function installVisibleIntersectionObserver(): void {
  class VisibleObserver {
    private cb: IntersectionObserverCallback;
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[];
    constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.cb = cb;
      const t = options?.threshold;
      this.thresholds = Array.isArray(t) ? t : [t ?? 0];
    }
    observe(el: Element) {
      queueMicrotask(() =>
        this.cb([{ isIntersecting: true, intersectionRatio: 1, target: el } as unknown as IntersectionObserverEntry], this as any)
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", VisibleObserver);
}
