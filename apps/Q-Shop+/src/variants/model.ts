/**
 * Product variants (Simon, 2026-10-24: "add variants to the products, (and
 * corresponding image to the variant), with customization options … choose
 * (toggle) if he wants the products to display separately … or to bundle the
 * variants into one product listing").
 *
 * The seller names variants (Round, Square…), each with values of its own
 * (Pale, Orange…, each with a colour if it has one); every variant's value is
 * an item, and a variant with no values is one (Simon, 2026-10-24: "instead
 * of variant and its values, it mixes different variant values").
 *
 * Each item is a product of its own: its id, price, stock and pictures. So
 * the cart, checkout and orders don't change, and the original Q-Shop lists
 * each as an item for sale, named for it ("Glasses — Round / Pale"). A group
 * ties them, additively:
 * - each item's product (catalogue) gains
 *   `variant: {group, title, options: [{name, values: [{name, color?}]}], values: [variant, value?], display, lead}`;
 *   the lead (the first variant) carries the product's pictures, the others
 *   only their own, so a group of 24 doesn't copy 10 pictures 24 times; a
 *   variant's page shows its picture, then the lead's;
 * - its row in the shop's product list (the index) gains `variant: {group, values}`;
 * - the index gains `variantGroups: {<group>: {title, options, display}}`,
 *   so lists can bundle a group or show each variant without reading a catalogue.
 * The seller's options are their own: any names (Size, Colour, Scent…), any values.
 */
import { jsonToBase64, type CatalogueDoc, type DataContainerDoc, type ProductDraft, type PublishResource } from "../qdn/payloads";

/** Variants (Round, Square…), values each, and items in all. */
export const MAX_VARIANT_OPTIONS = 8;
export const MAX_OPTION_VALUES = 12;
export const MAX_VARIANTS = 30;
export const MAX_OPTION_TEXT = 40;

/** bundle: one listing, buyers choose the variant; separate: each variant listed on its own, its own picture on the card. */
export type VariantDisplay = "bundle" | "separate";

export interface VariantValue {
  name: string;
  /** A colour to show it by (a lens, a glaze): "#rrggbb". */
  color?: string;
}

/** A variant (Round) and its own values (Pale, Orange…). */
export interface VariantOption {
  name: string;
  values: VariantValue[];
}

export interface ProductVariant {
  group: string;
  /** The listing's title, without the options. */
  title: string;
  options: VariantOption[];
  /** Which item it is: its variant, and its value when the variant has values. */
  values: string[];
  display: VariantDisplay;
  /** The variant that carries the product's pictures (the first). */
  lead: string;
}

export interface VariantGroup {
  title: string;
  options: VariantOption[];
  display: VariantDisplay;
  lead: string;
}

export interface VariantRow {
  group: string;
  values: string[];
}

const text = (value: unknown, max = MAX_OPTION_TEXT) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const isId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value);

const COLOR = /^#[0-9a-fA-F]{6}$/;

function valueOf(raw: unknown): VariantValue | null {
  const name = text((raw as { name?: unknown })?.name);
  if (!name) return null;
  const color = (raw as { color?: unknown }).color;
  return typeof color === "string" && COLOR.test(color) ? { name, color: color.toLowerCase() } : { name };
}

function optionsOf(raw: unknown): VariantOption[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_VARIANT_OPTIONS) return null;
  const options: VariantOption[] = [];
  for (const o of raw) {
    const name = text((o as { name?: unknown })?.name);
    const list = (o as { values?: unknown })?.values;
    const values = Array.isArray(list) ? list.map(valueOf) : [];
    if (!name || values.some((v) => !v) || values.length > MAX_OPTION_VALUES) return null;
    const clean = values as VariantValue[];
    if (new Set(clean.map((v) => v.name)).size !== clean.length) return null;
    options.push({ name, values: clean });
  }
  return new Set(options.map((o) => o.name)).size === options.length ? options : null;
}

/** Whether `values` names an item of the options: a variant with no values, or a variant and one of its values. */
function isItem(options: VariantOption[], values: string[]): boolean {
  const option = options.find((o) => o.name === values[0]);
  if (!option) return false;
  return option.values.length === 0 ? values.length === 1 : values.length === 2 && option.values.some((v) => v.name === values[1]);
}

