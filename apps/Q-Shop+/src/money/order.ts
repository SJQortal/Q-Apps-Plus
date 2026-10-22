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
import { jsonToBase64 } from "../qdn/payloads";
import { amountText, unitPrice, type PricedProduct } from "./pricing";

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

const QORT_SVG = `<svg
                          fill={"#000000"}
                          version="1.0"
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 695.000000 754.000000"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <g
                            transform="translate(0.000000,754.000000) scale(0.100000,-0.100000)"
                            stroke="none"
                          >
                            <path
                              d="M3035 7289 c-374 -216 -536 -309 -1090 -629 -409 -236 -1129 -652
                -1280 -739 -82 -48 -228 -132 -322 -186 l-173 -100 0 -1882 0 -1883 38 -24
                c20 -13 228 -134 462 -269 389 -223 1779 -1026 2335 -1347 127 -73 268 -155
                314 -182 56 -32 95 -48 118 -48 33 0 207 97 991 552 l102 60 0 779 c0 428 -2
                779 -4 779 -3 0 -247 -140 -543 -311 -296 -170 -544 -308 -553 -306 -8 2 -188
                104 -400 226 -212 123 -636 368 -942 544 l-558 322 0 1105 c0 1042 1 1106 18
                1116 9 6 107 63 217 126 110 64 421 243 690 398 270 156 601 347 736 425 l247
                142 363 -210 c200 -115 551 -317 779 -449 228 -132 495 -286 594 -341 l178
                -102 -6 -1889 -6 -1888 23 14 c12 8 318 185 680 393 l657 379 0 1887 0 1886
                -77 46 c-43 25 -458 264 -923 532 -465 268 -1047 605 -1295 748 -646 373 -965
                557 -968 557 -1 0 -182 -104 -402 -231z"
                            />
                            <path
                              d="M3010 4769 c-228 -133 -471 -274 -540 -313 l-125 -72 0 -633 0 -632
                295 -171 c162 -94 407 -235 544 -315 137 -79 255 -142 261 -139 6 2 200 113
                431 247 230 133 471 272 534 308 l115 66 2 635 3 635 -536 309 c-294 169 -543
                310 -552 312 -9 2 -204 -105 -432 -237z"
                            />
                          </g>
                        </svg>`;

const ARRR_SVG = `<svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          version="1.1"
                          id="Layer_1"
                          x="0px"
                          y="0px"
                          viewBox="0 0 2000 2000"
                          width="22"
                          height="22"
                          xmlSpace="preserve"
                        >
                          <linearGradient
                            id="SVGID_1_"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            y1="-2"
                            x2="2000"
                            y2="-2"
                            gradientTransform="matrix(1 0 0 1 0 1002)"
                          >
                            <stop offset="0"></stop>
                            <stop offset="1"></stop>
                          </linearGradient>
                          <path
                            fill="#000000"
                            d="M1000,0C447.6,0,0,447.6,0,1000s447.6,1000,1000,1000s1000-447.6,1000-1000S1552.4,0,1000,0z M548.6,741.5  c0-123.6,100.2-223.1,224.6-223.1h512.4c58.6,0,114.9,23,156.7,64.1l-262.2,131.9h-361c-40.7,0-73.1,29.4-73.1,64.8v160.5  l-196.7,102.5V741.5L548.6,741.5z M1507.9,1075.4c0,123.6-100.2,223.1-223.1,223.1H745.3v190.7c0,32.4-24.1,58.8-52.8,65.6  l-67.1,1.5h-76.9v-331.6l257-134.1h431.8c40.7,0,74.6-29.4,74.6-65.6V828.9l195.9-98.7L1507.9,1075.4L1507.9,1075.4z"
                          ></path>
                        </svg>`;

/** The coin's mark in the mail: the original's QORT or ARRR SVG, nothing for other coins. */
function coinMark(currency: string): string {
  if (currency === "QORT") return QORT_SVG;
  if (currency === "ARRR") return ARRR_SVG;
  return "";
}

const LINE = `font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;`;
const CARD = `display: flex; flex-direction: column; align-items: center; padding: 20px 40px; gap: 10px; background-color: white; border-radius: 5px; color: black;`;
const HEAD = `font-family: Merriweather Sans, sans-serif; font-size: 20px; letter-spacing: 0; text-align: center;`;

