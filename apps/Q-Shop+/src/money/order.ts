/**
 * The order the buyer publishes and the Q-Mail message to the seller, built
 * exactly as the original Cart builds them (pinned by Cart.pin.test.tsx and
 * order.test.ts): same keys, same order of keys, same floats.
 *
 * Changes from the original, both fixes (docs/apps/Q-Shop+.md → Money code
 * changes): a product without a price stops the checkout with a message
 * before anything is paid (the original crashed); and text typed by the buyer
 * or the seller is HTML-escaped in the mail.
 */
import { orderIdentifier, orderMailIdentifier } from "../qdn/identifiers";
import { APP_NAME } from "../constants/plus";
import { jsonToBase64 } from "../qdn/payloads";
import { amountText, formatPrice, unitPrice, type PricedProduct } from "./pricing";
import { isDeliveryLine } from "../delivery/model";

export interface CartLine {
  productId: string;
  catalogueId: string;
  quantity: number;
  /** The product as held in its catalogue (stored in the order as is); null when not loaded. */
  product: (PricedProduct & { title?: string; type?: string }) | null;
}

export interface OrderLine {
  product: any;
  catalogueId: string;
  quantity: number;
  pricePerUnit: number;
  totalProductPrice: number;
}

export type OrderDetails = { totalPrice: string } & Record<string, OrderLine | string>;

export class MissingPriceError extends Error {
  readonly productTitle: string;
  constructor(title: string) {
    super(`Could not find the price of ${title || "a product"}`);
    this.name = "MissingPriceError";
    this.productTitle = title;
  }
}

/**
 * `details` of an order: `totalPrice` first, then one entry per product in
 * the cart's order; per-unit and line prices are floats, the total is
 * `toFixed(8)` text. Lines whose product isn't loaded are skipped, as the
 * original does.
 */
export function buildOrderDetails(lines: CartLine[], coin: string, rate: number | null): OrderDetails {
  let total = 0;
  const details: Record<string, OrderLine | number> = { totalPrice: 0 };
  for (const line of lines) {
    const product = line.product;
    if (!product) continue;
    const price = unitPrice(product, coin, rate);
    if (!price) throw new MissingPriceError(String(product.title ?? ""));
    const lineTotal = price * line.quantity;
    details[line.productId] = {
      product,
      catalogueId: line.catalogueId,
      quantity: line.quantity,
      pricePerUnit: price,
      totalProductPrice: price * line.quantity,
    };
    total = total + lineTotal;
  }
  details.totalPrice = total;
  return { ...(details as Record<string, OrderLine>), totalPrice: amountText(total) } as OrderDetails;
}

/** The order's float total before rounding (for display next to the rounded amount). */
export function orderLines(details: OrderDetails): [string, OrderLine][] {
  return Object.keys(details)
    .filter((key) => key !== "totalPrice")
    .map((key) => [key, details[key] as OrderLine]);
}

export function isDigitalOnly(lines: CartLine[]): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => line.product?.type === "digital");
}

export interface DeliveryInput {
  customerName: string;
  streetAddress: string;
  city: string;
  /** Used for the United States (a state), otherwise `region`. */
  state: string;
  region: string;
  country: string;
  zipCode: string;
  deliveryNote: string;
}

export const US = "United States";

/** The `delivery` block: `state` for the United States, `region` elsewhere, in the original's key order. */
export function buildDelivery(input: DeliveryInput) {
  const shippingAddress =
    input.country === US
      ? {
          streetAddress: input.streetAddress,
          city: input.city,
          state: input.state,
          country: input.country,
          zipCode: input.zipCode,
          deliveryNote: input.deliveryNote,
        }
      : {
          streetAddress: input.streetAddress,
          city: input.city,
          region: input.region,
          country: input.country,
          zipCode: input.zipCode,
          deliveryNote: input.deliveryNote,
        };
  return { customerName: input.customerName, shippingAddress };
}

