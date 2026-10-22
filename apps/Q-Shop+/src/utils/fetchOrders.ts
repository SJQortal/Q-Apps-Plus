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

/** Where reading an order failed: not on the node (yet), not decryptable, or not an order. */
export type OrderReadStage = "fetch" | "decrypt" | "invalid";

export class OrderReadError extends Error {
  readonly stage: OrderReadStage;
  constructor(stage: OrderReadStage, cause?: unknown) {
    super(`Order ${stage} failed`, cause === undefined ? undefined : { cause });
    this.name = "OrderReadError";
    this.stage = stage;
  }
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
  if (!checkStructureOrders(json)) throw new OrderReadError("invalid");
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
