import { isUiThemeId, type UiThemeId } from "../hub-theme";
import { type AppSettings, sanitizeSettings } from "./settings";
import { objectToBase64 } from "./toBase64";
import { searchQdn } from "./qdnSearch";
import { fetchQdnResource, needsEncodedFetch } from "./fetchVideos";

/**
 * Settings sync to QDN, after Torq's settingsQdn.ts: the app settings plus
 * the chosen theme are published as one small DOCUMENT under the user's
 * name, and restored from it on another device. Additive data with its own
 * identifier; the original Q-Share never reads it (it searches `qshare_file_`).
 *
 * Nothing here runs on its own: Save publishes (Hub confirms, the usual fee
 * applies) and Restore fetches, both only when pressed on the Settings page.
 */
export const SETTINGS_IDENTIFIER = "qshareplus_settings";
export const SETTINGS_SERVICE = "DOCUMENT";
export const SETTINGS_FILENAME = "settings.json";
export const SETTINGS_TITLE = "Q-Share+ settings";
export const SETTINGS_SNAPSHOT_VERSION = 1;

export interface SettingsSnapshot extends AppSettings {
  version: number;
  /** null when the stored theme is unknown to this build. */
  uiTheme: UiThemeId | null;
  updatedAt: number;
}

export interface SettingsPublishRequest {
  action: "PUBLISH_QDN_RESOURCE";
  service: "DOCUMENT";
  name: string;
  identifier: string;
  data64: string;
  title: string;
  filename: string;
}

export function collectSettingsSnapshot(
  settings: AppSettings,
  uiTheme: UiThemeId | null,
  updatedAt: number = Date.now()
): SettingsSnapshot {
  return {
    version: SETTINGS_SNAPSHOT_VERSION,
    ...sanitizeSettings(settings),
    uiTheme: isUiThemeId(uiTheme) ? uiTheme : null,
    updatedAt,
  };
}

function looksLikeSettings(record: Record<string, unknown>): boolean {
  return (
    typeof record.version === "number" ||
    record.uiTheme !== undefined ||
    typeof record.autoPreviewImages === "boolean" ||
    typeof record.defaultSort === "string" ||
    Array.isArray(record.hiddenNames) ||
    typeof record.followingFeed === "boolean"
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** JSON, or base64 JSON, or an object: FETCH_QDN_RESOURCE has answered in every shape. */
function decodeFetched(response: unknown): Record<string, unknown> | null {
  const direct = asRecord(response);
  if (direct) return direct;
  if (typeof response !== "string") return null;
  try {
    return asRecord(JSON.parse(response));
  } catch {
    /* try base64 */
  }
  try {
    return asRecord(JSON.parse(decodeURIComponent(escape(atob(response)))));
  } catch {
    return null;
  }
}

/** A tolerant read of whatever is stored: unknown fields are dropped, missing ones take defaults. */
export function normalizeSettingsSnapshot(value: unknown): SettingsSnapshot | null {
  const record = decodeFetched(value);
  if (!record) return null;
  const candidates = [record];
  const nested = record.data !== undefined ? decodeFetched(record.data) : null;
  if (nested) candidates.push(nested);
  const payload = candidates.find(looksLikeSettings);
  if (!payload) return null;
  const updatedAt =
    typeof payload.updatedAt === "number" && Number.isFinite(payload.updatedAt) ? payload.updatedAt : 0;
  return collectSettingsSnapshot(
    sanitizeSettings(payload),
    isUiThemeId(payload.uiTheme) ? payload.uiTheme : null,
    updatedAt
  );
}

/** The publish payload; Hub asks the user to confirm it. Pinned by settingsQdn.test.ts. */
export async function buildSettingsPublish(name: string, snapshot: SettingsSnapshot): Promise<SettingsPublishRequest> {
  return {
    action: "PUBLISH_QDN_RESOURCE",
    service: SETTINGS_SERVICE,
    name,
    identifier: SETTINGS_IDENTIFIER,
    data64: await objectToBase64(snapshot),
    title: SETTINGS_TITLE,
    filename: SETTINGS_FILENAME,
  };
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
 * One FETCH_QDN_RESOURCE. When it fails, one search (exact name, limit 1)
 * tells "never saved" from "saved on another device, not on this node yet":
 * for data the node still has to get from its peers, Core holds a FETCH for
 * up to about 15 s and then fails it ("Data unavailable"), and saying
 * "nothing saved" then could lead to a needless, paid save.
 */
export async function fetchSettingsFromQdn(name: string): Promise<SettingsRestore> {
  if (!name) return { kind: "none" };
  try {
    // q-apps.js doesn't encode the name: "Vallot-/8/" would read Core's HTTP 400
    // page back as a string, which looks like "nothing saved".
    const response = needsEncodedFetch(name)
      ? await fetchQdnResource(SETTINGS_SERVICE, name, SETTINGS_IDENTIFIER)
      : await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name,
          service: SETTINGS_SERVICE,
          identifier: SETTINGS_IDENTIFIER,
        });
    const snapshot = normalizeSettingsSnapshot(response);
    return snapshot ? { kind: "found", snapshot } : { kind: "none" };
  } catch {
    try {
      const rows = await searchQdn(
        { service: SETTINGS_SERVICE, identifier: SETTINGS_IDENTIFIER, name, exactmatchnames: true, limit: 1 },
        { fresh: true }
      );
      return rows.some((row) => row.identifier === SETTINGS_IDENTIFIER) ? { kind: "not-local" } : { kind: "none" };
    } catch {
      return { kind: "error" };
    }
  }
}

/** Publishes the snapshot; rejects when Hub declines or the publish fails. */
export async function publishSettingsToQdn(
  name: string,
  settings: AppSettings,
  uiTheme: UiThemeId | null
): Promise<SettingsSnapshot> {
  if (!name) throw new Error("A Qortal name is required to save settings");
  const snapshot = collectSettingsSnapshot(settings, uiTheme);
  await qortalRequest(await buildSettingsPublish(name, snapshot));
  return snapshot;
}
