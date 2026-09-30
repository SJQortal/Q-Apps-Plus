import { isUiThemeId, type UiThemeId } from "../hub-theme";
import { type AppSettings, sanitizeSettings } from "./settings";
import { objectToBase64 } from "./toBase64";

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

/** One FETCH_QDN_RESOURCE; null when nothing is stored or the node cannot serve it. */
export async function fetchSettingsFromQdn(name: string): Promise<SettingsSnapshot | null> {
  if (!name) return null;
  try {
    const response = await qortalRequest({
      action: "FETCH_QDN_RESOURCE",
      name,
      service: SETTINGS_SERVICE,
      identifier: SETTINGS_IDENTIFIER,
    });
    return normalizeSettingsSnapshot(response);
  } catch {
    return null;
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
