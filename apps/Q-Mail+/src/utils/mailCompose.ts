/**
 * Pure helpers for the composer: subject prefixes, the quoted reply block,
 * the forward header, the embedded reply history and reply-all recipients.
 *
 * Everything that reaches QDN keeps the shape the original Q-Mail reads
 * (docs/apps/Q-Mail+.md → Data contract §3a, §15, §16):
 * - the quote is Quill 1 markup: one `<blockquote>` per line, inline text only;
 * - `generalData.threadV2[].data` keeps `user/createdAt/subject/attachments/
 *   textContentV2` (and every other top-level field) but loses its own
 *   `generalData`, so payloads stop growing geometrically (Bugs #12);
 * - `to` / `cc` are additive top-level fields the original app ignores.
 */

export type SubjectPrefix = "Re" | "Fwd";

const SUBJECT_PREFIX_PATTERN = /^\s*(re|fwd?|aw|wg)\s*:\s*/i;

/** "Re: x" / "Fwd: x" without stacking "Re: Re:". A reply to a forward keeps "Re:". */
export function withSubjectPrefix(subject: unknown, prefix: SubjectPrefix): string {
  const raw = typeof subject === "string" ? subject.trim() : "";
  const stripped = raw.replace(SUBJECT_PREFIX_PATTERN, "").trim();
  const alreadyPrefixed =
    prefix === "Re"
      ? /^\s*(re|aw)\s*:/i.test(raw)
      : /^\s*(fwd?|wg)\s*:/i.test(raw);
  if (alreadyPrefixed) return raw;
  return stripped ? `${prefix}: ${stripped}` : `${prefix}:`;
}

export function escapeHtml(value: unknown): string {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named === undefined ? match : named;
  });
}

/**
 * HTML → plain-text lines without a DOM: `<br>` and the end of block elements
 * break lines, every other tag is dropped, entities are decoded. Leading and
 * trailing blank lines go, inner blank lines stay (they are paragraph gaps).
 */
export function htmlToTextLines(html: unknown): string[] {
  if (typeof html !== "string" || !html) return [];
  const withBreaks = html
    .replace(/\r\n?/g, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote|pre|tr|section|article|header|footer)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "");
  const lines = decodeHtmlEntities(withBreaks)
    .split("\n")
    .map(line => line.replace(/\u00a0/g, " ").replace(/[ \t]+$/g, ""));
  // Quill wraps every block in <p>…</p>, so "</p>" adds one newline after the
  // text; a paragraph that was only "<br>" becomes two newlines in a row.
  // Collapse runs of three or more blank lines to one blank line.
  const collapsed: string[] = [];
  let blankRun = 0;
  lines.forEach(line => {
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun > 1) return;
      collapsed.push("");
      return;
    }
    blankRun = 0;
    collapsed.push(line);
  });
  while (collapsed.length && collapsed[0] === "") collapsed.shift();
  while (collapsed.length && collapsed[collapsed.length - 1] === "") collapsed.pop();
  return collapsed;
}

/** The text of a message body in reader precedence (§15): textContentV2 → textContent → htmlContent. */
export function messageBodyLines(
  message: any,
  slateToText?: (nodes: any[]) => string
): string[] {
  if (!message) return [];
  if (typeof message.textContentV2 === "string" && message.textContentV2) {
    return htmlToTextLines(message.textContentV2);
  }
  if (Array.isArray(message.textContent)) {
    const text = slateToText ? slateToText(message.textContent) : "";
    return text.split("\n");
  }
  if (typeof message.textContent === "string" && message.textContent) {
    return message.textContent.split("\n");
  }
  if (typeof message.htmlContent === "string" && message.htmlContent) {
    return htmlToTextLines(message.htmlContent);
  }
  return [];
}

export interface QuoteOptions {
  sender?: string;
  sentAt?: string;
  lines: string[];
  /** Keep at most this many quoted lines (default 400). */
  maxLines?: number;
}

