/**
 * Stock counts in the seller's drafts and the product list (stock/model.ts):
 * what the form's stock section makes of a product's count, and each counted
 * product's row carrying the same `stock`, so lists know without reading
 * catalogues. Added after the original's builder (qdn/payloads.ts
 * buildProductPublish, unchanged), as auctions/catalog.ts adds auction times.
 */
import { jsonToBase64, type CatalogueDoc, type DataContainerDoc, type ProductDraft, type PublishResource } from "../qdn/payloads";
import { MAX_STOCK, newStock, stockOf, type ProductStock } from "./model";

/** The stock section as the form holds it. */
export interface StockFormValues {
  /** Counted; off (the default) is never sold out by a count. */
  tracked: boolean;
  /** Units in stock now, as typed; "" keeps a counted product's count as it is. */
  quantity: string;
  /** The count as published (an edited product). */
  saved?: ProductStock | null;
  /** Orders the seller chose not to count (their uids), with the ones the count had. */
  voided?: string[];
}

export function stockFormOf(product: unknown): StockFormValues {
  const saved = stockOf(product);
  return saved ? { tracked: true, quantity: "", saved, voided: saved.voided ?? [] } : { tracked: false, quantity: "" };
}

/** What's wrong with the stock as typed (an item's label names it), or null. */
export function stockFormProblem(form: StockFormValues | undefined, label?: string): string | null {
  if (!form?.tracked) return null;
  const text = form.quantity.trim();
  const of = label ? ` of ${label}` : "";
  if (!text) return form.saved ? null : `Type the units in stock${of}.`;
  if (!/^\d+$/.test(text)) return `Type the units in stock${of} as a whole number.`;
  if (Number(text) > MAX_STOCK) return `Keep the units in stock${of} to ${MAX_STOCK.toLocaleString("en-US")} at most.`;
  return null;
}

/**
 * The count a save writes: undefined leaves the product's as it is (no stock
 * section), null takes it off (not counted any more), else a count. A typed
 * number starts counting afresh from `now` (earlier orders are in it); an
 * empty one keeps the saved count and its time, with the voided orders.
 */
export function stockForDraft(form: StockFormValues | undefined, now: number): ProductStock | null | undefined {
  if (!form) return undefined;
  if (!form.tracked) return null;
  const text = form.quantity.trim();
  if (text && /^\d+$/.test(text)) return newStock(Number(text), now);
  if (!form.saved) return undefined;
  const voided = [...new Set(form.voided ?? form.saved.voided ?? [])];
  const { voided: _old, ...rest } = form.saved;
  return voided.length > 0 ? { ...rest, voided } : rest;
}

/** A draft with the form's count (or without one), as stockForDraft says. */
export function withFormStock<T extends object>(draft: T, form: StockFormValues | undefined, now: number): T {
  const next = stockForDraft(form, now);
  if (next === undefined) return draft;
  const { stock: _old, ...rest } = draft as Record<string, unknown>;
  return (next ? { ...rest, stock: next } : rest) as T;
}

/** Each saved product's row with its product's count (or without one). */
export function withStockRows<T extends { dataContainer: DataContainerDoc; resources: PublishResource[]; catalogues: CatalogueDoc[] }>(
  built: T,
  drafts: Record<string, ProductDraft>
): T {
  let changed = false;
  const products = { ...built.dataContainer.products } as Record<string, Record<string, unknown>>;
  for (const draft of Object.values(drafts)) {
    const row = products[draft.id];
    if (!row) continue;
    const stock = stockOf(draft);
    if (stock) {
      products[draft.id] = { ...row, stock };
      changed = true;
    } else if ("stock" in row) {
      const rest = { ...row };
      delete rest.stock;
      products[draft.id] = rest;
      changed = true;
    }
  }
  if (!changed) return built;
  const dataContainer = { ...built.dataContainer, products } as DataContainerDoc;
  const resources = built.resources.map((r) => (r.identifier === dataContainer.id && r.service === "DOCUMENT" ? { ...r, data64: jsonToBase64(dataContainer) } : r));
  return { ...built, dataContainer, resources };
}
