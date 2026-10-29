/**
 * Checking an ended auction's winner against the chain. A bid's time is the
 * one its publisher signed into the transaction, and Core accepts times up
 * to a day old, so someone signing their own transactions could date a bid
 * before it was placed (even before the end, after the auction closed). Its
 * block can't be backdated: a bid counts as the winner only if Core
 * confirmed it within CONFIRM_GRACE_MS of the time it claims. Otherwise it
 * is left out and the next bid is checked the same way.
 *
 * Calls, once per ended auction on screen: the bidder's name (its address),
 * its recent ARBITRARY transactions (pages of 50, back to the auction's
 * start), and the block's time. A bid whose transaction can't be found (not
 * confirmed yet, or a node that can't say) isn't left out: only a bid shown
 * to be late is.
 */
import type { AuctionTerms, Bid } from "./rules";
import { auctionState } from "./rules";

export const CONFIRM_GRACE_MS = 10 * 60_000;
const TX_PAGE = 50;
const MAX_TX_PAGES = 5;
const MAX_ROUNDS = 4;

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const addresses = new Map<string, Promise<string | null>>();
const blocks = new Map<number, Promise<number | null>>();

/** For tests. */
export function resetConfirmCaches(): void {
  addresses.clear();
  blocks.clear();
}

async function json(get: Fetch, url: string): Promise<unknown> {
  const response = await get(url);
  if (!response.ok) throw new Error(`the node answered for ${url}`);
  return response.json();
}

function addressOf(get: Fetch, name: string): Promise<string | null> {
  let hit = addresses.get(name);
  if (!hit) {
    hit = json(get, `/names/${encodeURIComponent(name)}`).then(
      (data) => {
        const owner = (data as { owner?: unknown } | null)?.owner;
        return typeof owner === "string" ? owner : null;
      },
      () => null
    );
    addresses.set(name, hit);
  }
  return hit;
}

function blockTime(get: Fetch, height: number): Promise<number | null> {
  let hit = blocks.get(height);
  if (!hit) {
    hit = json(get, `/blocks/byheight/${height}`).then(
      (data) => {
        const time = Number((data as { timestamp?: unknown } | null)?.timestamp);
        return Number.isFinite(time) && time > 0 ? time : null;
      },
      () => null
    );
    blocks.set(height, hit);
  }
  return hit;
}

/** When Core confirmed the bid (its block's time), or null when that can't be told. */
export async function bidConfirmedAt(bid: Bid, notBefore: number, get: Fetch = (url) => fetch(url)): Promise<number | null> {
  const address = await addressOf(get, bid.bidder);
  if (!address) return null;
  for (let page = 0; page < MAX_TX_PAGES; page++) {
    let rows: unknown;
    try {
      rows = await json(
        get,
        `/transactions/search?txType=ARBITRARY&address=${encodeURIComponent(address)}&confirmationStatus=CONFIRMED&limit=${TX_PAGE}&offset=${page * TX_PAGE}&reverse=true`
      );
    } catch {
      return null;
    }
    if (!Array.isArray(rows)) return null;
    // The bid's first publish (a later one would make it an edited bid, which never counts).
    const matches = rows.filter((tx) => tx?.name === bid.bidder && tx?.identifier === bid.id && Number.isFinite(Number(tx?.blockHeight)));
    if (matches.length > 0) {
      const first = matches.reduce((a, b) => (Number(b.timestamp) < Number(a.timestamp) ? b : a));
      return blockTime(get, Number(first.blockHeight));
    }
    const oldest = rows.length ? Number(rows[rows.length - 1]?.timestamp) : NaN;
    if (rows.length < TX_PAGE || (Number.isFinite(oldest) && oldest < notBefore)) return null;
  }
  return null;
}

/**
 * The bids to leave out of an ended auction because the chain confirmed
 * them later than they claim, found winner by winner (each check may hand
 * the win to the next bid).
 */
export async function lateWinningBids(
  terms: AuctionTerms,
  bids: readonly Bid[],
  seller: string,
  now: number,
  get?: Fetch
): Promise<string[]> {
  const late: string[] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const state = auctionState({ ...terms, voided: [...(terms.voided ?? []), ...late] }, bids, now, seller);
    if (!state.winner) break;
    const confirmed = await bidConfirmedAt(state.winner, terms.start - 86_400_000, get);
    if (confirmed === null || confirmed <= state.winner.created + CONFIRM_GRACE_MS) break;
    late.push(state.winner.id);
  }
  return late;
}
