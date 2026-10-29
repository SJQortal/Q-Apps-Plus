/**
 * Reading one order, exactly as the original does (pinned by
 * ShowOrder.pin.test.tsx): `FETCH_QDN_RESOURCE {name: <buyer>, service:
 * DOCUMENT_PRIVATE, identifier, encoding: base64}`, then `DECRYPT_DATA
 * {encryptedData}`, then a structure check.
 *
 * Change from the original, a fix (docs/apps/Q-Shop+.md → Bugs 4): a failed
 * or unreadable order resolves to `{...content, isValid: false}` instead of
 * `undefined`, which made the caller throw and stop loading the rest.
 */
import { checkStructureOrders } from "./checkStructure";
import { base64ToJson } from "../qdn/payloads";

/**
 * Where reading an order failed: not on the node (yet), not decryptable, not
 * an order, or another app's order (`foreign`, with its app when it names one).
 */
export type OrderReadStage = "fetch" | "decrypt" | "invalid" | "foreign";

/** The app another app's order names: its Q-App name, and a `qortal://APP/<name>` link to open it. */
export interface ForeignOrderApp {
  name: string;
  link: string | null;
}

export class OrderReadError extends Error {
  readonly stage: OrderReadStage;
  readonly app?: ForeignOrderApp;
  constructor(stage: OrderReadStage, cause?: unknown, app?: ForeignOrderApp) {
    super(`Order ${stage} failed`, cause === undefined ? undefined : { cause });
    this.name = "OrderReadError";
    this.stage = stage;
    if (app) this.app = app;
  }
}

/** A Q-App name as it can follow `qortal://APP/` (Qortal names: letters, digits, spaces and a few marks). */
const APP_NAME = /^[\p{L}\p{N} ._+-]{1,40}$/u;

/**
 * Another app's order under Q-Shop's prefix: Q-Shops (qortal://APP/Q-Shops,
 * seen in Simon's Hub on 2026-10-27) publishes its buyers' orders as
 * DOCUMENT_PRIVATE `q-store-order-…` too, encrypted the same way, so they
 * decrypt but aren't Q-Shop orders. Such a JSON says where it came from
 * (`orderedVia`, or a `qortal://APP/…` link), or has Q-Shops' own fields;
 * null for one that doesn't, which stays a broken Q-Shop order.
 */
export function foreignOrderApp(json: unknown): ForeignOrderApp | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const fields = json as Record<string, unknown>;
  const href = Object.values(fields).find((v): v is string => typeof v === "string" && /^qortal:\/\/APP\/[^/?#\s]/i.test(v.trim()));
  const via = typeof fields.orderedVia === "string" && fields.orderedVia.trim() !== "";
  if (!href && !via) {
    // Q-Shops' first orders (May 2026) say neither, but have its own fields, which a Q-Shop order never has.
    const qshops = typeof fields.shopPublisher === "string" && typeof fields.orderId === "string" && fields.orderId.startsWith("qs-");
    return qshops ? { name: "Q-Shops", link: "qortal://APP/Q-Shops" } : null;
  }
  let name = "";
  if (href) {
    try {
      name = decodeURIComponent(href.trim().replace(/^qortal:\/\/APP\//i, "").split(/[/?#]/)[0]).trim();
    } catch {
      name = "";
    }
  }
  // As written: Hub doesn't decode an app name in a link (docs/QORTAL.md, deep links with "+").
  return APP_NAME.test(name) ? { name, link: `qortal://APP/${name}` } : { name: "another app", link: null };
}

/**
 * Hub answers FETCH_QDN_RESOURCE with the base64 body, but a resource that
 * isn't on the node can come back as Core's `{error, message}`, as an object
 * or as its JSON text.
 */
function isEncryptedPayload(data: unknown): data is string {
  if (typeof data !== "string" || data.length === 0) return false;
  const start = data.trimStart()[0];
  if (start === "{" || start === "[") {
    try {
      JSON.parse(data);
      return false;
    } catch {
      return true;
    }
  }
  return true;
}

/** The decrypted order JSON, or an OrderReadError saying where it failed. */
export async function readOrderJson(user: string, orderId: string): Promise<any> {
  let data: unknown;
  try {
    data = await qortalRequest({
      action: "FETCH_QDN_RESOURCE",
      name: user,
      service: "DOCUMENT_PRIVATE",
      identifier: orderId,
      encoding: "base64",
    });
  } catch (error) {
    throw new OrderReadError("fetch", error);
  }
  if (!isEncryptedPayload(data)) throw new OrderReadError("fetch");
  let decrypted: unknown;
  try {
    decrypted = await qortalRequest({
      action: "DECRYPT_DATA",
      encryptedData: data,
    });
  } catch (error) {
    throw new OrderReadError("decrypt", error);
  }
  if (typeof decrypted !== "string" || !decrypted) throw new OrderReadError("decrypt");
  let json: unknown;
  try {
    json = base64ToJson(decrypted);
  } catch (error) {
    throw new OrderReadError("decrypt", error);
  }
  if (!checkStructureOrders(json)) {
    const app = foreignOrderApp(json);
    throw app ? new OrderReadError("foreign", undefined, app) : new OrderReadError("invalid");
  }
  return json;
}

/**
 * The original's reader: the order merged with its search row, marked
 * "Received" (the status is read separately) and `isValid`.
 */
export const fetchAndEvaluateOrders = async (data: { user?: string; orderId?: string; content?: any }) => {
  const { user, orderId, content } = data;
  const invalid = { ...content, isValid: false };
  if (!user || !orderId) return invalid;
  try {
    const order = await readOrderJson(user, orderId);
    return {
      ...order,
      ...content,
      status: "Received",
      note: "",
      user,
      id: orderId,
      isValid: true,
    };
  } catch {
    return invalid;
  }
};
