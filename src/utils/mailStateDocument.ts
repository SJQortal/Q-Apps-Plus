/**
 * The published mailbox state: service DOCUMENT_PRIVATE, identifier
 * `qmail_state_v1`, encrypted to the owner (docs/apps/Q-Mail+.md → Data
 * contract §10). The shape the original Q-Mail reads is binding:
 *
 *   { version: 1, updatedAt, ownerAddress, names: [...],
 *     messages: { "<id>": { read?: true, subject?: string, updatedAt?: number } } }
 *
 * Q-Mail+ adds ONE top-level map, `archived: { "<id>": { at } }`, which the
 * original app ignores (it only reads `messages`). Per-entry extras are not
 * allowed: the original's normaliser drops them on load.
 */
import {
  normalizeArchivedMap,
  type ArchivedMap,
} from "./archiveState";

export const MAIL_STATE_DOCUMENT_SERVICE = "DOCUMENT_PRIVATE";
export const MAIL_STATE_DOCUMENT_IDENTIFIER = "qmail_state_v1";

export interface QMailPublishedStateEntry {
  read?: boolean;
  updatedAt?: number;
  subject?: string;
}

export interface QMailPublishedStateDocument {
  version: number;
  updatedAt: number;
  ownerAddress: string;
  names: string[];
  messages: Record<string, QMailPublishedStateEntry>;
  /** Additive (Q-Mail+ only). */
  archived?: ArchivedMap;
}

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
  now?: number;
}

/** The exact document to publish, plus the merged entries to remember as "published". */
export const buildPublishedMailStateDocument = ({
  ownerAddress,
  names,
  publishedEntries,
  localEntries,
  archived,
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
  return { document, mergedEntries };
};

export interface ParsedPublishedState {
  messages: Record<string, QMailPublishedStateEntry>;
  archived: ArchivedMap;
}

/**
 * Read a decoded document. Only `messages` and `archived` are used; an entry
 * survives when it has a truthy `read` or a non-empty subject (as the original
 * app does). Returns null when there is no usable `messages` object.
 */
export const parsePublishedMailStateDocument = (
  decoded: unknown
): ParsedPublishedState | null => {
  if (!decoded || typeof decoded !== "object") return null;
  const doc = decoded as Record<string, unknown>;
  const archived = normalizeArchivedMap(doc.archived);
  const maybeMessages = doc.messages;
  if (!maybeMessages || typeof maybeMessages !== "object") {
    return Object.keys(archived).length ? { messages: {}, archived } : null;
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
  return { messages, archived };
};
