/**
 * Pure helpers for mail search (N8): the matching rules, the text each row is
 * matched against, and the mailbox tag that lets one result list span the
 * inbox, archive, sent mail and alias inboxes.
 *
 * Rules kept from the original useMailboxSearch: the query is lower-cased and
 * split on whitespace, every term must match, and the text covers the other
 * party (sender, or recipient label/name/address suffix for sent mail), the
 * decrypted subject and body, and the QDN metadata title/description.
 */
import { extractTextFromSlate } from "../../utils/extractTextFromSlate";
import {
  getSentRecipientDisplayLabel,
  parseSentRecipientFromIdentifier,
} from "./mailIdentifier";

export type MailboxType = "inbox" | "sent";
export type MailboxKind = "inbox" | "archived" | "sent" | "alias";
export type MailSearchScope = "mailbox" | "all";

export interface MailboxRef {
  kind: MailboxKind;
  /** The owned name for an inbox/sent row, when known. */
  name?: string;
  /** The watched alias for an alias-inbox row. */
  alias?: string;
}

/** The property a cross-mailbox search row carries; never published anywhere. */
export const SEARCH_TAG = "__qmailSearch";

export const toMessageId = (message: any): string => {
  return String(message?.id || message?.identifier || "");
};

export function tagForMailbox<T extends object>(message: T, ref: MailboxRef): T {
  return { ...message, [SEARCH_TAG]: ref };
}

export function mailboxRefOf(message: any): MailboxRef | undefined {
  const ref = message?.[SEARCH_TAG];
  return ref && typeof ref === "object" ? (ref as MailboxRef) : undefined;
}

export function mailboxTypeForRef(ref: MailboxRef | undefined): MailboxType {
  return ref?.kind === "sent" ? "sent" : "inbox";
}

export function mailboxLabel(ref: MailboxRef | undefined): string {
  if (!ref) return "";
  switch (ref.kind) {
    case "sent":
      return ref.name ? `Sent · ${ref.name}` : "Sent";
    case "archived":
      return "Archived";
    case "alias":
      return ref.alias ? `Alias · ${ref.alias}` : "Alias";
    default:
      return ref.name ? `Inbox · ${ref.name}` : "Inbox";
  }
}

export const normalizeSearchText = (value: string): string => {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
};

export const getSearchTerms = (query: string): string[] => {
  return normalizeSearchText(query || "")
    .split(/\s+/)
    .map(item => item.trim())
    .filter(Boolean);
};

export const includesAllTerms = (haystack: string, terms: string[]): boolean => {
  if (!terms.length) return true;
  return terms.every(term => haystack.includes(term));
};

const stripHtml = (html: string): string => {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
};

/** Body text of a decrypted message: Quill HTML (textContentV2) or Slate (textContentV2 / textContent). */
export const extractBodyText = (decryptedMessage: any): string => {
  const parts: string[] = [];
  const body = decryptedMessage?.textContentV2;
  if (typeof body === "string") {
    parts.push(stripHtml(body));
  } else if (Array.isArray(body)) {
    parts.push(extractTextFromSlate(body));
  }
  const legacyBody = decryptedMessage?.textContent;
  if (Array.isArray(legacyBody)) {
    parts.push(extractTextFromSlate(legacyBody));
  } else if (typeof legacyBody === "string" && body === undefined) {
    parts.push(stripHtml(legacyBody));
  }
  return parts.join(" ").trim();
};

export const getOtherPartyText = (message: any, mailboxType: MailboxType): string => {
  if (mailboxType === "inbox") {
    return typeof message?.user === "string" ? message.user : "";
  }

  const identifier = toMessageId(message);
  const { recipientName, recipientAddress } =
    parseSentRecipientFromIdentifier(identifier);
  const recipientLabel = getSentRecipientDisplayLabel(identifier);
  const senderName = typeof message?.user === "string" ? message.user : "";

  return [
    recipientLabel,
    recipientName || "",
    recipientAddress ? `address ${recipientAddress}` : "",
    senderName,
  ]
    .join(" ")
    .trim();
};

/**
 * Phase 1 text: what is known without decrypting the body. `subject` is the
 * decrypted subject from the hash map or the saved-subject cache, if any;
 * `recipient` the decrypted recipient of a sent message, if known.
 */
export const buildMetaSearchText = (
  message: any,
  mailboxType: MailboxType,
  subject?: string,
  recipient?: string
): string => {
  const title = typeof message?.title === "string" ? message.title : "";
  const description =
    typeof message?.description === "string" ? message.description : "";
  return normalizeSearchText(
    [getOtherPartyText(message, mailboxType), recipient || "", subject || "", title, description]
      .join(" ")
      .trim()
  );
};

/** Phase 2 text: everything, including the decrypted body. */
export const buildFullSearchText = (
  message: any,
  mailboxType: MailboxType,
  decryptedMessage?: any
): string => {
  const subject =
    typeof decryptedMessage?.subject === "string" ? decryptedMessage.subject : "";
  const recipient =
    typeof decryptedMessage?.recipient === "string" ? decryptedMessage.recipient : "";
  const body = decryptedMessage ? extractBodyText(decryptedMessage) : "";
  return normalizeSearchText(
    [buildMetaSearchText(message, mailboxType, subject, recipient), body].join(" ").trim()
  );
};

/** Names a decrypt may be addressed to (sent: the parsed recipient first, then the sender). */
export const getDecryptCandidates = (message: any, mailboxType: MailboxType): string[] => {
  const candidates: string[] = [];
  if (mailboxType === "sent") {
    const { recipientName } = parseSentRecipientFromIdentifier(toMessageId(message));
    if (recipientName) candidates.push(recipientName);
  }
  if (typeof message?.user === "string" && message.user.trim()) {
    candidates.push(message.user.trim());
  }
  return Array.from(new Set(candidates.filter(Boolean)));
};