const displayOf = (value: unknown): VariantDisplay => (value === "separate" ? "separate" : "bundle");

/** A product's variant, when it is one (well formed: its values are among its options'). */
export function variantOf(product: unknown): ProductVariant | null {
  const v = (product as { variant?: Record<string, unknown> } | null)?.variant;
  if (!v || typeof v !== "object" || !isId(v.group)) return null;
  const options = optionsOf(v.options);
  const values = Array.isArray(v.values) ? v.values.map((x) => text(x)) : [];
  if (!options || !isItem(options, values)) return null;
  const lead = typeof v.lead === "string" && v.lead.length <= 80 ? v.lead : "";
  return { group: v.group, title: text(v.title, 180) || "Product", options, values, display: displayOf(v.display), lead };
}

/** A list row's variant (the index), when it has one. */
export function variantRowOf(row: unknown): VariantRow | null {
  const v = (row as { variant?: { group?: unknown; values?: unknown } } | null)?.variant;
  if (!v || !isId(v.group) || !Array.isArray(v.values) || v.values.some((x) => typeof x !== "string")) return null;
  return { group: v.group, values: v.values as string[] };
}

/** The index's groups, well-formed ones only. */
export function variantGroupsOf(index: unknown): Record<string, VariantGroup> {
  const raw = (index as { variantGroups?: unknown } | null)?.variantGroups;
  const out: Record<string, VariantGroup> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, g] of Object.entries(raw as Record<string, unknown>)) {
    const options = isId(id) ? optionsOf((g as { options?: unknown })?.options) : null;
    if (!options) continue;
    const lead = (g as { lead?: unknown }).lead;
    out[id] = {
      title: text((g as { title?: unknown }).title, 180) || "Product",
      options,
      display: displayOf((g as { display?: unknown }).display),
      lead: typeof lead === "string" && lead.length <= 80 ? lead : "",
    };
  }
  return out;
}

/** Every item, in order: each variant's values, or the variant alone when it has none. At most MAX_VARIANTS. */
export function variantItems(options: VariantOption[]): string[][] {
  const out: string[][] = [];
  for (const option of options) {
    if (option.values.length === 0) out.push([option.name]);
    else for (const value of option.values) out.push([option.name, value.name]);
  }
  return out.slice(0, MAX_VARIANTS);
}

/** How many items the options make (before the cap). */
export function itemCount(options: VariantOption[]): number {
  return options.reduce((n, o) => n + Math.max(1, o.values.length), 0);
}

/** "Glasses — Round / Pale": the item's product title, as the original lists it. */
export function variantTitle(title: string, values: string[]): string {
  return `${title.trim()} — ${values.join(" / ")}`;
}

/** "Round / Pale" */
export function variantLabel(values: string[]): string {
  return values.join(" / ");
}

/** An item's value's colour, when it has one. */
export function colorOf(options: VariantOption[], values: string[]): string | undefined {
  return options.find((o) => o.name === values[0])?.values.find((v) => v.name === values[1])?.color;
}

export const valuesKey = (values: string[]) => values.join("\u0000");

/**
 * After the original's builder (qdn/payloads.ts buildProductPublish,
 * unchanged): each variant draft's row says its group and values, and takes
 * its product's own status (the builder writes new rows as AVAILABLE); the
 * groups' title, options and display are kept on the index.
 */
