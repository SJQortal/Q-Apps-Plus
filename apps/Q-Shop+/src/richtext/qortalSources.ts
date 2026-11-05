/**
 * Videos and files from other Q-Apps, and the two the product editor
 * publishes (Simon, 2026-10-22):
 *
 * - A Q-Tube link names the video's JSON document (DOCUMENT `qtube_vid_…`),
 *   whose `videoReference` names the VIDEO resource that plays, and whose
 *   `videoImage` is the video's thumbnail (a data URL: Q-Tube publishes no
 *   THUMBNAIL), shown until it plays unless the seller picks their own.
 * - A Q-Share link names a share's JSON document (`qshare_file_…_metadata`),
 *   whose `files` name its FILE resources (docs/apps/Q-Share+.md → Data
 *   contract).
 * - A video uploaded in the editor is published as a VIDEO resource of the
 *   seller's, `q-store-video-<uid>`, seen in Q-Shop+ only.
 * - A PDF uploaded in the editor is published as a Q-Share share, exactly as
 *   Q-Share publishes one (a FILE `qshare_file_<slug>_<uid>` and its JSON
 *   document, category Document → PDF), so it is in Q-Share too and the
 *   description links to it there.
 *
 * Another name can publish under any identifier, so only what the link's
 * own name published is used (docs/QORTAL.md, pitfall 15).
 */
import ShortUniqueId from "short-unique-id";
import { fetchQdnJson } from "../qdn/search";
import { jsonToBase64 } from "../qdn/payloads";
import { THUMB_BASE, VIDEO_BASE } from "../qdn/identifiers";
import { isSafeIdentifier, parseQortalLink, qshareLink, qtubeLink, type FileEmbed, type VideoEmbed } from "./embeds";

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, max);
  return clean || undefined;
}

/** The video a Q-Tube link plays. Rejects when the document can't be read or names no video. */
export async function videoFromQtube(name: string, identifier: string): Promise<VideoEmbed> {
  const doc = (await fetchQdnJson("DOCUMENT", name, identifier)) as { title?: unknown; videoReference?: { service?: unknown; identifier?: unknown; name?: unknown } } | null;
  const ref = doc?.videoReference;
  if (!ref || ref.service !== "VIDEO" || !isSafeIdentifier(ref.identifier) || (ref.name !== undefined && ref.name !== name)) {
    throw new Error("That Q-Tube page names no video.");
  }
  const title = text(doc?.title, 180);
  return { kind: "video", name, identifier: ref.identifier, ...(title && { title }), link: qtubeLink(name, identifier) };
}

/** Q-Tube's VIDEO ids; the video's document is the same id with `_metadata`. */
export const QTUBE_VIDEO_PREFIX = "qtube_vid_";

/**
 * The Q-Tube document that holds a video's thumbnail (Simon, 2026-10-27: "if
 * the Q-Tube video is added it should add the Q-Tube video thumbnail as
 * well"): the one its Q-Tube link names, or, for a video Q-Tube published
 * (from a `qortal://VIDEO/…` link or the seller's videos), its id with
 * `_metadata`. Null for any other video.
 */
export function qtubeDocumentOf(embed: Pick<VideoEmbed, "name" | "identifier" | "link">): { name: string; identifier: string } | null {
  const target = parseQortalLink(embed.link);
  if (target?.kind === "qtube" && target.name === embed.name) return { name: target.name, identifier: target.identifier };
  if (embed.identifier.startsWith(QTUBE_VIDEO_PREFIX)) return { name: embed.name, identifier: `${embed.identifier}_metadata` };
  return null;
}

/** A Q-Tube document's thumbnail, when the document is this video's and the picture is a plain image. */
export function qtubeImageOf(doc: unknown, embed: Pick<VideoEmbed, "name" | "identifier">): string | null {
  if (!doc || typeof doc !== "object") return null;
  const { videoReference: ref, videoImage } = doc as { videoReference?: { service?: unknown; identifier?: unknown; name?: unknown }; videoImage?: unknown };
  if (!ref || ref.service !== "VIDEO" || ref.identifier !== embed.identifier || (ref.name !== undefined && ref.name !== embed.name)) return null;
  return typeof videoImage === "string" && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(videoImage) ? videoImage : null;
}

