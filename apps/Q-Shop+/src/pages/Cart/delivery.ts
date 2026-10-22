/**
 * Delivery address helpers shared by checkout and the pending orders, kept
 * apart from the form itself so the form (and its country lists) loads only
 * when a physical order needs it.
 */
import { missingDeliveryFields, type DeliveryInput } from "../../money/order";

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
