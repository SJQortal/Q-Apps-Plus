/**
 * What a product description can hold besides text (Simon, 2026-10-22): a
 * video on Qortal and a file (a PDF) on Qortal, each a block in the
 * description's HTML, plus the Qortal links that stand for them.
 *
 * In `htmlDescription` an embed is
 *   <div class="qshop-embed" data-kind="video|file" data-name="…" data-identifier="…"
 *        data-title="…" data-filename="…" data-mimetype="…" data-size="…" data-link="qortal://…">
 *     Video: <title></div>
 * The text inside is what an app that doesn't know embeds shows. A video is a
 * VIDEO resource, a file a FILE resource; `link` is where it opens (a Q-Tube
 * or Q-Share page) and is only ever a qortal:// link. A video may name its
 * thumbnail, a THUMBNAIL resource (Simon, 2026-10-23), in `data-thumb-name`
 * and `data-thumb-identifier`: the seller's own, whoever published the
 * video. Anyone can publish a
 * description, so every embed is read back through `embedFromData`, which
 * keeps only well-formed values.
 *
 * Links: Q-Tube's `qortal://APP/Q-Tube/video/<name>/<id>` (its id is the
 * video's JSON document, which names the VIDEO resource in
 * `videoReference`), Q-Share's `qortal://APP/Q-Share/share/<name>/<id>` (a
 * share's JSON document, with its `files`), and plain resource links
 * `qortal://VIDEO/<name>/<id>` and `qortal://FILE/<name>/<id>`. Links this
 * app writes open the original Q-Tube and Q-Share (Simon, 2026-10-19).
 */

export const EMBED_CLASS = "qshop-embed";

export interface VideoEmbed {
  kind: "video";
  name: string;
  identifier: string;
  title?: string;
  link?: string;
  /** A picture shown until it plays: a THUMBNAIL resource. */
  thumbnail?: { name: string; identifier: string };
}

export interface FileEmbed {
  kind: "file";
  name: string;
  identifier: string;
  title?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  link?: string;
}

export type QortalEmbed = VideoEmbed | FileEmbed;

export type QortalTarget =
  | { kind: "qtube"; name: string; identifier: string }
  | { kind: "qshare"; name: string; identifier: string }
  | { kind: "video"; name: string; identifier: string }
  | { kind: "file"; name: string; identifier: string };

/** QDN identifiers as Core takes them: letters, digits, `_`, `-` and `.`, at most 64. */
export function isSafeIdentifier(value: unknown): value is string {
  // Not only dots: "." and ".." would walk the node's URL paths.
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) && !/^\.+$/.test(value);
}

/** A Qortal name: at most 40 characters, no control characters. */
export function isSafeName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 40 || value.trim() !== value || /^\.+$/.test(value)) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(value);
}

const seg = encodeURIComponent;

export function qtubeLink(name: string, identifier: string): string {
  return `qortal://APP/Q-Tube/video/${seg(name)}/${seg(identifier)}`;
}

export function qshareLink(name: string, identifier: string): string {
  return `qortal://APP/Q-Share/share/${seg(name)}/${seg(identifier)}`;
}

export function resourceLink(service: "VIDEO" | "FILE", name: string, identifier: string): string {
  return `qortal://${service}/${seg(name)}/${seg(identifier)}`;
}