export function withVariantRows<T extends { dataContainer: DataContainerDoc; resources: PublishResource[]; catalogues: CatalogueDoc[] }>(
  built: T,
  drafts: Record<string, ProductDraft>
): T {
  let changed = false;
  const products = { ...built.dataContainer.products } as Record<string, Record<string, unknown>>;
  const groups: Record<string, VariantGroup> = { ...variantGroupsOf(built.dataContainer) };
  for (const draft of Object.values(drafts)) {
    const row = products[draft.id];
    if (!row) continue;
    const variant = variantOf(draft);
    if (variant) {
      products[draft.id] = { ...row, status: typeof draft.status === "string" ? draft.status : row.status, variant: { group: variant.group, values: variant.values } };
      groups[variant.group] = { title: variant.title, options: variant.options, display: variant.display, lead: variant.lead };
      changed = true;
    } else if ("variant" in row) {
      const rest = { ...row };
      delete rest.variant;
      products[draft.id] = rest;
      changed = true;
    }
  }
  if (!changed) return built;
  // A group no row names any more goes.
  const used = new Set(Object.values(products).map((row) => variantRowOf(row)?.group).filter(Boolean));
  const variantGroups = Object.fromEntries(Object.entries(groups).filter(([id]) => used.has(id)));
  const dataContainer = { ...built.dataContainer, products, variantGroups } as unknown as DataContainerDoc;
  const resources = built.resources.map((r) => (r.identifier === dataContainer.id && r.service === "DOCUMENT" ? { ...r, data64: jsonToBase64(dataContainer) } : r));
  return { ...built, dataContainer, resources };
}

export interface Bundle {
  group: string;
  title: string;
  /** How many variants the group lists. */
  count: number;
  minQort: number;
  maxQort: number;
  /** Every item counted and none left (stock/model.ts). */
  soldOut?: boolean;
}

/**
 * A list's rows with each bundled group as one row: the first of its
 * variants in the list's order (so the sort places it), with the group's
 * title, how many there are and their price range. Groups shown separately,
 * and rows of no group, stay as they are.
 */
export function bundleRows<T extends { productId: string; priceQort?: number }>(rows: T[], groups: Record<string, VariantGroup>, rowOf: (row: T) => VariantRow | null = variantRowOf): (T & { bundle?: Bundle })[] {
  const members = new Map<string, T[]>();
  for (const row of rows) {
    const v = rowOf(row);
    if (!v || groups[v.group]?.display !== "bundle") continue;
    members.set(v.group, [...(members.get(v.group) ?? []), row]);
  }
  const out: (T & { bundle?: Bundle })[] = [];
  const placed = new Set<string>();
  for (const row of rows) {
    const v = rowOf(row);
    const group = v && groups[v.group]?.display === "bundle" ? v.group : null;
    if (!group) {
      out.push(row);
      continue;
    }
    if (placed.has(group)) continue;
    placed.add(group);
    const all = members.get(group) ?? [row];
    const prices = all.map((r) => r.priceQort).filter((p): p is number => typeof p === "number" && p > 0);
    const soldOut = all.every((r) => (r as { soldOut?: boolean }).soldOut === true);
    out.push({
      ...row,
      bundle: {
        group,
        title: groups[group].title,
        count: all.length,
        minQort: prices.length ? Math.min(...prices) : 0,
        maxQort: prices.length ? Math.max(...prices) : 0,
        ...(soldOut && { soldOut }),
      },
    });
  }
  return out;
}

export interface VariantSibling {
  productId: string;
  catalogueId: string;
  values: string[];
  status: string;
  priceQort?: number;
}

/** The group's variants, as the shop's product list holds them. */
export function variantSiblings(index: unknown, group: string): VariantSibling[] {
  const products = (index as { products?: unknown } | null)?.products;
  if (!products || typeof products !== "object") return [];
  const out: VariantSibling[] = [];
  for (const [productId, entry] of Object.entries(products as Record<string, Record<string, unknown>>)) {
    const v = variantRowOf(entry);
    if (!v || v.group !== group || typeof entry.catalogueId !== "string") continue;
    out.push({
      productId,
      catalogueId: entry.catalogueId,
      values: v.values,
      status: typeof entry.status === "string" ? entry.status : "",
      ...(typeof entry.priceQort === "number" && { priceQort: entry.priceQort }),
    });
  }
  return out;
}

/** The item a variant's choice leads to: the same value in that variant when it has it, else its first item. */
export function itemForVariant(siblings: VariantSibling[], current: string[], variant: string): VariantSibling | null {
  return siblings.find((s) => s.values[0] === variant && s.values[1] === current[1]) ?? siblings.find((s) => s.values[0] === variant) ?? null;
}

/** The item a value's choice leads to, within the current variant. */
export function itemForValue(siblings: VariantSibling[], current: string[], value: string): VariantSibling | null {
  return siblings.find((s) => valuesKey(s.values) === valuesKey([current[0], value])) ?? null;
}