/** Quill 1 blockquotes: one per line, inline text only, `<br>` for empty lines. */
export function quoteLinesToHtml(lines: string[], maxLines = 400): string {
  const kept = lines.slice(0, maxLines);
  const quoted = kept.map(line => {
    const trimmed = line.replace(/\s+$/g, "");
    return trimmed ? `<blockquote>${escapeHtml(trimmed)}</blockquote>` : "<blockquote><br></blockquote>";
  });
  if (lines.length > maxLines) {
    quoted.push("<blockquote>[…]</blockquote>");
  }
  return quoted.join("");
}

/**
 * The editor's starting content for a reply: an empty paragraph to type in,
 * the "On …, X wrote:" line and the original body as a quote.
 */
export function buildReplyQuoteHtml({ sender, sentAt, lines, maxLines }: QuoteOptions): string {
  const who = escapeHtml(sender || "Unknown sender");
  const when = escapeHtml(sentAt || "");
  const intro = when ? `On ${when}, ${who} wrote:` : `${who} wrote:`;
  const body = lines.length ? quoteLinesToHtml(lines, maxLines) : "<blockquote>- no message body -</blockquote>";
  return `<p><br></p><p>${intro}</p>${body}`;
}

export interface ForwardHeader {
  from?: string;
  sentAt?: string;
  subject?: string;
  to?: string;
}

/** The forwarded-message header, escaped (Bugs #16), in the shape the original app writes. */
export function buildForwardHeaderHtml({ from, sentAt, subject, to }: ForwardHeader): string {
  const parts = [
    "<p>---------- Forwarded message ---------</p>",
    `<p>From: ${escapeHtml(from || "")}</p>`,
  ];
  if (sentAt) parts.push(`<p>Date: ${escapeHtml(sentAt)}</p>`);
  parts.push(`<p>Subject: ${escapeHtml(subject || "")}</p>`);
  parts.push(`<p>To: ${escapeHtml(to || "")}</p>`);
  parts.push("<p><br></p>");
  return parts.join("");
}

/** A forward's starting content: the header, then the original body as a quote. */
export function buildForwardHtml(header: ForwardHeader, lines: string[]): string {
  return `<p><br></p>${buildForwardHeaderHtml(header)}${quoteLinesToHtml(lines)}`;
}

export interface ThreadReference {
  identifier: string;
  name: string;
  service: string;
}

export interface ThreadEntry {
  reference: ThreadReference;
  data: any;
}

/** Local read-marker entries that `Mail.tsx` injects into list copies (§10). */
export function isLocalReadMarkerEntry(entry: any): boolean {
  return Boolean(entry?.data?.markedAsReadLocally);
}

/**
 * A message as it is embedded in a reply's history: every top-level field the
 * readers use stays, its own `generalData` goes. Readers only need
 * `user/createdAt/subject/attachments/textContentV2` (and `id` as a React key).
 */
export function stripEmbeddedHistory(message: any): any {
  if (!message || typeof message !== "object") return message;
  const { generalData: _generalData, ...rest } = message;
  return rest;
}

/**
 * The `generalData.threadV2` of a reply: the replied-to message's own history
 * (minus local read markers, each entry stripped of nested history) plus the
 * replied-to message itself. Same order and `reference` shape as before.
 */
export function buildReplyThreadV2(replyTo: any, service: string): ThreadEntry[] {
  const previous: any[] = Array.isArray(replyTo?.generalData?.threadV2) ? replyTo.generalData.threadV2 : [];
  const kept: ThreadEntry[] = previous
    .filter(entry => entry && typeof entry === "object" && !isLocalReadMarkerEntry(entry))
    .map(entry => ({
      reference: entry.reference,
      data: stripEmbeddedHistory(entry.data),
    }));
  kept.push({
    reference: {
      identifier: replyTo?.id,
      name: replyTo?.user,
      service,
    },
    data: stripEmbeddedHistory(replyTo),
  });
  return kept;
}

const normalize = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

/**
 * Reply-all recipients: the sender plus everyone in the original `to` / `cc`
 * (additive fields; absent on mail from the original app), minus the current
 * user's own names and minus the sender. The sender is always first.
 */