function decode(part: string | undefined): string | null {
  if (part === undefined) return null;
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/** What a qortal:// link points at, when it is one of the links above. */
export function parseQortalLink(text: unknown): QortalTarget | null {
  if (typeof text !== "string") return null;
  const match = /^qortal:\/\/([^?#\s]+)/i.exec(text.trim());
  if (!match) return null;
  const parts = match[1].split("/").filter((part, i, all) => part !== "" || i < all.length - 1);
  const head = parts[0]?.toUpperCase();
  let kind: QortalTarget["kind"] | null = null;
  let at = 0;
  if (head === "APP") {
    const app = decode(parts[1])?.replace(/\+$/, "").toLowerCase();
    const page = parts[2]?.toLowerCase();
    if (app === "q-tube" && page === "video") kind = "qtube";
    else if (app === "q-share" && page === "share") kind = "qshare";
    at = 3;
  } else if (head === "VIDEO" || head === "FILE") {
    kind = head === "VIDEO" ? "video" : "file";
    at = 1;
  }
  if (!kind) return null;
  const name = decode(parts[at]);
  const identifier = decode(parts[at + 1]);
  if (!isSafeName(name) || !isSafeIdentifier(identifier)) return null;
  return { kind, name, identifier };
}

/** A qortal:// link (any), or undefined. */
function qortalLinkOrNone(value: unknown): string | undefined {
  return typeof value === "string" && /^qortal:\/\/\S+$/i.test(value) && value.length <= 300 ? value : undefined;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, max);
  return clean || undefined;
}

/** An embed from its `data-*` attributes (an element's dataset), or null when it isn't well formed. */
export function embedFromData(data: Record<string, string | undefined>): QortalEmbed | null {
  const { kind, name, identifier } = data;
  if (!isSafeName(name) || !isSafeIdentifier(identifier)) return null;
  const title = text(data.title, 180);
  const link = qortalLinkOrNone(data.link);
  if (kind === "video") {
    const thumbnail = isSafeName(data.thumbName) && isSafeIdentifier(data.thumbIdentifier) ? { name: data.thumbName, identifier: data.thumbIdentifier } : undefined;
    return { kind, name, identifier, ...(title && { title }), ...(link && { link }), ...(thumbnail && { thumbnail }) };
  }
  if (kind !== "file") return null;
  const filename = text(data.filename, 180);
  const mimetype = typeof data.mimetype === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(data.mimetype) ? data.mimetype : undefined;
  const size = Number(data.size);
  return {
    kind,
    name,
    identifier,
    ...(title && { title }),
    ...(filename && { filename }),
    ...(mimetype && { mimetype }),
    ...(Number.isSafeInteger(size) && size > 0 && { size }),
    ...(link && { link }),
  };
}

/** The `data-*` attributes that store an embed (the inverse of embedFromData). */
export function embedData(embed: QortalEmbed): Record<string, string> {
  const data: Record<string, string> = { kind: embed.kind, name: embed.name, identifier: embed.identifier };
  if (embed.title) data.title = embed.title;
  if (embed.link) data.link = embed.link;
  if (embed.kind === "video" && embed.thumbnail) {
    data.thumbName = embed.thumbnail.name;
    data.thumbIdentifier = embed.thumbnail.identifier;
  }
  if (embed.kind === "file") {
    if (embed.filename) data.filename = embed.filename;
    if (embed.mimetype) data.mimetype = embed.mimetype;
    if (embed.size) data.size = String(embed.size);
  }
  return data;
}

export function isPdf(embed: FileEmbed): boolean {
  return embed.mimetype === "application/pdf" || /\.pdf$/i.test(embed.filename ?? "");
}

/** What the embed says as text: in the editor, in the plain description, and in apps that don't know embeds. */
export function embedLabel(embed: QortalEmbed): string {
  if (embed.kind === "video") return `Video: ${embed.title || embed.identifier}`;
  const what = isPdf(embed) ? "PDF" : "File";
  return `${what}: ${embed.title || embed.filename || embed.identifier}`;
}

/** Where the embed opens: its own link, else the resource's. */
export function embedLink(embed: QortalEmbed): string {
  return embed.link ?? resourceLink(embed.kind === "video" ? "VIDEO" : "FILE", embed.name, embed.identifier);
}

/**
 * A description's videos and files apart from its text, for the product
 * form (Simon, 2026-10-25: added as buttons under the pictures, each with an
 * X, not in the text): the embed blocks at its top level, and the rest.
 */
export function splitDescription(html: string): { embeds: QortalEmbed[]; text: string } {
  if (!html || !html.includes(EMBED_CLASS)) return { embeds: [], text: html };
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const embeds: QortalEmbed[] = [];
  for (const node of Array.from(doc.body.children)) {
    if (!node.classList.contains(EMBED_CLASS)) continue;
    const embed = embedFromData({ ...(node as HTMLElement).dataset });
    if (embed) embeds.push(embed);
    node.remove();
  }
  return { embeds, text: doc.body.innerHTML };
}

/** An embed as the block the description stores (as the editor wrote it): its data, and its label as text. */
export function embedHtml(embed: QortalEmbed): string {
  const node = document.createElement("div");
  node.className = EMBED_CLASS;
  for (const [key, value] of Object.entries(embedData(embed))) node.dataset[key] = value;
  node.textContent = embedLabel(embed);
  return node.outerHTML;
}

/** The description stored: its videos and files first (the product page shows them under the pictures), then its text. */
export function joinDescription(embeds: readonly QortalEmbed[], text: string): string {
  return embeds.map(embedHtml).join("") + text;
}