/** A Q-Tube video's thumbnail (read once per session), or null when it has none. Rejects when the document can't be read. */
export async function qtubeThumbnail(embed: Pick<VideoEmbed, "name" | "identifier" | "link">): Promise<string | null> {
  const doc = qtubeDocumentOf(embed);
  if (!doc) return null;
  return qtubeImageOf(await fetchQdnJson("DOCUMENT", doc.name, doc.identifier), embed);
}

/** The files of a Q-Share share, with the share's title. Rejects when it can't be read. */
export async function filesFromQshare(name: string, identifier: string): Promise<{ title?: string; files: FileEmbed[] }> {
  const doc = (await fetchQdnJson("DOCUMENT", name, identifier)) as { title?: unknown; files?: unknown } | null;
  const title = text(doc?.title, 180);
  const files: FileEmbed[] = [];
  for (const entry of Array.isArray(doc?.files) ? doc.files : []) {
    const file = entry as { identifier?: unknown; name?: unknown; service?: unknown; filename?: unknown; mimetype?: unknown; size?: unknown };
    if (file?.service !== "FILE" || file.name !== name || !isSafeIdentifier(file.identifier)) continue;
    const filename = text(file.filename, 180);
    const mimetype = typeof file.mimetype === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(file.mimetype) ? file.mimetype : undefined;
    const size = typeof file.size === "number" && Number.isSafeInteger(file.size) && file.size > 0 ? file.size : undefined;
    files.push({
      kind: "file",
      name,
      identifier: file.identifier,
      ...(title && { title }),
      ...(filename && { filename }),
      ...(mimetype && { mimetype }),
      ...(size && { size }),
      link: qshareLink(name, identifier),
    });
  }
  return { ...(title && { title }), files };
}

// ---------------------------------------------------------------- publishing

const uid6 = new ShortUniqueId({ length: 6 });
const uid10 = new ShortUniqueId({ length: 10 });

/** The biggest file the editor publishes (Hub takes up to 30 minutes for a publish). */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** Characters Q-Share strips from file names on publish (its `titleFormatterOnSave`). */
const FILENAME_STRIP = /[\r\n/<>:"'\\*|?]+/g;

/**
 * A video's thumbnail: a THUMBNAIL of the seller's, `q-store-thumb-<uid>`,
 * the picture as a WebP (components/common/ImageUploader.tsx compressImage).
 */
export function buildThumbnailPublish(args: { name: string; dataUrl: string; title?: string; uid?: () => string }) {
  const identifier = `${THUMB_BASE}-${(args.uid ?? (() => uid10()))()}`;
  return {
    identifier,
    resource: {
      action: "PUBLISH_QDN_RESOURCE" as const,
      name: args.name,
      service: "THUMBNAIL",
      identifier,
      data64: args.dataUrl.replace(/^data:[^,]*,/, ""),
      filename: "thumbnail.webp",
      title: `${args.title?.trim() || "Video"} (thumbnail)`.slice(0, 50),
      description: "A product video's thumbnail on Q-Shop",
    },
    thumbnail: { name: args.name, identifier },
  };
}

/** An uploaded video, and its thumbnail in the same publish when the seller picked one. */
export function buildVideoPublish(args: { name: string; file: File; title: string; shopTitle?: string; thumbnail?: string | null; uid?: () => string }) {
  const identifier = `${VIDEO_BASE}-${(args.uid ?? (() => uid10()))()}`;
  const title = args.title.trim() || args.file.name;
  const video = {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name: args.name,
    service: "VIDEO",
    identifier,
    file: args.file,
    filename: args.file.name.replace(FILENAME_STRIP, "") || "video",
    title: title.slice(0, 50),
    description: (args.shopTitle ? `A product video from ${args.shopTitle} on Q-Shop` : "A product video on Q-Shop").slice(0, 240),
  };
  const embed = { kind: "video" as const, name: args.name, identifier, title: title.slice(0, 180) };
  if (!args.thumbnail) return { identifier, request: video as Record<string, unknown>, embed: embed as VideoEmbed };
  const thumb = buildThumbnailPublish({ name: args.name, dataUrl: args.thumbnail, title, uid: args.uid });
  return {
    identifier,
    request: { action: "PUBLISH_MULTIPLE_QDN_RESOURCES" as const, resources: [video, thumb.resource] } as Record<string, unknown>,
    embed: { ...embed, thumbnail: thumb.thumbnail } as VideoEmbed,
  };
}

/** Q-Share's identifier slug from a title (its `shareSlug`): letters, digits and dashes, lower case, at most 30. */
export function shareSlug(title: string): string {
  const slug = title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .toLowerCase()
    .slice(0, 30);
  return /[a-z0-9]/.test(slug) ? slug : "share";
}

/** Q-Share's categories for a PDF: Document (6) → PDF (601). */
export const QSHARE_PDF_CATEGORY = { category: "6", subcategory: "601", subcategory2: "" } as const;
const QSHARE_FILE_BASE = "qshare_file_";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * A PDF as a Q-Share share, in Q-Share's own shapes (Q-Share+
 * utils/publishPayload.ts buildSharePublish): the FILE first, then the
 * share's JSON document.
 */
