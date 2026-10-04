/**
 * The mail footer (a signature): plain text the composer adds under a new
 * message and, when the switch is on, above the quote of a reply or forward.
 *
 * Stored per account in localStorage, `qmail_footer_<address>`:
 *   { default: string, byName: { "<name>": string }, inReplies: boolean }
 * and published, additively, as `settings.footer` in qmail_state_v1
 * (docs/apps/Q-Mail+.md → Data contract §10, §16). The footer itself only
 * reaches other people inside the message body (`textContentV2`), as the
 * Quill 1 paragraphs built here, so the mail format does not change.
 */

export const MAIL_FOOTER_STORAGE_PREFIX = "qmail_footer_";
/** Long enough for any signature, short enough to keep the state document small. */
export const MAIL_FOOTER_MAX_LENGTH = 2000;
/** Fired on window when a footer is written (Settings listens to reload). */
export const MAIL_FOOTER_CHANGED_EVENT = "qmail-footer-changed";

export interface MailFooterSettings {
  /** Used for every name without its own footer. */
  default: string;
  /** Per-name footers, keyed by the name as spelt; looked up case-insensitively. */
  byName: Record<string, string>;
  /** Add the footer to replies and forwards (default on). */
  inReplies: boolean;
}

export type FooterKind = "new" | "reply" | "forward";

export const emptyMailFooter = (): MailFooterSettings => ({
  default: "",
  byName: {},
  inReplies: true,
});

/**
 * Plain text as the footer keeps it: `\n` line breaks, no trailing spaces on
 * a line, no blank lines before or after, at most MAIL_FOOTER_MAX_LENGTH.
 */
export const normalizeFooterText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "")
    .slice(0, MAIL_FOOTER_MAX_LENGTH)
    .replace(/\s+$/g, "");
};

/** Any value → a footer object; null when it is not an object. */
export const normalizeMailFooter = (
  value: unknown
): MailFooterSettings | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const byName: Record<string, string> = {};
  const seen = new Set<string>();
  if (raw.byName && typeof raw.byName === "object" && !Array.isArray(raw.byName)) {
    Object.entries(raw.byName as Record<string, unknown>).forEach(([name, text]) => {
      const key = typeof name === "string" ? name.trim() : "";
      const footer = normalizeFooterText(text);
      if (!key || !footer || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      byName[key] = footer;
    });
  }
  return {
    default: normalizeFooterText(raw.default),
    byName,
    inReplies: raw.inReplies !== false,
  };
};

/** True when there is no footer text at all (the switch alone is not a footer). */
export const isMailFooterEmpty = (footer: MailFooterSettings | null | undefined): boolean =>
  !footer || (!footer.default && Object.keys(footer.byName).length === 0);

export const mailFooterStorageKey = (address?: string | null): string => {
  const normalized = typeof address === "string" ? address.trim() : "";
  return normalized ? `${MAIL_FOOTER_STORAGE_PREFIX}${normalized}` : "";
};

export const readMailFooter = (address?: string | null): MailFooterSettings => {
  const key = mailFooterStorageKey(address);
  if (!key) return emptyMailFooter();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyMailFooter();
    return normalizeMailFooter(JSON.parse(raw)) ?? emptyMailFooter();
  } catch {
    return emptyMailFooter();
  }
};

export const writeMailFooter = (
  address: string | null | undefined,
  footer: MailFooterSettings
): void => {
  const key = mailFooterStorageKey(address);
  if (!key) return;
  const normalized = normalizeMailFooter(footer) ?? emptyMailFooter();
  try {
    localStorage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Storage full or blocked: the footer lasts for this session only.
  }
  try {
    window.dispatchEvent(new Event(MAIL_FOOTER_CHANGED_EVENT));
  } catch {
    // No window (tests without a DOM).
  }
};

/**
 * The published footer, applied only when this device has none: a local
 * footer is never overwritten silently. Returns true when it was applied.
 */
export const applyPublishedFooter = (
  address: string | null | undefined,
  published: MailFooterSettings | null | undefined
): boolean => {
  if (!address || isMailFooterEmpty(published)) return false;
  if (!isMailFooterEmpty(readMailFooter(address))) return false;
  writeMailFooter(address, published as MailFooterSettings);
  return true;
};

/** The name's own footer, else the default ("" when neither is set). */
export const footerTextForName = (
  footer: MailFooterSettings,
  name: string | null | undefined
): string => {
  const wanted = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (wanted) {
    const match = Object.entries(footer.byName).find(
      ([key]) => key.toLowerCase() === wanted
    );
    if (match && match[1]) return match[1];
  }
  return footer.default;
};

/**
 * Escapes the way the editor serialises text (`root.innerHTML`): only `&`,
 * `<` and `>`. Quotes stay as they are, so the inserted HTML is exactly what
 * Quill reports back and the footer can still be found to swap it.
 */
const escapeFooterText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text → Quill 1 paragraphs, one `<p>` per line, `<p><br></p>` for a blank one. */
export const footerTextToHtml = (text: unknown): string => {
  const normalized = normalizeFooterText(text);
  if (!normalized) return "";
  return normalized
    .split("\n")
    .map(line => (line ? `<p>${escapeFooterText(line)}</p>` : "<p><br></p>"))
    .join("");
};

/**
 * What the composer inserts for this name: the footer paragraphs, and for a
 * reply or forward a blank line after them (before "X wrote:" / the forward
 * header). "" when there is no footer, or replies are switched off.
 */
export const footerBlockFor = (
  footer: MailFooterSettings,
  name: string | null | undefined,
  kind: FooterKind
): string => {
  if (kind !== "new" && !footer.inReplies) return "";
  const html = footerTextToHtml(footerTextForName(footer, name));
  if (!html) return "";
  return kind === "new" ? html : `${html}<p><br></p>`;
};

/** A new message's starting body: a line to type on, then the footer ("" without one). */
export const buildNewMessageBody = (footerBlock: string): string =>
  footerBlock ? `<p><br></p>${footerBlock}` : "";

const EMPTY_LINE = "<p><br></p>";

/**
 * Swap the footer block in a body (the From name changed). Returns the new
 * body, or null when the old block is no longer there as inserted (the user
 * edited it), so the body is left alone. A body that had no footer gets one
 * only while it is untouched.
 */
export const swapFooterInBody = (
  body: string,
  oldBlock: string,
  newBlock: string,
  kind: FooterKind,
  untouched: boolean
): string | null => {
  if (oldBlock === newBlock) return body;
  if (!oldBlock) {
    if (!untouched) return null;
    if (kind === "new") {
      if (body && body !== EMPTY_LINE) return null;
      return buildNewMessageBody(newBlock);
    }
    if (!body.startsWith(EMPTY_LINE)) return null;
    return `${EMPTY_LINE}${newBlock}${body.slice(EMPTY_LINE.length)}`;
  }
  if (kind === "new") {
    if (!body.endsWith(oldBlock)) return null;
    return `${body.slice(0, body.length - oldBlock.length)}${newBlock}`;
  }
  const at = body.indexOf(oldBlock);
  if (at < 0) return null;
  return `${body.slice(0, at)}${newBlock}${body.slice(at + oldBlock.length)}`;
};
