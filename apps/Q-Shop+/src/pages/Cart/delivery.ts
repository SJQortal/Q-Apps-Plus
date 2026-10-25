/**
 * Delivery address helpers shared by checkout and the pending orders, kept
 * apart from the form itself so the form (and its country lists) loads only
 * when a physical order needs it.
 */
import { US, missingDeliveryFields, type DeliveryInput } from "../../money/order";
import { STORAGE_PREFIX } from "../../constants/plus";

/**
 * Delivery addresses buyers chose to keep for their next checkout, per
 * Qortal name: in this browser only, never published (after the checkout
 * profile of Simon's Qortal Web Builder shops). Every Q-App on a node shares
 * one browser origin, so other Q-Apps can read it: the tick says so.
 */
export const SAVED_DELIVERY_STORAGE_KEY = `${STORAGE_PREFIX}delivery-addresses`;

const FIELDS: (keyof DeliveryInput)[] = ["customerName", "streetAddress", "city", "state", "region", "country", "zipCode", "deliveryNote"];

function readSaved(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_DELIVERY_STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The address `buyerName` kept on this device, or null. */
export function savedDelivery(buyerName: string): DeliveryInput | null {
  const saved = readSaved()[buyerName] as Partial<Record<keyof DeliveryInput, unknown>> | undefined;
  if (!saved || typeof saved !== "object") return null;
  const out = emptyDelivery(buyerName);
  for (const field of FIELDS) if (typeof saved[field] === "string") out[field] = saved[field] as string;
  return out;
}

/** Keeps `value` as `buyerName`'s address on this device, or forgets it (null). */
export function saveDelivery(buyerName: string, value: DeliveryInput | null): void {
  try {
    const all = readSaved();
    if (value) all[buyerName] = Object.fromEntries(FIELDS.map((field) => [field, value[field]]));
    else delete all[buyerName];
    if (Object.keys(all).length === 0) localStorage.removeItem(SAVED_DELIVERY_STORAGE_KEY);
    else localStorage.setItem(SAVED_DELIVERY_STORAGE_KEY, JSON.stringify(all));
    // Product pages price delivery for it until the buyer picks a country there (delivery/buyerPlace.ts).
    window.dispatchEvent(new Event(SAVED_DELIVERY_EVENT));
  } catch {
    // Storage is full or blocked: the address is simply not kept.
  }
}

/** Sent on window when a kept address changes. */
export const SAVED_DELIVERY_EVENT = "qshopplus-saved-delivery";

/** An empty address for `buyerName` (the name defaults to the buyer's Qortal name). */
export function emptyDelivery(buyerName: string): DeliveryInput {
  return {
    customerName: buyerName,
    streetAddress: "",
    city: "",
    state: "",
    region: "",
    country: "",
    zipCode: "",
    deliveryNote: "",
  };
}

/** A field of the delivery step: the address's, or a pickup's contact. */
export type DeliveryField = keyof DeliveryInput | "contact";

/** What a pickup order needs (the buyer collects it): who, the place (it decides the price) and how the seller reaches them. */
export function missingPickupFields(input: DeliveryInput, contact: string): DeliveryField[] {
  const missing: DeliveryField[] = [];
  if (!input.country) missing.push("country");
  if (input.country === US && !input.state) missing.push("state");
  if (!input.customerName.trim()) missing.push("customerName");
  if (!contact.trim()) missing.push("contact");
  return missing;
}

/**
 * A pickup order's delivery block: the name and place, no address, and how
 * to reach the buyer in front of their note. A digital order sends an empty
 * address too, so the original app reads it.
 */
export function pickupDelivery(input: DeliveryInput, contact: string): DeliveryInput {
  const note = input.deliveryNote.trim();
  return { ...input, streetAddress: "", city: "", region: "", zipCode: "", deliveryNote: `Contact: ${contact.trim()}.${note ? ` ${note}` : ""}` };
}

/** The id of a field's input, so a failed Continue can move focus to the first one to fix. */
export function deliveryFieldId(prefix: string, field: DeliveryField): string {
  return `${prefix}-${field}`;
}

/** Focuses the first field missing from `value` (a pickup's when `pickupContact` is given); true when there was one. */
export function focusFirstMissing(prefix: string, value: DeliveryInput, pickupContact?: string): boolean {
  const first = pickupContact !== undefined ? missingPickupFields(value, pickupContact)[0] : missingDeliveryFields(value)[0];
  if (!first) return false;
  document.getElementById(deliveryFieldId(prefix, first))?.focus();
  return true;
}