export function buildPdfSharePublish(args: { name: string; file: File; title: string; shopTitle?: string; uid?: () => string }) {
  const uid = args.uid ?? (() => uid6());
  const title = (args.title.trim() || args.file.name).slice(0, 180);
  const slug = shareSlug(title);
  const fileId = `${QSHARE_FILE_BASE}${slug}_${uid()}`;
  const metaUid = uid();
  const metadataId = `${QSHARE_FILE_BASE}${slug}_${metaUid}_metadata`;
  const about = args.shopTitle ? `From ${args.shopTitle} on Q-Shop.` : "From a shop on Q-Shop.";
  const description = `**cat:${QSHARE_PDF_CATEGORY.category};sub:${QSHARE_PDF_CATEGORY.subcategory}**` + about.slice(0, 150);
  const qdnTitle = title.slice(0, 50);
  const fileRef = { filename: args.file.name, identifier: fileId, name: args.name, service: "FILE" as const, mimetype: args.file.type || "application/pdf", size: args.file.size };
  const share = {
    title,
    version: 1,
    fullDescription: about,
    htmlDescription: `<p>${escapeHtml(about)}</p>`,
    commentsId: `${QSHARE_FILE_BASE}_cm_${metaUid}`,
    ...QSHARE_PDF_CATEGORY,
    files: [fileRef],
  };
  return {
    metadataId,
    share,
    request: {
      action: "PUBLISH_MULTIPLE_QDN_RESOURCES" as const,
      resources: [
        {
          action: "PUBLISH_QDN_RESOURCE",
          name: args.name,
          service: "FILE",
          file: args.file,
          title: qdnTitle,
          description,
          identifier: fileId,
          filename: args.file.name.replace(FILENAME_STRIP, ""),
          tag1: QSHARE_FILE_BASE,
        },
        {
          action: "PUBLISH_QDN_RESOURCE",
          name: args.name,
          service: "DOCUMENT",
          identifier: metadataId,
          data64: jsonToBase64(share),
          title: qdnTitle,
          description,
          tag1: QSHARE_FILE_BASE,
          filename: "video_metadata.json",
        },
      ],
    },
    embed: {
      kind: "file" as const,
      name: args.name,
      identifier: fileId,
      title,
      filename: fileRef.filename,
      mimetype: fileRef.mimetype,
      size: fileRef.size,
      link: qshareLink(args.name, metadataId),
    },
  };
}
