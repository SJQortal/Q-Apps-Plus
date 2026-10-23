/**
 * Auctions in the shop's product list (the index): each auction product's
 * row also says when it runs, `auction: {start, end}` (additive), so lists
 * can mark, filter and sort auctions without reading catalogues. Added after
 * the original's builder (qdn/payloads.ts buildProductPublish, unchanged),
 * which writes rows of new products as AVAILABLE: an auction's row takes its
 * product's own status (OUT_OF_STOCK, for the original).
 */
import { jsonToBase64, type CatalogueDoc, type DataContainerDoc, type ProductDraft, type PublishResource } from "../qdn/payloads";
import { auctionTermsOf, scheduledPhase, type AuctionPhase } from "./rules";

export interface AuctionRow {
  start: number;
  end: number;
}

/** A list row's auction times, when it is an auction. */
export function auctionRowOf(row: unknown): AuctionRow | null {
  const a = (row as { auction?: { start?: unknown; end?: unknown } } | null)?.auction;
  if (!a || typeof a.start !== "number" || typeof a.end !== "number" || !(a.end > a.start)) return null;
  return { start: a.start, end: a.end };
}

/** Where a listed auction stands by its times (a buy-now can end it sooner; its page knows). */
export function rowAuctionPhase(row: unknown, now: number): AuctionPhase | null {
  const times = auctionRowOf(row);
  return times ? scheduledPhase(times, now) : null;
}

export function withAuctionRows<T extends { dataContainer: DataContainerDoc; resources: PublishResource[]; catalogues: CatalogueDoc[] }>(
  built: T,
  drafts: Record<string, ProductDraft>
): T {
  let changed = false;
  const products = { ...built.dataContainer.products } as Record<string, Record<string, unknown>>;
  for (const draft of Object.values(drafts)) {
    const row = products[draft.id];
    if (!row) continue;
    const terms = auctionTermsOf(draft);
    if (terms) {
      products[draft.id] = { ...row, status: typeof draft.status === "string" ? draft.status : row.status, auction: { start: terms.start, end: terms.end } };
      changed = true;
    } else if ("auction" in row) {
      const rest = { ...row };
      delete rest.auction;
      products[draft.id] = rest;
      changed = true;
    }
  }
  if (!changed) return built;
  const dataContainer = { ...built.dataContainer, products } as DataContainerDoc;
  const resources = built.resources.map((r) => (r.identifier === dataContainer.id && r.service === "DOCUMENT" ? { ...r, data64: jsonToBase64(dataContainer) } : r));
  return { ...built, dataContainer, resources };
}
