/**
 * Bids on QDN (auctions/rules.ts says which count). A bid is a DOCUMENT the
 * bidder publishes under their own name:
 *
 *   identifier `q-store-bid-<shortStoreId>-<productUid>-<uid6>` (the product
 *   id's own uid, so every bid on a product shares the prefix; at most 55
 *   characters), JSON `{v: 1, productId, storeId, seller, amount, coin:
 *   "QORT", created}`, `filename: "bid.json"`, metadata `title: "Bid"`,
 *   `description: "bid:<amount>"`.
 *
 * The amount is in the metadata, so one search (pages of 100, every name)
 * reads every bid without fetching each; who bid and when are the search
 * row's (the publishing name, Core's `created`), never the JSON's. A bid
 * republished later (`updated` after `created`, a change or a delete) is
 * marked `edited` and doesn't count.
 */
import { BID_BASE, PRODUCT_BASE } from "../qdn/identifiers";
import { jsonToBase64 } from "../qdn/payloads";
import { searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { roundQort, type Bid } from "./rules";

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
      description: `bid:${amount}`,
    },
  };
}

const AMOUNT = /^bid:(\d+(?:\.\d{1,8})?)$/;

/** The bids among search rows: this product's prefix exactly, an amount in the metadata. */
export function bidsFromRows(rows: readonly QdnResourceSummary[], productId: string): Bid[] {
  const prefix = bidPrefix(productId);
  const bids: Bid[] = [];
  for (const row of rows) {
    if (!row?.name || typeof row.identifier !== "string" || !row.identifier.startsWith(prefix)) continue;
    const uid = row.identifier.slice(prefix.length);
    if (!/^[A-Za-z0-9]{1,16}$/.test(uid)) continue;
    const match = AMOUNT.exec(row.metadata?.description?.trim() ?? "");
    const created = Number(row.created);
    if (!match || !Number.isFinite(created) || created <= 0) continue;
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

/** Every bid on the product (at most 1,000), newest reads when `fresh`. */
export async function fetchBids(productId: string, options: { fresh?: boolean } = {}): Promise<{ bids: Bid[]; complete: boolean }> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: bidPrefix(productId), prefix: true, includemetadata: true, reverse: false },
    { pageSize: 100, maxPages: 10, fresh: options.fresh }
  );
  return { bids: bidsFromRows(rows, productId), complete };
}
