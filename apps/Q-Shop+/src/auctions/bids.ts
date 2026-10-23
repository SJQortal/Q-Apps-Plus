/**
 * Bids on QDN (auctions/rules.ts says which count). A bid is a DOCUMENT the
 * bidder publishes under their own name:
 *
 *   identifier `q-store-bid-<shortStoreId>-<productUid>-<uid6>` (the product
 *   id's own uid, so every bid on a product shares the prefix; at most 55
 *   characters), JSON `{v: 1, productId, storeId, seller, amount, coin:
 *   "QORT", created}`, `filename: "bid.json"`, metadata `title: "Bid"`,
 *   `description: "bid:<amount>;to:<seller, URI-encoded>"` (the amount in
 *   plain decimals).
 *
 * The amount and the seller are in the metadata, so one search (pages of
 * 100, every name) reads every bid without fetching each. A bid counts only
 * for the seller it names: another name's copy of the shop and product (short
 * shop ids aren't unique) never shares its bids. Who bid and when are the
 * search row's (the publishing name, Core's `created`), never the JSON's. A
 * bid republished later (`updated` after `created`, a change or a delete) is
 * marked `edited` and doesn't count.
 */
import { BID_BASE, PRODUCT_BASE } from "../qdn/identifiers";
import { jsonToBase64 } from "../qdn/payloads";
import { searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { amountString, roundQort, type Bid } from "./rules";

/** The prefix every bid on the product starts with, from its id `q-store-product-<short>-<uid>`. */
export function bidPrefix(productId: string): string {
  const rest = productId.startsWith(`${PRODUCT_BASE}-`) ? productId.slice(PRODUCT_BASE.length + 1) : productId;
  return `${BID_BASE}-${rest}-`;
}

export function buildBidPublish(args: { name: string; productId: string; storeId: string; seller: string; amount: number; uid: string; now: number }) {
  const amount = roundQort(args.amount);
  const identifier = `${bidPrefix(args.productId)}${args.uid}`;
  return {
    identifier,
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.name,
      service: "DOCUMENT",
      identifier,
      filename: "bid.json",
      data64: jsonToBase64({ v: 1, productId: args.productId, storeId: args.storeId, seller: args.seller, amount, coin: "QORT", created: args.now }),
      title: "Bid",
      description: bidDescription(amount, args.seller),
    },
  };
}

/** The metadata description of a bid: its amount, and the seller it is for. */
export function bidDescription(amount: number, seller: string): string {
  return `bid:${amountString(amount)};to:${encodeURIComponent(seller)}`;
}

const AMOUNT = /^bid:(\d{1,9}(?:\.\d{1,8})?);to:(\S{1,200})$/;

function decoded(text: string): string | null {
  try {
    return decodeURIComponent(text);
  } catch {
    return null;
  }
}

/** The bids among search rows: this product's prefix exactly, for this seller, an amount in the metadata. */
export function bidsFromRows(rows: readonly QdnResourceSummary[], productId: string, seller: string): Bid[] {
  const prefix = bidPrefix(productId);
  const bids: Bid[] = [];
  for (const row of rows) {
    if (!row?.name || typeof row.identifier !== "string" || !row.identifier.startsWith(prefix)) continue;
    const uid = row.identifier.slice(prefix.length);
    if (!/^[A-Za-z0-9]{1,16}$/.test(uid)) continue;
    const match = AMOUNT.exec(row.metadata?.description?.trim() ?? "");
    const created = Number(row.created);
    if (!match || decoded(match[2]) !== seller || !Number.isFinite(created) || created <= 0) continue;
    const updated = Number(row.updated);
    bids.push({
      id: row.identifier,
      bidder: row.name,
      amount: Number(match[1]),
      created,
      ...(Number.isFinite(updated) && updated > created && { edited: true }),
    });
  }
  return bids;
}

/**
 * Every bid on the seller's product, past the cache when `fresh`. At most
 * 1,000 rows are read; `complete` says whether that was all (if not, bidding
 * and paying stop: the result could be wrong).
 */
export async function fetchBids(productId: string, seller: string, options: { fresh?: boolean } = {}): Promise<{ bids: Bid[]; complete: boolean }> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: bidPrefix(productId), prefix: true, includemetadata: true, reverse: false },
    { pageSize: 100, maxPages: 10, fresh: options.fresh }
  );
  return { bids: bidsFromRows(rows, productId, seller), complete };
}
