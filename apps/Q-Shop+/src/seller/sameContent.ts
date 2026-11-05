/**
 * Whether a working copy is back to what's published (Simon, 2026-10-25:
 * changes undone to the same state shouldn't leave Publish changes up):
 * the same content, whatever the order of an object's keys or an empty field
 * left out on one side. Shipping profiles' products count as a set, and a
 * zone's name (no longer shown or edited) doesn't count.
 */
import type { DeliveryDoc } from "../delivery/model";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

export function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function sameDelivery(a: DeliveryDoc | null, b: DeliveryDoc | null): boolean {
  if (!a || !b) return a === b;
  const plain = (doc: DeliveryDoc) => ({
    ...doc,
    updated: 0,
    general: { zones: doc.general.zones.map(({ name: _name, ...z }) => z) },
    profiles: doc.profiles.map((p) => ({ ...p, products: [...p.products].sort(), zones: p.zones.map(({ name: _name, ...z }) => z) })),
  });
  return sameContent(plain(a), plain(b));
}
