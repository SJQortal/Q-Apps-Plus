/**
 * What the order screens show, read from an order as the original stores it
 * (docs/apps/Q-Shop+.md → Data contract). Display only: amounts are the
 * order's own numbers, never recomputed (money code lives in src/money).
 */
import type { Order } from "../state/features/orderSlice";
import { assetIdOf, type ShopCoinSettings } from "../money/coins";
import { isDigitalOnly, type CartLine } from "../money/order";
import { isDeliveryLine } from "../delivery/model";

const asText = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * An order as the screens use it: the fields that should be text are text
 * (or missing), so an order written wrongly, or on purpose to break the
 * seller's list (anyone can encrypt an order to a seller), can't crash a
 * render. Display only: orders are never republished.
 */
export function displaySafeOrder(order: Order): Order {
  const raw = order as any;
  const payment = raw.payment && typeof raw.payment === "object" ? raw.payment : {};
  return {
    ...order,
    storeName: asText(raw.storeName),
    sellerName: asText(raw.sellerName),
    details: raw.details && typeof raw.details === "object" ? raw.details : undefined,
    delivery: raw.delivery && typeof raw.delivery === "object" ? raw.delivery : undefined,
    payment: {
      ...payment,
      total: typeof payment.total === "string" || typeof payment.total === "number" ? payment.total : undefined,
      currency: asText(payment.currency) ?? "",
      transactionSignature: asText(payment.transactionSignature) ?? null,
      arrrAddressUsed: asText(payment.arrrAddressUsed),
      foreignAddressUsed: asText(payment.foreignAddressUsed),
      foreignTxid: asText(payment.foreignTxid),
      assetId: typeof payment.assetId === "number" ? payment.assetId : undefined,
      assetName: asText(payment.assetName),
    },
  };
}

export interface OrderItem {
  productId: string;
  title: string;
  quantity: number;
  pricePerUnit: number | undefined;
  totalProductPrice: number | undefined;
  catalogueId: string;
  image: string | undefined;
  product: any;
}

function num(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** The order's product lines, in the order they were written (its delivery fee isn't one: orderDelivery). */
export function orderItems(order: Order | null | undefined): OrderItem[] {
  const details = (order?.details ?? {}) as Record<string, any>;
  return Object.keys(details)
    .filter((key) => key !== "totalPrice" && details[key] && typeof details[key] === "object" && !isDeliveryLine(key, details[key]))
    .map((key) => {
      const line = details[key];
      const product = line.product ?? {};
      const images: unknown[] = Array.isArray(product.images) ? product.images : [];
      const main = images[num(product.mainImageIndex) ?? 0] ?? images[0];
      return {
        productId: key,
        title: typeof product.title === "string" && product.title ? product.title : "Product",
        quantity: num(line.quantity) ?? 0,
        pricePerUnit: num(line.pricePerUnit),
        totalProductPrice: num(line.totalProductPrice),
        catalogueId: typeof line.catalogueId === "string" ? line.catalogueId : "",
        image: typeof main === "string" && main ? main : undefined,
        product,
      };
    });
}

/** The order's delivery fee line (delivery/model.ts), when it has one: "Delivery to Poland" and what it cost. */
export function orderDelivery(order: Order | null | undefined): { title: string; total: number | undefined } | null {
  const details = (order?.details ?? {}) as Record<string, any>;
  const key = Object.keys(details).find((k) => k !== "totalPrice" && details[k] && typeof details[k] === "object" && isDeliveryLine(k, details[k]));
  if (!key) return null;
  const title: unknown = details[key].product?.title;
  return { title: typeof title === "string" && title ? title : "Delivery", total: num(details[key].totalProductPrice) };
}

/** "Mug × 2, Poster", or "Mug × 2 and 3 more". */
export function itemSummary(items: OrderItem[], max = 2): string {
  if (items.length === 0) return "No items";
  const part = items.slice(0, max).map((i) => (i.quantity > 1 ? `${i.title} × ${i.quantity}` : i.title));
  const rest = items.length - part.length;
  return rest > 0 ? `${part.join(", ")} and ${rest} more` : part.join(", ");
}

export function itemCount(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + (i.quantity || 0), 0);
}

/** The order total as written (`payment.total`, else `details.totalPrice`). */
export function orderTotal(order: Order | null | undefined): number | string | undefined {
  return order?.payment?.total ?? order?.details?.totalPrice;
}

/** The coin the order was paid in: a ticker, or ASSET:<id>. */
export function orderCoin(order: Order | null | undefined): string {
  return order?.payment?.currency || "QORT";
}

/** Lets AmountTag name an asset the order was paid in. */
export function orderCoinSettings(order: Order | null | undefined): ShopCoinSettings | null {
  const assetId = assetIdOf(orderCoin(order)) ?? order?.payment?.assetId ?? null;
  if (assetId === null || assetId === undefined) return null;
  return { acceptedAssets: [{ id: assetId, name: order?.payment?.assetName || `Asset #${assetId}` }] };
}

/** Every product digital: no delivery address (the original's check). */
export function isDigitalOrder(order: Order | null | undefined): boolean {
  const lines: CartLine[] = orderItems(order).map((i) => ({
    productId: i.productId,
    catalogueId: i.catalogueId,
    quantity: i.quantity,
    product: i.product,
  }));
  return isDigitalOnly(lines);
}

const DATE_TIME = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function formatOrderDate(timestamp: number | undefined): string {
  if (!timestamp) return "";
  try {
    return DATE_TIME.format(new Date(timestamp));
  } catch {
    return "";
  }
}

export interface AddressLine {
  label: string;
  value: string;
}

/** The delivery address as labelled lines (state for the United States, region elsewhere). */
export function deliveryLines(order: Order | null | undefined): AddressLine[] {
  const delivery = order?.delivery;
  if (!delivery) return [];
  const a = (delivery.shippingAddress ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const lines: AddressLine[] = [
    { label: "Name", value: text(delivery.customerName) },
    { label: "Street address", value: text(a.streetAddress) },
    { label: "City", value: text(a.city) },
    { label: a.state !== undefined ? "State" : "Region", value: text(a.state ?? a.region) },
    { label: "Country", value: text(a.country) },
    { label: "Postcode", value: text(a.zipCode) },
    { label: "Delivery note", value: text(a.deliveryNote) },
  ];
  return lines.filter((l) => l.value);
}
