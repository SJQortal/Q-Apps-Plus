/**
 * Reading and publishing a shop's delivery prices (delivery/model.ts): one
 * DOCUMENT of the seller's, `q-store-delivery-<shortStoreId>`, read only at
 * checkout (physical orders) and in the seller's Delivery tab.
 */
import { deliveryIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { jsonToBase64 } from "../qdn/payloads";
import { QdnDeletedError, fetchQdnJson, invalidateQdnSearches, primeQdnJson, resourceExists } from "../qdn/search";
import { deliveryDocOf, type DeliveryDoc } from "./model";

/**
 * The shop's delivery prices, or null when it has none (never published, or
 * deleted). Rejects when it has some the node can't serve right now: checkout
 * then waits rather than charge nothing. Most shops have none, so it asks
 * QDN first (one search, cached for the session) and fetches only one that
 * is there: a missing resource is never fetched.
 */
export async function fetchDeliveryDoc(owner: string, storeId: string, options: { fresh?: boolean } = {}): Promise<DeliveryDoc | null> {
  const identifier = deliveryIdentifier(shortStoreIdOf(storeId));
  if (!(await resourceExists("DOCUMENT", owner, identifier, options))) return null;
  try {
    return deliveryDocOf(await fetchQdnJson("DOCUMENT", owner, identifier, options), storeId);
  } catch (error) {
    if (error instanceof QdnDeletedError) return null;
    throw error;
  }
}

export function buildDeliveryPublish(args: { name: string; doc: DeliveryDoc }) {
  const identifier = deliveryIdentifier(shortStoreIdOf(args.doc.storeId));
  return {
    identifier,
    request: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.name,
      service: "DOCUMENT",
      identifier,
      filename: "delivery.json",
      data64: jsonToBase64(args.doc),
      title: "Delivery prices",
      description: "A shop's delivery prices on Q-Shop",
    },
  };
}

/** After a publish: this session reads what was just published (the node may serve the old one for a while). */
export function rememberDeliveryDoc(owner: string, doc: DeliveryDoc): void {
  const identifier = deliveryIdentifier(shortStoreIdOf(doc.storeId));
  invalidateQdnSearches((url) => url.includes(identifier));
  primeQdnJson("DOCUMENT", owner, identifier, doc);
}
