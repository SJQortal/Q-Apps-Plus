/**
 * A shop's policies (Simon, 2026-10-25: "the ultimate global marketplace for
 * anyone and everyone"): how soon it dispatches an order, whether it takes
 * returns and within how long, and any other terms. Buyers far from the
 * seller, with no one in between, decide on these: they show on the shop
 * page, product pages and at checkout, before anyone pays.
 *
 * Stored in the shop's JSON as `policies` (additive: the original ignores
 * it, and an edit in the original drops it). Read safely: any name can
 * publish a STORE.
 */
export interface ShopPolicies {
  /** Working days from payment to dispatch. */
  dispatchDays?: number;
  /** Days after delivery to ask for a return; 0: no returns. */
  returnDays?: number;
  /** Returns and refunds in the seller's words. */
  returns?: string;
  /** Other terms. */
  terms?: string;
}

export const DISPATCH_DAY_CHOICES = [1, 2, 3, 5, 7, 10, 14, 21, 30] as const;
export const RETURN_DAY_CHOICES = [0, 7, 14, 30, 60, 90] as const;
export const MAX_RETURNS_TEXT = 500;
export const MAX_TERMS_TEXT = 1000;

const wholeDays = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;

const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);

/** The shop's policies, the well-formed parts only; null when it states none. */
export function policiesOf(shop: { policies?: unknown } | null | undefined): ShopPolicies | null {
  const raw = shop?.policies;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const out: ShopPolicies = {};
  const dispatchDays = wholeDays(p.dispatchDays, 1, 60);
  const returnDays = wholeDays(p.returnDays, 0, 365);
  const returns = text(p.returns, MAX_RETURNS_TEXT);
  const terms = text(p.terms, MAX_TERMS_TEXT);
  if (dispatchDays !== undefined) out.dispatchDays = dispatchDays;
  if (returnDays !== undefined) out.returnDays = returnDays;
  if (returns) out.returns = returns;
  if (terms) out.terms = terms;
  return Object.keys(out).length > 0 ? out : null;
}

/** "Dispatched within 2 working days" (null when not said). */
export function dispatchText(policies: ShopPolicies | null): string | null {
  const days = policies?.dispatchDays;
  if (!days) return null;
  return days === 1 ? "Dispatched within 1 working day" : `Dispatched within ${days} working days`;
}

/** "Returns within 14 days of delivery", "No returns" (null when not said). */
export function returnsText(policies: ShopPolicies | null): string | null {
  const days = policies?.returnDays;
  if (days === undefined) return null;
  if (days === 0) return "No returns";
  return days === 1 ? "Returns within 1 day of delivery" : `Returns within ${days} days of delivery`;
}

/** The policies a form gives, or undefined when it states none (the field then goes from the shop). */
export function policiesForPublish(values: { dispatchDays: number | null; returnDays: number | null; returns: string; terms: string }): ShopPolicies | undefined {
  return (
    policiesOf({
      policies: {
        ...(values.dispatchDays !== null && { dispatchDays: values.dispatchDays }),
        ...(values.returnDays !== null && { returnDays: values.returnDays }),
        returns: values.returns,
        terms: values.terms,
      },
    }) ?? undefined
  );
}
