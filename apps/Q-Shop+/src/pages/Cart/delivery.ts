/**
 * Delivery address helpers shared by checkout and the pending orders, kept
 * apart from the form itself so the form (and its country lists) loads only
 * when a physical order needs it.
 */
import { missingDeliveryFields, type DeliveryInput } from "../../money/order";
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
  } catch {
    // Storage is full or blocked: the address is simply not kept.
  }
}

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

/** The id of a field's input, so a failed Continue can move focus to the first one to fix. */
export function deliveryFieldId(prefix: string, field: keyof DeliveryInput): string {
  return `${prefix}-${field}`;
}

/** Focuses the first field missing from `value`; true when there was one. */
export function focusFirstMissing(prefix: string, value: DeliveryInput): boolean {
  const first = missingDeliveryFields(value)[0];
  if (!first) return false;
  document.getElementById(deliveryFieldId(prefix, first))?.focus();
  return true;
}
