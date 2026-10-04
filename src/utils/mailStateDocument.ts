/**
 * The published mailbox state: service DOCUMENT_PRIVATE, identifier
 * `qmail_state_v1`, encrypted to the owner (docs/apps/Q-Mail+.md → Data
 * contract §10). The shape the original Q-Mail reads is binding:
 *
 *   { version: 1, updatedAt, ownerAddress, names: [...],
 *     messages: { "<id>": { read?: true, subject?: string, updatedAt?: number } } }
 *
 * Q-Mail+ adds two top-level keys, which the original app ignores (it only
 * reads `messages`): the map `archived: { "<id>": { at } }` and the object
 * `settings: { uiTheme, textSize, watchedAliases, aliasReplyLinks }`.
 * Per-entry extras are not allowed: the original's normaliser drops them on
 * load.
 */
import {
  normalizeArchivedMap,
  withPublishedArchived,
  type ArchivedMap,
} from "./archiveState";
import { isUiThemeId, type UiThemeId } from "../hub-theme/tokens";

export const MAIL_STATE_DOCUMENT_SERVICE = "DOCUMENT_PRIVATE";
export const MAIL_STATE_DOCUMENT_IDENTIFIER = "qmail_state_v1";

export interface QMailPublishedStateEntry {
  read?: boolean;
  updatedAt?: number;
  subject?: string;
}

export type MailStateTextSize = "small" | "medium" | "large";
const TEXT_SIZES: readonly MailStateTextSize[] = ["small", "medium", "large"];

/**
 * Additive (Q-Mail+ only): the device's appearance and alias lists at publish
 * time. Appearance is only ever applied on request (Settings → Sync →
 * Restore); the alias lists are unioned into the local ones on load.
 */
export interface QMailPublishedSettings {
  uiTheme?: UiThemeId;
  textSize?: MailStateTextSize;
  watchedAliases: string[];
  aliasReplyLinks: Record<string, string>;
}

export interface QMailPublishedStateDocument {
  version: number;
  updatedAt: number;
  ownerAddress: string;
  names: string[];
  messages: Record<string, QMailPublishedStateEntry>;
  /** Additive (Q-Mail+ only). */
  archived?: ArchivedMap;
  /** Additive (Q-Mail+ only). */
  settings?: QMailPublishedSettings;
}

/** Trimmed, non-empty, deduped case-insensitively; the first spelling wins. */
export const normalizeWatchedAliases = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const aliases: string[] = [];
  value.forEach(item => {
    const alias = typeof item === "string" ? item.trim() : "";
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) return;
    seen.add(key);
    aliases.push(alias);
  });
  return aliases;
};

/** Lower-cased alias → trimmed reply alias; empty keys and values dropped. */
export const normalizeAliasReplyLinks = (
  value: unknown
): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const links: Record<string, string> = {};
  Object.entries(value as Record<string, unknown>).forEach(
    ([alias, replyAlias]) => {
      const key = typeof alias === "string" ? alias.trim().toLowerCase() : "";
      const reply = typeof replyAlias === "string" ? replyAlias.trim() : "";
      if (!key || !reply) return;
      links[key] = reply;
    }
  );
  return links;
};

/**
 * Accepts any value and keeps only what Q-Mail+ wrote: a known theme id, one
 * of the three text sizes, and the two alias lists. Returns null when the
 * value is not an object (a document from the original app has no settings).
 */
export const normalizePublishedSettings = (
  value: unknown
): QMailPublishedSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const settings: QMailPublishedSettings = {
    watchedAliases: normalizeWatchedAliases(raw.watchedAliases),
    aliasReplyLinks: normalizeAliasReplyLinks(raw.aliasReplyLinks),
  };
  if (isUiThemeId(raw.uiTheme)) settings.uiTheme = raw.uiTheme;
  if (
    typeof raw.textSize === "string" &&
    (TEXT_SIZES as readonly string[]).includes(raw.textSize)
  ) {
    settings.textSize = raw.textSize as MailStateTextSize;
  }
  return settings;
};

/** Union of watched aliases: the local list first and its spellings kept. */
export const mergeWatchedAliases = (
  local: string[],
  published: string[]
): string[] => {
  const merged = normalizeWatchedAliases([...local, ...published]);
  const localNormalized = normalizeWatchedAliases(local);
  if (merged.length === localNormalized.length) return local;
  return merged;
};

/** Union of reply links: a link the device already has wins over the document's. */
export const mergeAliasReplyLinks = (
  local: Record<string, string>,
  published: Record<string, string>
): Record<string, string> => {
  const localNormalized = normalizeAliasReplyLinks(local);
  const merged = { ...normalizeAliasReplyLinks(published), ...localNormalized };
  if (Object.keys(merged).length === Object.keys(localNormalized).length) {
    return local;
  }
  return merged;
};

export const normalizePublishedStateEntry = (
  entry: QMailPublishedStateEntry | null | undefined
): QMailPublishedStateEntry => {
  const read = Boolean(entry?.read);
  const subject =
    typeof entry?.subject === "string" ? entry.subject.trim() : "";
  const updatedAt = Number(entry?.updatedAt || 0);
  const normalized: QMailPublishedStateEntry = {};
  if (read) normalized.read = true;
  if (subject) normalized.subject = subject;
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    normalized.updatedAt = updatedAt;
  }
  return normalized;
};

