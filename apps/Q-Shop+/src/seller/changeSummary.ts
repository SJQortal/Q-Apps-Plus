/**
 * What changed, in words, for the seller page's View changes (Simon,
 * 2026-10-25: "view changes should summarize all changes"): delivery prices,
 * collections and discount codes, each the working copy against what's
 * published, one line per change ("Iceland: added Ghee 200 ml", "Iceland ›
 * Iceland: first item $12.00 → $10.00", "Added code SPRING10: 10% off").
 */
import { shippingSummaryWithStates } from "../constants/shipping";
import { DAY_NAME, WEEK_ORDER, deliveryMoney, type DeliveryDoc, type DeliveryOption, type DeliveryProfile, type DeliveryRate, type DeliveryZone } from "../delivery/model";
import type { ShopCollection } from "../qdn/collections";
import type { Discount } from "../discounts/model";
import { draftLabel, draftSummary, type DiscountDraft } from "../discounts/drafts";

/** A product's name, for the lines that list products. */
export type NameOf = (productId: string) => string;

/** "Mug, Lamp and 3 more" */
function listOf(names: string[], most = 3): string {
  if (names.length <= most) return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${names.slice(0, most).join(", ")} and ${names.length - most} more`;
}

function added<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  return after.filter((a) => !before.some((b) => b.id === a.id));
}

function removed<T extends { id: string }>(before: readonly T[], after: readonly T[]): T[] {
  return before.filter((b) => !after.some((a) => a.id === b.id));
}

function kept<T extends { id: string }>(before: readonly T[], after: readonly T[]): [T, T][] {
  return after.flatMap((a) => {
    const b = before.find((x) => x.id === a.id);
    return b ? [[b, a] as [T, T]] : [];
  });
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------------------------ delivery

function zoneTitle(zone: DeliveryZone): string {
  if (zone.name) return zone.name;
  const where = shippingSummaryWithStates(zone.countries, zone.states ?? null);
  return where.charAt(0).toUpperCase() + where.slice(1);
}

function priceText(rate: DeliveryRate, currency: string): string {
  const parts = [rate.first > 0 ? deliveryMoney(rate.first, currency) : "Free"];
  if (rate.extra) parts.push(`${deliveryMoney(rate.extra, currency)} each extra item`);
  if (rate.freeOver) parts.push(`free from ${deliveryMoney(rate.freeOver, currency)}`);
  return parts.join(" · ");
}

function rateChanges(before: DeliveryRate, after: DeliveryRate, currency: string): string[] {
  const out: string[] = [];
  const money = (v: number | undefined) => (v ? deliveryMoney(v, currency) : "none");
  if (before.first !== after.first) out.push(`first item ${before.first ? deliveryMoney(before.first, currency) : "free"} → ${after.first ? deliveryMoney(after.first, currency) : "free"}`);
  if ((before.extra ?? 0) !== (after.extra ?? 0)) out.push(`each extra item ${money(before.extra)} → ${money(after.extra)}`);
  if ((before.freeOver ?? 0) !== (after.freeOver ?? 0)) out.push(`free from ${money(before.freeOver)} → ${money(after.freeOver)}`);
  return out;
}

function zoneChanges(where: string, before: readonly DeliveryZone[], after: readonly DeliveryZone[], currency: string, options: readonly DeliveryOption[]): string[] {
  const out: string[] = [];
  for (const z of added(before, after)) out.push(`${where}: added zone ${zoneTitle(z)} (${priceText(z, currency)})`);
  for (const z of removed(before, after)) out.push(`${where}: removed zone ${zoneTitle(z)}`);
  for (const [b, a] of kept(before, after)) {
    const at = `${where} › ${zoneTitle(a)}`;
    if (zoneTitle(b) !== zoneTitle(a) && b.name !== a.name) out.push(`${where}: zone ${zoneTitle(b)} renamed ${zoneTitle(a)}`);
    if (!same(b.countries, a.countries) || !same(b.states ?? [], a.states ?? [])) out.push(`${at}: now ${shippingSummaryWithStates(a.countries, a.states ?? null)}`);
    const prices = rateChanges(b, a, currency);
    if (prices.length) out.push(`${at}: ${prices.join(", ")}`);
    const ids = new Set([...Object.keys(b.rates ?? {}), ...Object.keys(a.rates ?? {})]);
    for (const id of ids) {
      const name = options.find((o) => o.id === id)?.name ?? "an option";
      const rb = b.rates?.[id];
      const ra = a.rates?.[id];
      if (!rb && ra) out.push(`${at}: offers ${name} (${priceText(ra, currency)})`);
      else if (rb && !ra) out.push(`${at}: no longer offers ${name}`);
      else if (rb && ra) {
        const changes = rateChanges(rb, ra, currency);
        if (changes.length) out.push(`${at}: ${name} ${changes.join(", ")}`);
      }
    }
  }
  return out;
}

function placeText(o: DeliveryOption): string {
  return o.place ? o.place.address : "";
}

function hoursText(o: DeliveryOption): string {
  if (!o.place) return "";
  const days = WEEK_ORDER.filter((d) => o.place?.days.includes(d)).map((d) => DAY_NAME[d]).join(", ");
  return `${days}${o.place.from && o.place.to ? ` ${o.place.from}–${o.place.to}` : ""}`;
}

export function deliveryChanges(before: DeliveryDoc | null, after: DeliveryDoc, nameOf: NameOf): string[] {
  const out: string[] = [];
  if (!before) out.push("Delivery prices for the first time");
  const was: DeliveryDoc = before ?? { ...after, base: undefined, options: [], general: { zones: [] }, profiles: [] };
  if (before && before.currency !== after.currency) out.push(`Prices in ${after.currency} (were in ${before.currency})`);
  const baseName = (d: DeliveryDoc) => d.base?.name ?? "Standard";
  if (before && baseName(was) !== baseName(after)) out.push(`First option renamed: ${baseName(was)} → ${baseName(after)}`);
  if (before && (was.base?.note ?? "") !== (after.base?.note ?? "")) out.push(`${baseName(after)}: note ${after.base?.note ? `"${after.base.note}"` : "removed"}`);

  const isPickup = (o: DeliveryOption) => !!o.pickup || !!o.place;
  const kinds: [string, (o: DeliveryOption) => boolean][] = [
    ["option", (o) => !isPickup(o)],
    ["pickup point", isPickup],
  ];
  for (const [kind, pick] of kinds) {
    const b = (was.options ?? []).filter(pick);
    const a = (after.options ?? []).filter(pick);
    for (const o of added(b, a)) {
      const where = [placeText(o).trim(), hoursText(o)].filter(Boolean).join(", ");
      out.push(`Added ${kind} ${o.name}${where ? ` (${where})` : ""}`);
    }
    for (const o of removed(b, a)) out.push(`Removed ${kind} ${o.name}`);
    for (const [ob, oa] of kept(b, a)) {
      if (ob.name !== oa.name) out.push(`${kind[0].toUpperCase()}${kind.slice(1)} ${ob.name} renamed ${oa.name}`);
      if ((ob.note ?? "") !== (oa.note ?? "")) out.push(`${oa.name}: note ${oa.note ? `"${oa.note}"` : "removed"}`);
      if (placeText(ob) !== placeText(oa) || ob.place?.country !== oa.place?.country) out.push(`${oa.name}: address ${placeText(oa) || "removed"}`);
      if (hoursText(ob) !== hoursText(oa)) out.push(`${oa.name}: open ${hoursText(oa) || "–"} (was ${hoursText(ob) || "–"})`);
    }
  }

  const options = after.options ?? [];
  out.push(...zoneChanges("General", was.general.zones, after.general.zones, after.currency, options));
  for (const p of added(was.profiles, after.profiles)) {
    out.push(`Added shipping profile ${p.name}${p.products.length ? ` with ${listOf(p.products.map(nameOf))}` : ""}`);
    out.push(...zoneChanges(p.name, [], p.zones, after.currency, options));
  }
  for (const p of removed(was.profiles, after.profiles)) out.push(`Removed shipping profile ${p.name}`);
  for (const [pb, pa] of kept<DeliveryProfile>(was.profiles, after.profiles)) {
    if (pb.name !== pa.name) out.push(`Shipping profile ${pb.name} renamed ${pa.name}`);
    const plus = pa.products.filter((id) => !pb.products.includes(id));
    const minus = pb.products.filter((id) => !pa.products.includes(id));
    if (plus.length) out.push(`${pa.name}: added ${listOf(plus.map(nameOf))}`);
    if (minus.length) out.push(`${pa.name}: took out ${listOf(minus.map(nameOf))}`);
    out.push(...zoneChanges(pa.name, pb.zones, pa.zones, after.currency, options));
  }
  return out;
}

// --------------------------------------------------------------- collections

export function collectionChanges(before: readonly ShopCollection[], after: readonly ShopCollection[], nameOf: NameOf): string[] {
  const out: string[] = [];
  for (const c of added(before, after)) out.push(`Added collection ${c.title || "Untitled"}${c.products.length ? ` with ${listOf(c.products.map(nameOf))}` : ""}`);
  for (const c of removed(before, after)) out.push(`Removed collection ${c.title || "Untitled"}`);
  for (const [b, a] of kept(before, after)) {
    const t = a.title || "Untitled";
    if (b.title !== a.title) out.push(`Collection ${b.title || "Untitled"} renamed ${t}`);
    if (b.description !== a.description) out.push(`${t}: new description`);
    if ((b.image ?? "") !== (a.image ?? "")) out.push(`${t}: ${a.image ? "new picture" : "picture removed"}`);
    const plus = a.products.filter((id) => !b.products.includes(id));
    const minus = b.products.filter((id) => !a.products.includes(id));
    if (plus.length) out.push(`${t}: added ${listOf(plus.map(nameOf))}`);
    if (minus.length) out.push(`${t}: took out ${listOf(minus.map(nameOf))}`);
    const order = (list: readonly string[], keep: readonly string[]) => list.filter((id) => keep.includes(id));
    if (!plus.length && !minus.length && !same(order(b.products, a.products), order(a.products, b.products))) out.push(`${t}: products in a new order`);
  }
  const ids = (list: readonly ShopCollection[], keep: readonly ShopCollection[]) => list.filter((c) => keep.some((k) => k.id === c.id)).map((c) => c.id);
  if (!same(ids(before, after), ids(after, before))) out.push("Collections in a new order");
  return out;
}

// ------------------------------------------------------------ discount codes

export function discountChanges(before: readonly Discount[], after: readonly DiscountDraft[], currency: string): string[] {
  const out: string[] = [];
  const nameOf = (d: DiscountDraft) => draftLabel(d);
  for (const d of added(before, after)) out.push(`Added ${nameOf(d)}: ${draftSummary(d, currency)}`);
  // A deleted code's text is only in the list it was published with: the draft's label says what it can.
  for (const d of removed(before, after)) out.push(`Deleted ${draftLabel(d as DiscountDraft)}`);
  for (const [b, a] of kept<Discount>(before, after)) {
    const draft = a as DiscountDraft;
    if (!b.paused !== !draft.paused) out.push(`${nameOf(draft)}: ${draft.paused ? "paused" : "running again"}`);
    // Everything else about it, as one line: what it gives and who for, now (texts known on one side only don't count).
    const plain = (d: Discount) => {
      const { codeText: _c, nameText: _n, nameTexts: _ns, paused: _p, ...rest } = d as DiscountDraft;
      return rest;
    };
    const before = b as DiscountDraft;
    const retyped = !!draft.codeText && !!before.codeText && draft.codeText !== before.codeText;
    if (retyped || (draft.codeText && !draft.code) || !same({ ...plain(b), code: undefined }, { ...plain(draft), code: undefined })) {
      out.push(`${nameOf(draft)}: now ${draftSummary(draft, currency)}`);
    }
  }
  return out;
}
