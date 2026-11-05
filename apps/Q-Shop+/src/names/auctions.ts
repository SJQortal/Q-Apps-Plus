/**
 * Name auctions (Simon, 2026-10-24: "make sure the names can be sold as
 * auction"). Core sells a name only at a price (SELL_NAME), so an auction
 * runs on QDN with the product auctions' rules (auctions/rules.ts: bids in
 * QORT, a step over the leader, late bids extend it, a reserve and a buy-now
 * price if the seller wants), and ends on chain:
 *
 * - The listing is published **under the name itself**, so only its owner
 *   can make one: DOCUMENT `q-store-nameauction`, JSON `{v: 1, name, owner
 *   (address), uid, terms, created}`, `filename: "auction.json"`, metadata
 *   `title: "Name auction"`, `description: "nameauc:<uid>;s:<start>;e:<end>;
 *   b:<startingBid>;r:<reserve>?;n:<buyNow>?;x:<extendMinutes>;o:<owner>"`,
 *   so one search lists every auction with its terms (nothing fetched). A
 *   listing counts only while its `owner` still owns the name: once the
 *   name changes hands it is over. The seller ends one with no bids by
 *   publishing over it (a tombstone titled "deleted", as Q-Shop+ deletes).
 * - Bids are the bidders' documents: `q-store-namebid-<uid>-<bid uid6>`,
 *   JSON `{v: 1, name, auction: uid, amount, coin: "QORT", created}`,
 *   metadata `title: "Bid"`, `description: "bid:<amount>;to:<name>"`, read
 *   like product bids (who and when are Core's, an edited bid doesn't count,
 *   the winner is checked against the chain).
 * - At the end the seller lists the name on chain at the winning bid
 *   (SELL_NAME), and the winner buys it (BUY_NAME). Core can't hold a sale
 *   for one buyer: while it waits for the winner, anyone could buy it at that
 *   price in another app; the seller is paid the winning bid either way.
 *
 * New data, additive only: the original Names app and Q-Shop never read it.
 */