export function replyAllRecipients(message: any, ownNames: string[]): { to: string; others: string[] } {
  const own = new Set(ownNames.map(normalize).filter(Boolean));
  const sender = typeof message?.user === "string" ? message.user.trim() : "";
  const senderNormalized = normalize(sender);
  const seen = new Set<string>();
  if (senderNormalized) seen.add(senderNormalized);
  const others: string[] = [];
  const consider = (value: unknown) => {
    const candidate = typeof value === "string" ? value.trim() : "";
    const normalized = normalize(candidate);
    if (!normalized || seen.has(normalized) || own.has(normalized)) return;
    seen.add(normalized);
    others.push(candidate);
  };
  (Array.isArray(message?.to) ? message.to : []).forEach(consider);
  (Array.isArray(message?.cc) ? message.cc : []).forEach(consider);
  return { to: sender, others };
}

/**
 * When each correspondent was last in touch, from the rows the app already
 * holds: a received message counts for its sender, a sent message (one whose
 * `user` is one of our own names) for its recipient. Keys are normalised names.
 */
export function recipientActivityByName(
  messages: any[],
  messagesById: Record<string, any> | undefined,
  ownNames: string[]
): Map<string, number> {
  const own = new Set(ownNames.map(normalize).filter(Boolean));
  const activity = new Map<string, number>();
  const bump = (value: unknown, at: number) => {
    const key = normalize(value);
    if (!key || own.has(key)) return;
    if ((activity.get(key) || 0) < at) activity.set(key, at);
  };
  const consider = (message: any) => {
    if (!message || typeof message !== "object") return;
    const at = Number(message.createdAt || message.created || 0);
    if (!Number.isFinite(at) || at <= 0) return;
    const sender = normalize(message.user);
    if (sender && own.has(sender)) {
      bump(message.recipient, at);
      bump(message.to && !Array.isArray(message.to) ? message.to : undefined, at);
      (Array.isArray(message.to) ? message.to : []).forEach((name: unknown) => bump(name, at));
    } else {
      bump(message.user, at);
    }
  };
  (Array.isArray(messages) ? messages : []).forEach(consider);
  if (messagesById && typeof messagesById === "object") {
    Object.values(messagesById).forEach(consider);
  }
  return activity;
}

/** Names ordered by last contact (newest first); names never seen go last, A–Z. */
export function sortNamesByRecency(names: string[], activity: Map<string, number>): string[] {
  return [...names].sort((a, b) => {
    const atA = activity.get(normalize(a)) || 0;
    const atB = activity.get(normalize(b)) || 0;
    if (atA !== atB) return atB - atA;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

/** Direct-mail identifier (binding, §2): first 20 chars of the name + last 6 of the owner address. */
export function directMailIdentifier(recipientName: string, recipientAddress: string, sendId: string): string {
  return `_mail_qortal_qmail_${recipientName.slice(0, 20)}_${recipientAddress.slice(-6)}_mail_${sendId}`;
}

/** Alias-mail identifier (binding, §2): the alias verbatim. */
export function aliasMailIdentifier(aliasValue: string, sendId: string): string {
  return `_mail_qortal_qmail_${aliasValue}_mail_${sendId}`;
}

export interface DirectMailPayloadInput {
  subject: string;
  createdAt: number;
  attachments: any[];
  textContentV2: string;
  recipient: string;
  replyTo?: any;
  service: string;
}

/**
 * The decrypted JSON of a direct mail (§3a) plus the additive `to` / `cc`.
 * `cc` is always empty for now: BCC copies must stay hidden.
 */
export function buildDirectMailObject(input: DirectMailPayloadInput): Record<string, any> {
  const mailObject: Record<string, any> = {
    subject: input.subject,
    createdAt: input.createdAt,
    version: 1,
    attachments: input.attachments,
    textContentV2: input.textContentV2,
    generalData: {
      thread: [],
      threadV2: [] as ThreadEntry[],
    },
    recipient: input.recipient,
    to: [input.recipient],
    cc: [],
  };
  if (input.replyTo?.id) {
    mailObject.generalData.threadV2 = buildReplyThreadV2(input.replyTo, input.service);
  }
  return mailObject;
}
