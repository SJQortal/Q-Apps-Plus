/**
 * The seller's drafts that aren't products (seller/deviceDrafts.ts keeps
 * them on this device): delivery prices and discount codes, and how each is
 * published, so the seller page's Publish changes bar (seller/PublishBar.tsx)
 * can publish them from any tab. Collections keep theirs in
 * seller/useCollections.ts, products in Ready to publish.
 */
import { buildDeliveryPublish, rememberDeliveryDoc } from "../delivery/deliveryDoc";
import type { DeliveryDoc } from "../delivery/model";
import { publishMedia, type PublishOutcome } from "../richtext/publishMedia";
import type { DiscountsDoc } from "../discounts/model";
import { docFromDrafts, hiddenNames, type DiscountDraft } from "../discounts/drafts";
import { buildDiscountsPublish, encryptDiscountSecret, keepDiscountSecret, rememberDiscountsDoc } from "../discounts/discountsDoc";
import { createDeviceDraftStore } from "./deviceDrafts";

export const deliveryDrafts = createDeviceDraftStore<DeliveryDoc>("delivery");

/** Why the delivery prices can't go out as they are, or null. */
export function deliveryDraftProblem(doc: DeliveryDoc): string | null {
  if (doc.options?.some((o) => !o.name.trim())) return "Name each delivery option, or remove it.";
  if (doc.options?.some((o) => o.place && (!o.place.country || !o.place.address.trim() || o.place.days.length === 0))) {
    return "Give each pickup point its country, address and the days it's open.";
  }
  return null;
}

/** Publishes delivery prices (Hub asks to confirm); done: this session reads what was sent. The caller clears the draft with what it shows, so nothing flickers. */
export async function publishDeliveryDraft(args: { name: string; key: string; doc: DeliveryDoc; now: number }): Promise<PublishOutcome & { doc?: DeliveryDoc }> {
  const problem = deliveryDraftProblem(args.doc);
  if (problem) return { kind: "failed", message: problem };
  const next: DeliveryDoc = { ...args.doc, updated: args.now };
  const built = buildDeliveryPublish({ name: args.name, doc: next });
  const outcome = await publishMedia(built.request, { service: "DOCUMENT", name: args.name, identifier: built.identifier });
  if (outcome.kind === "done") {
    rememberDeliveryDoc(args.name, next);
    return { kind: "done", doc: next };
  }
  return outcome;
}

/** The discount codes being changed, and the document they were changed from (its encrypted list may need keeping). */
export interface DiscountsDraft {
  drafts: DiscountDraft[];
  base: DiscountsDoc | null;
}

export const discountDrafts = createDeviceDraftStore<DiscountsDraft>("discounts");

/** Publishes discount codes (Hub asks to confirm), fingerprinted, with the seller's list encrypted to them. */
export async function publishDiscountDrafts(args: {
  owner: string;
  key: string;
  storeId: string;
  currency: string;
  publicKey: string;
  draft: DiscountsDraft;
  now: number;
}): Promise<PublishOutcome & { doc?: DiscountsDoc }> {
  const { drafts, base } = args.draft;
  const { doc, secret } = await docFromDrafts({ storeId: args.storeId, currency: args.currency, drafts, now: args.now });
  // Codes or names this device can't read (set elsewhere): the published list keeps them for the devices that can.
  const hidden = drafts.some((d) => (d.code && !d.codeText) || hiddenNames(d));
  const encrypted =
    hidden && base?.secret
      ? base.secret
      : Object.keys(secret.codes).length || Object.keys(secret.names).length
        ? await encryptDiscountSecret(secret, args.publicKey)
        : null;
  const next: DiscountsDoc = { ...doc, ...(encrypted && { secret: encrypted }) };
  const request = buildDiscountsPublish({ name: args.owner, doc: next });
  const outcome = await publishMedia(request, { service: "DOCUMENT", name: args.owner, identifier: request.identifier });
  if (outcome.kind === "done") {
    rememberDiscountsDoc(args.owner, next);
    keepDiscountSecret(args.storeId, secret);
    return { kind: "done", doc: next };
  }
  return outcome;
}
