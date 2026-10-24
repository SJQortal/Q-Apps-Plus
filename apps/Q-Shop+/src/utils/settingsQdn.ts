/**
 * Settings sync to QDN, after Q-Share+'s utils/settingsQdn.ts (and Torq's):
 * the chosen theme, preferred coin and product view are published as one small DOCUMENT
 * under the active name, and restored from it on another device. Additive
 * data with its own identifier (constants/plus.ts); the original Q-Shop
 * never reads it.
 *
 * Nothing here runs on its own: Save publishes (Hub confirms, the usual fee
 * applies) and Restore fetches, both only when pressed in Settings.
 */
import { APP_NAME, SETTINGS_SYNC_IDENTIFIER } from "../constants/plus";
import { isUiThemeId, type UiThemeId } from "../hub-theme";
import { jsonToBase64 } from "../qdn/payloads";
import { fetchQdnJson, invalidateQdnJson, invalidateQdnSearches, resourceExists } from "../qdn/search";
import { isPreferredCoin } from "./settingsStorage";
import { isProductView, type ProductView } from "./productView";

export { SETTINGS_SYNC_IDENTIFIER };
export const SETTINGS_SERVICE = "DOCUMENT";
export const SETTINGS_FILENAME = "settings.json";
export const SETTINGS_TITLE = `${APP_NAME} settings`;
export const SETTINGS_SNAPSHOT_VERSION = 1;

/** What is stored: `{version: 1, theme, preferredCoin, productView?}`. */
export interface SettingsSnapshot {
  version: number;
  /** null when the stored theme is unknown to this build. */
  theme: UiThemeId | null;
  /** null when the stored coin is unknown to this build. */
  preferredCoin: string | null;
  /** Round 5, additive: how shops show products (utils/productView.ts); absent in older saves. */
  productView?: ProductView | null;
}

/** A type, not an interface, so it fits qortalRequest's open options type. */
export type SettingsPublishRequest = {
  action: "PUBLISH_QDN_RESOURCE";
  service: "DOCUMENT";
  name: string;
  identifier: string;
  data64: string;
  title: string;
  filename: string;
};

export function collectSettingsSnapshot(theme: unknown, preferredCoin: unknown, productView?: unknown): SettingsSnapshot {
  return {
    version: SETTINGS_SNAPSHOT_VERSION,
    theme: isUiThemeId(theme) ? theme : null,
    preferredCoin: isPreferredCoin(preferredCoin) ? preferredCoin : null,
    ...(productView !== undefined && { productView: isProductView(productView) ? productView : null }),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** An object, JSON text or base64 JSON: the node and Hub have answered in each shape. */
function decodeStored(value: unknown): Record<string, unknown> | null {
  const direct = asRecord(value);
  if (direct) return direct;
  if (typeof value !== "string") return null;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    /* try base64 */
  }
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    return asRecord(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

function looksLikeSettings(record: Record<string, unknown>): boolean {
  return (
    typeof record.version === "number" ||
    record.theme !== undefined ||
    record.preferredCoin !== undefined ||
    record.productView !== undefined
  );
}

/**
 * A tolerant read of whatever is stored: unknown fields are dropped, and a
 * theme or coin this build doesn't know comes back as null (left unchanged
 * on Restore). Null when it isn't a settings document at all.
 */
export function normalizeSettingsSnapshot(value: unknown): SettingsSnapshot | null {
  const record = decodeStored(value);
  if (!record) return null;
  const candidates = [record];
  const nested = record.data !== undefined ? decodeStored(record.data) : null;
  if (nested) candidates.push(nested);
  const payload = candidates.find(looksLikeSettings);
  if (!payload) return null;
  return collectSettingsSnapshot(payload.theme, payload.preferredCoin, payload.productView);
}

/** The publish request; Hub asks the user to confirm it. Pinned by settingsQdn.test.ts. */
export function buildSettingsPublish(name: string, snapshot: SettingsSnapshot): SettingsPublishRequest {
  return {
    action: "PUBLISH_QDN_RESOURCE",
    service: SETTINGS_SERVICE,
    name,
    identifier: SETTINGS_SYNC_IDENTIFIER,
    data64: jsonToBase64(snapshot),
    title: SETTINGS_TITLE,
    filename: SETTINGS_FILENAME,
  };
}

/** Publishes the snapshot under `name`; rejects when Hub declines, times out or the publish fails. */
export async function publishSettingsToQdn(name: string, snapshot: SettingsSnapshot): Promise<SettingsSnapshot> {
  if (!name) throw new Error("A Qortal name is required to save settings");
  await qortalRequest(buildSettingsPublish(name, snapshot));
  // The next Restore, here or after a reload of the search, reads the new one.
  invalidateQdnJson(SETTINGS_SERVICE, name, SETTINGS_SYNC_IDENTIFIER);
  invalidateQdnSearches((url) => url.includes(encodeURIComponent(SETTINGS_SYNC_IDENTIFIER)));
  return snapshot;
}

/**
 * What Restore found: the snapshot; nothing saved under the name; a save the
 * node knows about but hasn't got the data for yet; or no answer from the node.
 */
export type SettingsRestore =
  | { kind: "found"; snapshot: SettingsSnapshot }
  | { kind: "none" }
  | { kind: "not-local" }
  | { kind: "error" };

/**
 * One fetch of the document (the name encoded, so names with a space, `+`
 * or `/` work). When it fails, one search (exact name and identifier, limit
 * 1) tells "never saved" from "saved on another device, not on this node
 * yet": Core holds a fetch for data it must get from peers for about 15 s
 * and then fails it, and saying "nothing saved" then could lead to a
 * needless, paid save.
 */
export async function fetchSettingsFromQdn(name: string): Promise<SettingsRestore> {
  if (!name) return { kind: "none" };
  try {
    const stored = await fetchQdnJson<unknown>(SETTINGS_SERVICE, name, SETTINGS_SYNC_IDENTIFIER, { fresh: true });
    const snapshot = normalizeSettingsSnapshot(stored);
    return snapshot ? { kind: "found", snapshot } : { kind: "none" };
  } catch {
    try {
      const exists = await resourceExists(SETTINGS_SERVICE, name, SETTINGS_SYNC_IDENTIFIER, { fresh: true });
      return exists ? { kind: "not-local" } : { kind: "none" };
    } catch {
      return { kind: "error" };
    }
  }
}