import { DELETED_TITLE, isDeletedRow } from "../qdn/deleted";
import { jsonToBase64 } from "../qdn/payloads";
import { searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import { bidDescription, bidsWithPrefix } from "../auctions/bids";
import { amountString, roundQort, type AuctionTerms, type Bid } from "../auctions/rules";

export const NAME_AUCTION_ID = "q-store-nameauction";
export const NAME_BID_BASE = "q-store-namebid";

export interface NameAuction {
  /** The name for auction (the listing's publisher). */
  name: string;
  uid: string;
  /** The seller's address when it was listed. */
  owner: string;
  terms: AuctionTerms;
  /** Core's time for the listing. */
  created: number;
}

const UID = /^[A-Za-z0-9]{6,16}$/;
const ADDRESS = /^Q[1-9A-HJ-NP-Za-km-z]{20,40}$/;

/** The listing's metadata description: its terms, so one search lists auctions. */
export function auctionDescription(uid: string, owner: string, terms: AuctionTerms): string {
  return [
    `nameauc:${uid}`,
    `s:${terms.start}`,
    `e:${terms.end}`,
    `b:${amountString(terms.startingBid)}`,
    ...(terms.reserve !== undefined ? [`r:${amountString(terms.reserve)}`] : []),
    ...(terms.buyNow !== undefined ? [`n:${amountString(terms.buyNow)}`] : []),
    `x:${terms.extendMinutes}`,
    `o:${owner}`,
  ].join(";");
}

/** A listing's terms from its search row, or null when it isn't one (a tombstone, another identifier, bad terms). */
export function auctionFromRow(row: QdnResourceSummary): NameAuction | null {
  if (!row?.name || row.identifier !== NAME_AUCTION_ID || isDeletedRow(row)) return null;
  const parts = new Map<string, string>();
  for (const part of String(row.metadata?.description ?? "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) parts.set(part.slice(0, at), part.slice(at + 1));
  }
  const uid = parts.get("nameauc") ?? "";
  const owner = parts.get("o") ?? "";
  const num = (key: string) => (parts.has(key) ? Number(parts.get(key)) : undefined);
  const start = num("s");
  const end = num("e");
  const startingBid = num("b");
  const extendMinutes = num("x") ?? 0;
  const reserve = num("r");
  const buyNow = num("n");
  if (!UID.test(uid) || !ADDRESS.test(owner)) return null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !((end as number) > (start as number))) return null;
  if (!(startingBid !== undefined && startingBid > 0) || !Number.isInteger(extendMinutes) || extendMinutes < 0 || extendMinutes > 60) return null;
  if (reserve !== undefined && !(reserve > 0)) return null;
  if (buyNow !== undefined && !(buyNow >= startingBid)) return null;
  const created = Number(row.created);
  return {
    name: row.name,
    uid,
    owner,
    created: Number.isFinite(created) ? created : 0,
    terms: {
      v: 1,
      start: start as number,
      end: end as number,
      startingBid: roundQort(startingBid),
      ...(reserve !== undefined && { reserve: roundQort(reserve) }),
      ...(buyNow !== undefined && { buyNow: roundQort(buyNow) }),
      extendMinutes,
    },
  };
}

/** Every name auction listed (at most 500 listings), each once. */
export async function fetchNameAuctions(options: { fresh?: boolean } = {}): Promise<NameAuction[]> {
  const { rows } = await searchQdnAll(
    { service: "DOCUMENT", identifier: NAME_AUCTION_ID, prefix: true, includemetadata: true, reverse: true },
    { pageSize: 100, maxPages: 5, fresh: options.fresh }
  );
  const seen = new Set<string>();
  const out: NameAuction[] = [];
  for (const row of rows) {
    const auction = auctionFromRow(row);
    if (auction && !seen.has(auction.name)) {
      seen.add(auction.name);
      out.push(auction);
    }
  }
  return out;
}

/** The listing's publish, under the name for auction. */
export function buildNameAuctionPublish(args: { name: string; owner: string; uid: string; terms: AuctionTerms; now: number }) {
  return {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name: args.name,
    service: "DOCUMENT",
    identifier: NAME_AUCTION_ID,
    filename: "auction.json",
    data64: jsonToBase64({ v: 1, name: args.name, owner: args.owner, uid: args.uid, terms: args.terms, created: args.now }),
    title: "Name auction",
    description: auctionDescription(args.uid, args.owner, args.terms),
  };
}

/** Ending an auction with no bids: a tombstone over the listing. */
export function buildNameAuctionEnd(name: string) {
  return {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name,
    service: "DOCUMENT",
    identifier: NAME_AUCTION_ID,
    filename: "auction.json",
    data64: jsonToBase64({ deleted: true }),
    title: DELETED_TITLE,
    description: DELETED_TITLE,
    tags: [DELETED_TITLE],
  };
}

export function nameBidPrefix(uid: string): string {
  return `${NAME_BID_BASE}-${uid}-`;
}

/** A bid's publish, under the bidder's name. */
export function buildNameBidPublish(args: { bidder: string; auction: NameAuction; amount: number; uid: string; now: number }) {
  const amount = roundQort(args.amount);
  const identifier = `${nameBidPrefix(args.auction.uid)}${args.uid}`;
  return {
    identifier,
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.bidder,
      service: "DOCUMENT",
      identifier,
      filename: "bid.json",
      data64: jsonToBase64({ v: 1, name: args.auction.name, auction: args.auction.uid, amount, coin: "QORT", created: args.now }),
      title: "Bid",
      description: bidDescription(amount, args.auction.name),
    },
  };
}

/** Every bid on the auction (at most 1,000 rows), for its name only. */
export async function fetchNameBids(auction: Pick<NameAuction, "uid" | "name">, options: { fresh?: boolean } = {}): Promise<{ bids: Bid[]; complete: boolean }> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: nameBidPrefix(auction.uid), prefix: true, includemetadata: true, reverse: false },
    { pageSize: 100, maxPages: 10, fresh: options.fresh }
  );
  return { bids: bidsWithPrefix(rows, nameBidPrefix(auction.uid), auction.name), complete };
}
