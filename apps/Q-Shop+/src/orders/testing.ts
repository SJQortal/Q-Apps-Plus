/**
 * Orders and worlds for the order tests: orders shaped as the original
 * publishes them (docs/apps/Q-Shop+.md → Data contract), from the shop
 * fixtures. Not used by the app.
 */
import { BUYER, CATALOGUE_ID, SELLER, SHORT_STORE_ID, STORE_TITLE, chair, mug, poster } from "../test/fixtures/shop";
import type { World } from "../test/mockNode";

export const OTHER_SELLER = "Seller 1";
export const OTHER_SHORT = "shop-1";

export function orderId(uid: string, short = SHORT_STORE_ID): string {
  return `q-store-order-${short}-${uid}`;
}

export function statusId(uid: string, short = SHORT_STORE_ID): string {
  return `q-store-status-order-${short}-${uid}`;
}

export interface OrderSpec {
  seller?: string;
  storeName?: string;
  buyer?: string;
  currency?: string;
  physical?: boolean;
  signature?: string | null;
  payment?: Record<string, unknown>;
  lines?: { product: any; quantity: number; unit: number }[];
}

/** An order JSON as the original Cart writes it. */
export function orderJson(spec: OrderSpec = {}) {
  const lines =
    spec.lines ?? (spec.physical ? [{ product: chair, quantity: 1, unit: 12 }] : [{ product: mug, quantity: 2, unit: 1.5 }]);
  let total = 0;
  const details: Record<string, any> = { totalPrice: 0 };
  for (const line of lines) {
    details[line.product.id] = {
      product: line.product,
      catalogueId: CATALOGUE_ID,
      quantity: line.quantity,
      pricePerUnit: line.unit,
      totalProductPrice: line.unit * line.quantity,
    };
    total += line.unit * line.quantity;
  }
  details.totalPrice = total.toFixed(8);
  const buyer = spec.buyer ?? BUYER;
  return {
    created: 1761000000000,
    version: 1,
    details,
    storeName: spec.storeName ?? STORE_TITLE,
    sellerName: spec.seller ?? SELLER,
    delivery: spec.physical
      ? {
          customerName: "Ana Silva",
          shippingAddress: {
            streetAddress: "Rua 1",
            city: "Lisbon",
            region: "Lisboa",
            country: "Portugal",
            zipCode: "1000-001",
            deliveryNote: "Ring twice",
          },
        }
      : {
          customerName: buyer,
          shippingAddress: { streetAddress: "", city: "", region: "", country: "", zipCode: "", deliveryNote: "" },
        },
    payment: {
      total: total.toFixed(8),
      currency: spec.currency ?? "QORT",
      transactionSignature: spec.signature === undefined ? "PAYMENTSIG" : spec.signature,
      arrrAddressUsed: "",
      ...(spec.payment ?? {}),
    },
    communicationMethod: ["Q-Mail"],
  };
}

/** Adds an order to a mock-node world (published by `buyer`, `created` orders the search). */
export function addOrder(world: World, uid: string, created: number, spec: OrderSpec & { short?: string } = {}) {
  const buyer = spec.buyer ?? BUYER;
  world.orders.push({ identifier: orderId(uid, spec.short), buyer, created, json: orderJson(spec) });
}

/** Adds the seller's status document for an order. */
export function addStatus(
  world: World,
  uid: string,
  status: string,
  note = "",
  opts: { seller?: string; short?: string; created?: number } = {}
) {
  world.statuses.push({
    identifier: statusId(uid, opts.short),
    seller: opts.seller ?? SELLER,
    created: opts.created ?? 1762000000000,
    json: { status, note },
  });
}

/** Adds a buyer's "it arrived" for an order (orders/delivered.ts). */
export function addDelivered(world: World, uid: string, opts: { buyer?: string; short?: string; created?: number } = {}) {
  (world.delivered ??= []).push({
    identifier: `q-store-delivered-${opts.short ?? SHORT_STORE_ID}-${uid}`,
    buyer: opts.buyer ?? BUYER,
    created: opts.created ?? 1763000000000,
  });
}

export { poster };