/** Merge rule: `read` OR, newer subject wins, max `updatedAt`. */
export const mergePublishedStateEntries = (
  base: QMailPublishedStateEntry | null | undefined,
  incoming: QMailPublishedStateEntry | null | undefined
): QMailPublishedStateEntry => {
  const normalizedBase = normalizePublishedStateEntry(base);
  const normalizedIncoming = normalizePublishedStateEntry(incoming);
  return {
    read: Boolean(normalizedBase.read || normalizedIncoming.read) || undefined,
    subject: normalizedIncoming.subject || normalizedBase.subject || undefined,
    updatedAt:
      Math.max(
        Number(normalizedBase.updatedAt || 0),
        Number(normalizedIncoming.updatedAt || 0)
      ) || undefined,
  };
};

export const arePublishedStateEntriesEqual = (
  a: QMailPublishedStateEntry | null | undefined,
  b: QMailPublishedStateEntry | null | undefined
): boolean => {
  const normalizedA = normalizePublishedStateEntry(a);
  const normalizedB = normalizePublishedStateEntry(b);
  return (
    Boolean(normalizedA.read) === Boolean(normalizedB.read) &&
    (normalizedA.subject || "") === (normalizedB.subject || "")
  );
};

export interface BuildPublishedStateInput {
  ownerAddress: string;
  names: string[];
  /** What was last loaded or published (the base of the merge). */
  publishedEntries: Record<string, QMailPublishedStateEntry>;
  /** What this device knows (read flags from the store, subjects from decrypted mail). */
  localEntries: Record<string, QMailPublishedStateEntry>;
  archived: ArchivedMap;
  /** This device's appearance and alias lists; omitted → no `settings` key. */
  settings?: QMailPublishedSettings;
  now?: number;
}

/** The exact document to publish, plus the merged entries to remember as "published". */
export const buildPublishedMailStateDocument = ({
  ownerAddress,
  names,
  publishedEntries,
  localEntries,
  archived,
  settings,
  now = Date.now(),
}: BuildPublishedStateInput): {
  document: QMailPublishedStateDocument;
  mergedEntries: Record<string, QMailPublishedStateEntry>;
} => {
  const mergedEntries: Record<string, QMailPublishedStateEntry> = {
    ...publishedEntries,
  };
  Object.entries(localEntries).forEach(([identifier, entry]) => {
    mergedEntries[identifier] = mergePublishedStateEntries(
      mergedEntries[identifier],
      { ...entry, updatedAt: now }
    );
  });
  const document: QMailPublishedStateDocument = {
    version: 1,
    updatedAt: now,
    ownerAddress,
    names,
    messages: mergedEntries,
    archived: { ...archived },
  };
  if (settings) {
    const normalizedSettings = normalizePublishedSettings(settings);
    if (normalizedSettings) document.settings = normalizedSettings;
  }
  return { document, mergedEntries };
};

export interface ParsedPublishedState {
  messages: Record<string, QMailPublishedStateEntry>;
  archived: ArchivedMap;
  /** null for a document without the additive `settings` object. */
  settings: QMailPublishedSettings | null;
}

/**
 * Read a decoded document. Only `messages`, `archived` and `settings` are
 * used; an entry survives when it has a truthy `read` or a non-empty subject
 * (as the original app does). Returns null when nothing usable is there.
 */
export const parsePublishedMailStateDocument = (
  decoded: unknown
): ParsedPublishedState | null => {
  if (!decoded || typeof decoded !== "object") return null;
  const doc = decoded as Record<string, unknown>;
  const archived = normalizeArchivedMap(doc.archived);
  const settings = normalizePublishedSettings(doc.settings);
  const maybeMessages = doc.messages;
  if (!maybeMessages || typeof maybeMessages !== "object") {
    return Object.keys(archived).length || settings
      ? { messages: {}, archived, settings }
      : null;
  }
  const messages: Record<string, QMailPublishedStateEntry> = {};
  Object.entries(maybeMessages as Record<string, unknown>).forEach(
    ([identifier, entry]) => {
      if (!identifier || typeof entry !== "object" || !entry) return;
      const normalizedEntry = normalizePublishedStateEntry(
        entry as QMailPublishedStateEntry
      );
      if (!normalizedEntry.read && !normalizedEntry.subject) return;
      messages[identifier] = normalizedEntry;
    }
  );
  return { messages, archived, settings };
};

export interface PublishBaseInput {
  /** What was loaded or published this session (empty when nothing was). */
  publishedEntries: Record<string, QMailPublishedStateEntry>;
  archived: ArchivedMap;
  watchedAliases: string[];
  aliasReplyLinks: Record<string, string>;
}

/**
 * Fold the document already on QDN into the base of a publish, so a device
 * that never loaded it cannot wipe what other devices published. Messages are
 * merged per id, archived ids and alias lists are unioned, and local values
 * win. `remote` null means there is no document yet.
 */
export const mergeRemoteStateIntoPublishBase = (
  base: PublishBaseInput,
  remote: ParsedPublishedState | null
): PublishBaseInput => {
  if (!remote) return base;
  const publishedEntries: Record<string, QMailPublishedStateEntry> = {
    ...remote.messages,
  };
  Object.entries(base.publishedEntries).forEach(([identifier, entry]) => {
    publishedEntries[identifier] = mergePublishedStateEntries(
      publishedEntries[identifier],
      entry
    );
  });
  return {
    publishedEntries,
    archived: withPublishedArchived(base.archived, remote.archived),
    watchedAliases: mergeWatchedAliases(
      base.watchedAliases,
      remote.settings?.watchedAliases || []
    ),
    aliasReplyLinks: mergeAliasReplyLinks(
      base.aliasReplyLinks,
      remote.settings?.aliasReplyLinks || {}
    ),
  };
};
