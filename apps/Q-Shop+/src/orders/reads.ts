/**
 * Every Qortal read behind the order lists and the order dialog
 * (docs/apps/Q-Shop+.md → Data contract, Qortal call inventory):
 *
 * - order rows: one search per page of 20, by `identifier` + `prefix`
 *   (never `query=`), the buyer's by name, the seller's for all buyers with
 *   the exact shop re-checked in code (`q-store-order-my-shop-` also matches
 *   shop `my-shop-2`);
 * - an order: FETCH (base64) + DECRYPT_DATA, as the original
 *   (utils/fetchOrders.ts), cached by buyer name + identifier + updated;
 * - statuses: one search per list (seller) or per page (buyer) instead of
 *   one per opened order, then FETCH + DECRYPT only for statuses that exist,
 *   with the buyer's key looked up once per name (GET_NAME_DATA →
 *   GET_ACCOUNT_DATA), cached by seller + identifier + updated;
 * - a payment: `/transactions/signature/<sig>`, on demand.
 */
import { mapWithConcurrency, searchQdn, searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import {
  ORDER_BASE,
  STATUS_ORDER_BASE,
  orderIdForStatus,
  shopOrdersPrefix,
  shopStatusPrefix,
  shortStoreIdOfOrder,
  statusIdentifierForOrder,
} from "../qdn/identifiers";
import { base64ToJson } from "../qdn/payloads";
import { OrderReadError, readOrderJson, type OrderReadStage } from "../utils/fetchOrders";
import type { Order, OrderStatusInfo } from "../state/features/orderSlice";
import { NO_STATUS_DOCUMENT, statusInfoFrom } from "./status";
import { displaySafeOrder } from "./format";

export const ORDER_PAGE = 20;
/** Status searches page by 100, at most 5 pages (500 rows), never unlimited. */
export const STATUS_PAGE = 100;
export const STATUS_MAX_PAGES = 5;
/** Orders and statuses opened at once. */
export const OPEN_CONCURRENCY = 5;

/**
 * Waits before asking again for a resource the node doesn't have yet
 * (docs/QORTAL.md → pitfall 14). Tests shorten it.
 */
export const fetchRetry = { delaysMs: [2000, 4000, 8000] };

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Qortal names are unique without case; Core may answer in another case than asked. */
export function sameName(a: string | undefined | null, b: string | undefined | null): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

function toRow(row: QdnResourceSummary): Order {
  return { id: row.identifier, user: row.name, created: row.created ?? 0, updated: row.updated ?? row.created ?? 0 };
}

export interface OrderPage {
  rows: Order[];
  /** Raw rows the search returned: the next page's offset moves by this. */
  read: number;
  hasMore: boolean;
}

/** One page of the orders `buyer` placed, newest first. */
export async function searchBuyerOrders(buyer: string, offset: number, fresh = false): Promise<OrderPage> {
  const raw = await searchQdn(
    {
      service: "DOCUMENT_PRIVATE",
      identifier: `${ORDER_BASE}-`,
      prefix: true,
      name: buyer,
      exactmatchnames: true,
      reverse: true,
      limit: ORDER_PAGE,
      offset,
    },
    { fresh }
  );
  const rows = raw.filter((r) => sameName(r.name, buyer) && shortStoreIdOfOrder(r.identifier) !== null).map(toRow);
  return { rows, read: raw.length, hasMore: raw.length === ORDER_PAGE };
}

/** One page of the orders a shop received (every buyer), newest first. */
export async function searchShopOrders(shortStoreId: string, offset: number, fresh = false): Promise<OrderPage> {
  const raw = await searchQdn(
    {
      service: "DOCUMENT_PRIVATE",
      identifier: shopOrdersPrefix(shortStoreId),
      prefix: true,
      reverse: true,
      limit: ORDER_PAGE,
      offset,
    },
    { fresh }
  );
  const rows = raw.filter((r) => shortStoreIdOfOrder(r.identifier) === shortStoreId).map(toRow);
  return { rows, read: raw.length, hasMore: raw.length === ORDER_PAGE };
}

/** Search pages read at most for one page of a shop's orders (5 × 20 rows). */
export const SHOP_SCAN_PAGES = 5;

/**
 * One page of the orders a shop received, reading on while a whole search
 * page belonged to other shops. `q-store-order-art-` also matches every
 * order of a shop `art-prints`; when 20 of those are newer than `art`'s
 * latest order, the first search page has no row for `art` at all, and the
 * list would say "No orders yet" while `art` has orders. Bounded: at most
 * SHOP_SCAN_PAGES searches, then the caller pages on as usual.
 */
export async function searchShopOrdersPage(shortStoreId: string, offset: number, fresh = false): Promise<OrderPage> {
  let page = await searchShopOrders(shortStoreId, offset, fresh);
  let read = page.read;
  for (let scanned = 1; page.rows.length === 0 && page.hasMore && scanned < SHOP_SCAN_PAGES; scanned++) {
    page = await searchShopOrders(shortStoreId, offset + read, fresh);
    read += page.read;
  }
  return { rows: page.rows, read, hasMore: page.hasMore };
}

// ------------------------------------------------------------------ orders

export type OpenOutcome = { ok: true; order: Order } | { ok: false; stage: OrderReadStage };

const openedOrders = new Map<string, { updated: number; json: Promise<any> }>();

function orderCacheKey(row: Order): string {
  return `${row.user}\n${row.id}`;
}

/**
 * One attempt at opening an order (FETCH + DECRYPT_DATA), shared with any
 * attempt already running and cached once it succeeds. The search row's
 * name, id and dates win over the JSON's (docs/QORTAL.md → pitfall 15), as
 * the original merges them.
 */
export async function openOrderOnce(row: Order, fresh = false): Promise<OpenOutcome> {
  const key = orderCacheKey(row);
  const cached = openedOrders.get(key);
  let json: Promise<any>;
  if (!fresh && cached && cached.updated >= row.updated) {
    json = cached.json;
  } else {
    json = readOrderJson(row.user, row.id);
    const entry = { updated: row.updated, json };
    openedOrders.set(key, entry);
    json.catch(() => {
      if (openedOrders.get(key) === entry) openedOrders.delete(key);
    });
  }
  try {
    const order = await json;
    return {
      ok: true,
      order: displaySafeOrder({ ...order, created: row.created, updated: row.updated, user: row.user, id: row.id, isValid: true }),
    };
  } catch (error) {
    return { ok: false, stage: error instanceof OrderReadError ? error.stage : "fetch" };
  }
}

// ------------------------------------------------------------------ statuses

const nameOwners = new Map<string, Promise<string>>();
const publicKeys = new Map<string, Promise<string>>();

/** The address that owns `name` (GET_NAME_DATA), cached for the session. */
export function nameOwner(name: string): Promise<string> {
  let owner = nameOwners.get(name);
  if (!owner) {
    owner = qortalRequest({ action: "GET_NAME_DATA", name }).then((data: any) => {
      if (!data?.owner) throw new Error(`Cannot find the owner of ${name}`);
      return String(data.owner);
    });
    nameOwners.set(name, owner);
    owner.catch(() => nameOwners.delete(name));
  }
  return owner;
}

/**
 * The public key of the account behind `name`, as the original finds it to
 * read a status (GET_NAME_DATA → GET_ACCOUNT_DATA), cached for the session.
 */
export function cachedPublicKey(name: string): Promise<string> {
  let key = publicKeys.get(name);
  if (!key) {
    key = nameOwner(name).then(async (address) => {
      const account = await qortalRequest({ action: "GET_ACCOUNT_DATA", address });
      if (!account?.publicKey) throw new Error(`Cannot find the account of ${name}`);
      return String(account.publicKey);
    });
    publicKeys.set(name, key);
    key.catch(() => publicKeys.delete(name));
  }
  return key;
}

const statusDocs = new Map<string, { updated: number; info: Promise<OrderStatusInfo> }>();

async function readStatusOnce(seller: string, identifier: string, buyer: string, updated: number): Promise<OrderStatusInfo> {
  let attempt = 0;
  for (;;) {
    let encrypted: unknown;
    try {
      encrypted = await qortalRequest({
        action: "FETCH_QDN_RESOURCE",
        name: seller,
        service: "DOCUMENT_PRIVATE",
        identifier,
        encoding: "base64",
      });
    } catch {
      encrypted = null;
    }
    if (typeof encrypted === "string" && encrypted && !/^\s*[{[]/.test(encrypted)) {
      const publicKey = await cachedPublicKey(buyer);
      const decrypted = await qortalRequest({ action: "DECRYPT_DATA", encryptedData: encrypted, publicKey });
      if (typeof decrypted !== "string" || !decrypted) throw new Error("Could not decrypt the status");
      return statusInfoFrom(base64ToJson(decrypted), updated);
    }
    const delay = fetchRetry.delaysMs[attempt++];
    if (delay === undefined) throw new Error("The status is not on this node");
    await sleep(delay);
  }
}

/**
 * The status document of `row` (published by `seller`), decrypted with the
 * buyer's key. Never rejects: a document that can't be read gives
 * `state: "error"`.
 */
export async function readStatus(seller: string, row: QdnResourceSummary, buyer: string): Promise<OrderStatusInfo> {
  const key = `${seller}\n${row.identifier}`;
  const updated = row.updated ?? row.created ?? 0;
  const cached = statusDocs.get(key);
  let info: Promise<OrderStatusInfo>;
  // A republished status has a newer `updated`, so the cache never needs bypassing.
  if (cached && cached.updated >= updated) {
    info = cached.info;
  } else {
    info = readStatusOnce(seller, row.identifier, buyer, updated);
    const entry = { updated, info };
    statusDocs.set(key, entry);
    info.catch(() => {
      if (statusDocs.get(key) === entry) statusDocs.delete(key);
    });
  }
  try {
    return await info;
  } catch {
    return { state: "error", status: "", note: "", updated };
  }
}

/** Status rows by order id, and whether the search saw every row. */
export interface StatusIndex {
  rows: Map<string, QdnResourceSummary>;
  complete: boolean;
}

function keepNewest(map: Map<string, QdnResourceSummary>, orderId: string, row: QdnResourceSummary) {
  const current = map.get(orderId);
  if (!current || (row.updated ?? 0) > (current.updated ?? 0)) map.set(orderId, row);
}

/** Every status `seller` published for the shop: one search (paged by 100, at most 500). */
export async function shopStatusIndex(seller: string, shortStoreId: string, fresh = false): Promise<StatusIndex> {
  const { rows, complete } = await searchQdnAll(
    {
      service: "DOCUMENT_PRIVATE",
      identifier: shopStatusPrefix(shortStoreId),
      prefix: true,
      name: seller,
      exactmatchnames: true,
      reverse: true,
    },
    { pageSize: STATUS_PAGE, maxPages: STATUS_MAX_PAGES, fresh }
  );
  const map = new Map<string, QdnResourceSummary>();
  for (const row of rows) {
    if (!sameName(row.name, seller)) continue;
    const orderId = orderIdForStatus(row.identifier);
    if (shortStoreIdOfOrder(orderId) !== shortStoreId) continue;
    keepNewest(map, orderId, row);
  }
  return { rows: map, complete };
}

/**
 * The statuses of a page of the buyer's orders: one search over the page's
 * sellers (each order's status must come from its own seller).
 */
export async function buyerStatusIndex(orders: { id: string; seller: string }[], fresh = false): Promise<StatusIndex> {
  const sellers = [...new Set(orders.map((o) => o.seller).filter(Boolean))].sort();
  const map = new Map<string, QdnResourceSummary>();
  if (sellers.length === 0) return { rows: map, complete: true };
  const wanted = new Map(orders.map((o) => [statusIdentifierForOrder(o.id), o]));
  const { rows, complete } = await searchQdnAll(
    {
      service: "DOCUMENT_PRIVATE",
      identifier: `${STATUS_ORDER_BASE}-`,
      prefix: true,
      names: sellers,
      exactmatchnames: true,
      reverse: true,
    },
    { pageSize: STATUS_PAGE, maxPages: STATUS_MAX_PAGES, fresh }
  );
  for (const row of rows) {
    const order = wanted.get(row.identifier);
    if (order && sameName(row.name, order.seller)) keepNewest(map, order.id, row);
  }
  return { rows: map, complete };
}

/** The status row of one order, by its seller's name: at most one row. */
export async function findStatusRow(seller: string, orderId: string, fresh = false): Promise<QdnResourceSummary | null> {
  const identifier = statusIdentifierForOrder(orderId);
  const rows = await searchQdn(
    { service: "DOCUMENT_PRIVATE", identifier, name: seller, exactmatchnames: true, limit: 1, includemetadata: false },
    { fresh }
  );
  return rows.find((r) => r.identifier === identifier && sameName(r.name, seller)) ?? null;
}

export interface StatusTarget {
  orderId: string;
  /** Who publishes the status: the shop's owner. */
  seller: string;
  /** Whose key decrypts it: the order's publisher. */
  buyer: string;
}

const STATUS_ERROR: OrderStatusInfo = { state: "error", status: "", note: "", updated: 0 };

/**
 * Each order's status from an index (5 reads at a time). An order the index
 * doesn't have is "Received" when the index is complete; otherwise it is
 * looked up on its own. `onEach` gets each status as soon as it is known.
 */
export async function resolveStatuses(
  targets: StatusTarget[],
  index: StatusIndex | null,
  onEach: (orderId: string, info: OrderStatusInfo) => void,
  fresh = false
): Promise<void> {
  await mapWithConcurrency(targets, OPEN_CONCURRENCY, async (target) => {
    let row = index?.rows.get(target.orderId) ?? null;
    if (!row && !index?.complete) {
      try {
        row = await findStatusRow(target.seller, target.orderId, fresh);
      } catch {
        onEach(target.orderId, STATUS_ERROR);
        return;
      }
    }
    onEach(target.orderId, row ? await readStatus(target.seller, row, target.buyer) : NO_STATUS_DOCUMENT);
  });
}

// ------------------------------------------------------------------ payments

/** The fields of Core's transaction JSON the order dialog shows. */
export interface PaymentTransaction {
  type?: string;
  signature?: string;
  timestamp?: number;
  amount?: string | number;
  fee?: string | number;
  recipient?: string;
  creatorAddress?: string;
  blockHeight?: number;
  assetId?: number;
  assetName?: string;
  approvalStatus?: string;
}

/** A confirmed transaction by signature (`/transactions/signature/<sig>`). */
export async function fetchPaymentTransaction(signature: string): Promise<PaymentTransaction> {
  const response = await fetch(`/transactions/signature/${encodeURIComponent(signature)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || !body || typeof body !== "object" || Array.isArray(body) || "error" in body) {
    throw new Error("Transaction not found");
  }
  return body as PaymentTransaction;
}

/** For tests. */
export function resetOrderReadCaches(): void {
  openedOrders.clear();
  nameOwners.clear();
  publicKeys.clear();
  statusDocs.clear();
}

/** After the seller publishes a status: read it again next time. */
export function forgetStatus(seller: string, orderId: string): void {
  statusDocs.delete(`${seller}\n${statusIdentifierForOrder(orderId)}`);
}