/** A digital order's delivery: the buyer's name and an empty address, as the original sends it. */
export function digitalDelivery(buyerName: string): DeliveryInput {
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

/** Which fields a physical order needs (the original's check; the note is optional). */
export function missingDeliveryFields(input: DeliveryInput): (keyof DeliveryInput)[] {
  const missing: (keyof DeliveryInput)[] = [];
  if (!input.customerName.trim()) missing.push("customerName");
  if (!input.streetAddress.trim()) missing.push("streetAddress");
  if (!input.country) missing.push("country");
  if (!input.city.trim()) missing.push("city");
  if (input.country === US && !input.state) missing.push("state");
  if (input.country !== US && !input.region.trim()) missing.push("region");
  if (!input.zipCode.trim()) missing.push("zipCode");
  return missing;
}

export interface PaymentRecord {
  total: string;
  currency: string;
  transactionSignature: string | null;
  arrrAddressUsed: string;
  /** + app, additive: the address paid in a coin besides QORT and ARRR (Q-Shop+'s test builds offered BTC, LTC, DOGE, DGB, RVN). */
  foreignAddressUsed?: string;
  /** + app, additive: Hub's answer for a foreign-coin payment (the transaction id). */
  foreignTxid?: string;
  /** + app, additive: the Qortal asset paid. */
  assetId?: number;
  assetName?: string;
}

export function buildOrder(args: {
  created: number;
  details: OrderDetails;
  storeName: string | undefined;
  sellerName: string;
  delivery: DeliveryInput;
  payment: PaymentRecord;
}) {
  return {
    created: args.created,
    version: 1,
    details: args.details,
    storeName: args.storeName,
    sellerName: args.sellerName,
    delivery: buildDelivery(args.delivery),
    payment: args.payment,
    communicationMethod: ["Q-Mail"],
  };
}

export type OrderDoc = ReturnType<typeof buildOrder>;

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** moment's English `llll` ("Thu, Sep 4, 1986 8:30 PM") in local time, without moment. */
export function formatLlll(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${h12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

// The mail's look (Simon, 2026-10-23: "nicer, more easy to read, professional"):
// left-aligned, one column, no fonts or colours of its own (Q-Mail shows it in
// its theme's font and colours, and removes colours and backgrounds anyway),
// grey hairlines that read in light and dark.
const RULE = "1px solid rgba(128, 128, 128, 0.35)";
const KICKER = "margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7;";
const TITLE = "margin: 4px 0 2px; font-size: 22px; font-weight: 700; line-height: 1.3;";
const SECTION = "margin: 24px 0 8px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.75;";
const P = "margin: 0 0 4px;";
const TH = `padding: 8px 10px 8px 0; border-bottom: ${RULE}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.75;`;
const TD = `padding: 10px 10px 10px 0; border-bottom: ${RULE}; vertical-align: top;`;
const NUM = "text-align: right; white-space: nowrap;";

function amount(value: number | string, unit: string): string {
  return `${formatPrice(typeof value === "string" ? Number(value) : value)} ${unit}`;
}

/**
 * The seller's order mail: who ordered, when, the items with their prices
 * and the total paid, how it was paid, where to deliver it, and what to do
 * next. Typed text (titles, the address, the note) is HTML-escaped.
 */
export function buildOrderMailHtml(args: {
  details: OrderDetails;
  storeTitle: string | undefined;
  currency: string;
  /** What follows each amount (the ticker, or an asset's name). */
  currencyLabel: string;
  isDigital: boolean;
  buyerName: string;
  delivery: DeliveryInput;
  created: number;
  /** The payment as recorded in the order (its transaction), when known. */
  payment?: PaymentRecord | null;
  /** The order's own id (its uid), for reference. */
  orderUid?: string;
}): string {
  const { details, storeTitle, currencyLabel, isDigital, buyerName, delivery, created, payment, orderUid } = args;
  const unit = escapeHtml(currencyLabel);
  const shop = escapeHtml(storeTitle || "your shop");
  const lines = orderLines(details);
  // The delivery fee is a line of its own (delivery/model.ts): in the table, not in the item count.
  const items = lines.filter(([key, line]) => !isDeliveryLine(key, line)).reduce((sum, [, line]) => sum + (Number(line.quantity) || 0), 0);
  const rows = lines
    .map(([key, line]) => {
      if (isDeliveryLine(key, line)) {
        return `<tr>
          <td style="${TD}" colspan="3"><strong>${escapeHtml(line.product?.title || "Delivery")}</strong></td>
          <td style="${TD} ${NUM}">${amount(line.totalProductPrice, unit)}</td>
        </tr>`;
      }
      const won = line.product?.auctionWin ? `<div style="font-size: 13px; opacity: 0.75;">Won at auction</div>` : "";
      return `<tr>
          <td style="${TD}"><strong>${escapeHtml(line.product?.title || "Item")}</strong>${won}</td>
          <td style="${TD} ${NUM}">${escapeHtml(line.quantity)}</td>
          <td style="${TD} ${NUM}">${amount(line.pricePerUnit, unit)}</td>
          <td style="${TD} ${NUM}">${amount(line.totalProductPrice, unit)}</td>
        </tr>`;
    })
    .join("");
  const total = String(details.totalPrice ?? "");
  const code = (text: string) => `<span style="font-family: monospace; font-size: 13px; word-break: break-all;">${escapeHtml(text)}</span>`;
  const paymentLines: string[] = [`Paid: <strong>${amount(payment?.total ?? total, unit)}</strong>`];
  if (payment?.transactionSignature) paymentLines.push(`Transaction: ${code(payment.transactionSignature)}`);
  if (payment?.foreignTxid) paymentLines.push(`Transaction: ${code(payment.foreignTxid)}`);
  const paidTo = payment?.arrrAddressUsed || payment?.foreignAddressUsed;
  if (paidTo) paymentLines.push(`To your address: ${code(paidTo)}`);
  const place = delivery.country === US ? delivery.state : delivery.region;
  const address = [
    delivery.customerName,
    delivery.streetAddress,
    [delivery.city, [place, delivery.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    delivery.country,
  ]
    .filter((line) => line && line.trim())
    .map((line) => escapeHtml(line))
    .join("<br>");
  const deliveryBlock = isDigital
    ? `<p style="${P}">Digital order: nothing to ship.</p>`
    : `<p style="${P} line-height: 1.6;">${address}</p>${
        delivery.deliveryNote.trim() ? `<p style="margin: 8px 0 4px;"><strong>Note from the buyer:</strong> ${escapeHtml(delivery.deliveryNote)}</p>` : ""
      }`;
  return `<div style="max-width: 640px; text-align: left; font-size: 15px; line-height: 1.55;">
    <p style="${KICKER}">New order · ${shop}</p>
    <h2 style="${TITLE}">${escapeHtml(buyerName)} ordered ${items === 1 ? "1 item" : `${items} items`}</h2>
    <p style="${P} opacity: 0.8;">${escapeHtml(formatLlll(created))}${orderUid ? ` · Order ${escapeHtml(orderUid)}` : ""}</p>

    <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="${TH} text-align: left;">Item</th>
          <th style="${TH} ${NUM}">Qty</th>
          <th style="${TH} ${NUM}">Price</th>
          <th style="${TH} ${NUM}">Total</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding: 12px 10px 0 0;"><strong>Total</strong></td>
          <td style="padding: 12px 10px 0 0; ${NUM}"><strong>${amount(total, unit)}</strong></td>
        </tr>
      </tfoot>
    </table>

    <h3 style="${SECTION}">Payment</h3>
    ${paymentLines.map((line) => `<p style="${P}">${line}</p>`).join("\n    ")}

    <h3 style="${SECTION}">${isDigital ? "Delivery" : "Ship to"}</h3>
    ${deliveryBlock}
    <p style="${P}">Qortal name: <strong>${escapeHtml(buyerName)}</strong></p>

    <p style="margin: 28px 0 0; padding-top: 12px; border-top: ${RULE}; font-size: 13px; opacity: 0.75;">
      Sent by ${escapeHtml(APP_NAME)} when the order was placed. The order is in your shop's Orders, where you can update its status for the buyer; reply to this message to write to them.
    </p>
  </div>`;
}

export function buildOrderMail(args: {
  shortStoreId: string;
  storeTitle?: string;
  buyerName: string;
  sellerName: string;
  htmlContent: string;
  createdAt: number;
}) {
  return {
    title: `Order for shop ${args.shortStoreId} from ${args.buyerName}`,
    // What Q-Mail lists: which shop and who (it was "New order" for every one).
    subject: `New order${args.storeTitle ? ` at ${args.storeTitle}` : ""} from ${args.buyerName}`.slice(0, 120),
    createdAt: args.createdAt,
    version: 1,
    attachments: [],
    textContent: "",
    htmlContent: args.htmlContent,
    generalData: {
      thread: [],
    },
    recipient: args.sellerName,
  };
}

/**
 * The one encrypted PUBLISH_MULTIPLE_QDN_RESOURCES of a checkout: the order
 * (DOCUMENT_PRIVATE under the buyer's name) and the seller's mail
 * (MAIL_PRIVATE), encrypted to the seller and the buyer.
 */
export function buildOrderPublish(args: {
  buyerName: string;
  shortStoreId: string;
  orderUid: string;
  mailUid: string;
  sellerName: string;
  sellerAddress: string;
  sellerPublicKey: string;
  buyerPublicKey: string;
  order: OrderDoc;
  mail: ReturnType<typeof buildOrderMail>;
  /**
   * + app, additive: the order's public note of its counted products
   * (stock/model.ts stockNote), in its metadata; the order itself stays
   * encrypted. None for an order without one, which stays as before.
   */
  stockNote?: string | null;
}) {
  const orderRequest = {
    action: "PUBLISH_QDN_RESOURCE" as const,
    identifier: orderIdentifier(args.shortStoreId, args.orderUid),
    name: args.buyerName,
    service: "DOCUMENT_PRIVATE",
    data64: jsonToBase64(args.order),
    ...(args.stockNote && { description: args.stockNote }),
  };
  const mailRequest = {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name: args.buyerName,
    service: "MAIL_PRIVATE",
    data64: jsonToBase64(args.mail),
    identifier: orderMailIdentifier(args.sellerName, args.sellerAddress, args.mailUid),
  };
  return {
    action: "PUBLISH_MULTIPLE_QDN_RESOURCES" as const,
    resources: [orderRequest, mailRequest],
    encrypt: true,
    publicKeys: [args.sellerPublicKey, args.buyerPublicKey],
  };
}