/**
 * The order summary mail's HTML, in the original's layout. `currencyLabel`
 * is what follows each amount (the ticker, or an asset's name).
 */
export function buildOrderMailHtml(args: {
  details: OrderDetails;
  storeTitle: string | undefined;
  currency: string;
  currencyLabel: string;
  isDigital: boolean;
  buyerName: string;
  delivery: DeliveryInput;
  created: number;
}): string {
  const { details, storeTitle, currency, currencyLabel, isDigital, buyerName, delivery, created } = args;
  const mark = coinMark(currency);
  const unit = escapeHtml(currencyLabel);
  const lines = orderLines(details)
    .map(([, line]) => {
      return `
                <div style="${CARD}">
                <div style="${LINE}">Shop: ${escapeHtml(storeTitle)}</div>
                  <div style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
                    <div style="${LINE}">Product: ${escapeHtml(line.product?.title)}</div>
                    <div style="${LINE}">x ${line.quantity}</div>
                  </div>
                  <div style="display: flex; flex-direction: row; align-items: center;">
                    <div style="display: flex; align-items: center; ${LINE.replace(" text-align: center;", "")} text-align: center; gap: 7px">
                    Price:
                    <div style="display: flex; align-items: center; gap: 2px;">
                    ${mark} ${line.pricePerUnit} ${unit}
                </div>
                  </div>
                    </div>
                  <div style="display: flex; flex-direction: row; align-items: center;">
                    <div style="display: flex; align-items: center; ${LINE.replace(" text-align: center;", "")} text-align: center; gap: 7px">
                    Total Price:
                    <div style="display: flex; align-items: center; gap: 2px;">
                    ${mark}
                    ${line.totalProductPrice} ${unit}
                  </div>
                </div>
              </div>
            </div>
              `;
    })
    .join("");
  const place =
    delivery.country === US
      ? `<div style="${LINE}">
                State: ${escapeHtml(delivery.state)}
              </div>`
      : `<div style="${LINE}">
                Region: ${escapeHtml(delivery.region)}
              </div>`;
  const deliveryBlock = !isDigital
    ? `
        <div>
          <div style="${HEAD}">
            Delivery Information
          </div>
          <div style="${CARD}">
            <div style="${LINE}">
              Qortal Username: ${escapeHtml(buyerName)}
            </div>
            <div style="${LINE}">
              Customer Name: ${escapeHtml(delivery.customerName)}
            </div>
            <div style="${LINE}">
              Street Address: ${escapeHtml(delivery.streetAddress)}
            </div>
            <div style="${LINE}">
              City: ${escapeHtml(delivery.city)}
            </div>
            ${place}
            <div style="${LINE}">
              Country: ${escapeHtml(delivery.country)}
            </div>
            <div style="${LINE}">
              Zip Code: ${escapeHtml(delivery.zipCode)}
            </div>
            <div style="${LINE}">
              Delivery Note: ${escapeHtml(delivery.deliveryNote)}
            </div>
          </div>
        </div>
        `
    : `<div></div>`;
  return `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 10px; gap: 10px;">
        <div style="${HEAD}">
          You have sold a product for your shop!
        </div>
        <div>
          ${lines}
        </div>
        ${deliveryBlock}
        <div>
          <div style="${HEAD}">
            Date of purchase
          </div>
          <div style="${CARD}">
            <div style="font-family: Karla; font-size: 18px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Date: ${formatLlll(created)}
            </div>
          </div>
        </div>
      </div>
      `;
}

export function buildOrderMail(args: {
  shortStoreId: string;
  buyerName: string;
  sellerName: string;
  htmlContent: string;
  createdAt: number;
}) {
  return {
    title: `Order for shop ${args.shortStoreId} from ${args.buyerName}`,
    subject: "New order",
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
}) {
  const orderRequest = {
    action: "PUBLISH_QDN_RESOURCE" as const,
    identifier: orderIdentifier(args.shortStoreId, args.orderUid),
    name: args.buyerName,
    service: "DOCUMENT_PRIVATE",
    data64: jsonToBase64(args.order),
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
