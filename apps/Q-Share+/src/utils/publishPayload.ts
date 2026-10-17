/**
 * Builds the QDN resources for a share, exactly the way the original Q-Share
 * does (docs/apps/Q-Share+.md → Data contract). Both the Share and the Update
 * dialog call this, so the stored format has one source of truth and the
 * tests in publishPayload.test.ts pin it:
 *
 * - one FILE resource per new file, identifier `qshare_file_<slug>_<uid>`;
 * - one DOCUMENT with the share JSON, identifier `<same shape>_metadata`
 *   (or the existing identifier when editing), filename `video_metadata.json`
 *   (carried over from Q-Tube; it is stored data, so it stays);
 * - QDN `title` ≤ 50 chars, `description` = `**cat:N;sub:N**` + the first 150
 *   chars of the plain-text description, `tag1: qshare_file_`.
 *
 * Since 1.0.1 a share may have a thumbnail (additive): a THUMBNAIL
 * `qshare_thumb_<slug>_<uid>` under the same name, published before the
 * DOCUMENT, whose JSON then names it in `thumbnail`. The original app never
 * reads it (it searches `service=DOCUMENT`), and a share without one is
 * stored exactly as before.
 */
import ShortUniqueId from "short-unique-id";
import { QSHARE_FILE_BASE } from "../constants/Identifiers";
import { titleFormatterOnSave } from "../constants/Misc";
import { extractTextFromHTML } from "../components/common/TextEditor/utils";
import { normalizeQuillHtml } from "./quillHtml";
import { objectToBase64 } from "./toBase64";

/** A file already on QDN, as stored in the share JSON `files` array. */
export interface FileRef {
  filename: string;
  identifier: string;
  name: string;
  service: "FILE";
  mimetype: string;
  size: number;
}

export type ShareFileInput = { file: File } | { existing: FileRef };

export const THUMBNAIL_BASE = "qshare_thumb_";
export const THUMBNAIL_FILENAME = "thumbnail.webp";

/** A share's thumbnail, as its JSON names it. */
export interface ShareThumbnail {
  service: "THUMBNAIL";
  name: string;
  identifier: string;
}

/** A new image to publish as the thumbnail, or the one the share already has. */
export type ThumbnailInput = { file: File } | { existing: ShareThumbnail };

/** The thumbnail a share's JSON names, or null when it has none (or the field isn't one). */
export function shareThumbnail(body: unknown): ShareThumbnail | null {
  const raw = (body as { thumbnail?: unknown } | null)?.thumbnail as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return null;
  if (raw.service !== "THUMBNAIL" || typeof raw.name !== "string" || !raw.name) return null;
  if (typeof raw.identifier !== "string" || !raw.identifier || raw.identifier.length > 64) return null;
  return { service: "THUMBNAIL", name: raw.name, identifier: raw.identifier };
}

/** What CategoryList.categoriesToObject() returns; empty strings mean "not set". */
export interface CategoriesObject {
  category?: string;
  subcategory?: string;
  subcategory2?: string;
}

export interface ShareMetadata extends CategoriesObject {
  title: string;
  version: number;
  fullDescription: string;
  htmlDescription: string;
  commentsId: string;
  files: FileRef[];
  thumbnail?: ShareThumbnail;
}

interface PublishResourceBase {
  action: "PUBLISH_QDN_RESOURCE";
  name: string;
  identifier: string;
  title: string;
  description: string;
  tag1: string;
  filename: string;
}

export interface FilePublishResource extends PublishResourceBase {
  service: "FILE";
  file: File;
}

export interface DocumentPublishResource extends PublishResourceBase {
  service: "DOCUMENT";
  data64: string;
}

export interface ThumbnailPublishResource extends PublishResourceBase {
  service: "THUMBNAIL";
  file: File;
}

export type PublishResource = FilePublishResource | ThumbnailPublishResource | DocumentPublishResource;

export interface MultiplePublishRequest {
  action: "PUBLISH_MULTIPLE_QDN_RESOURCES";
  resources: PublishResource[];
}

export interface BuildSharePublishArgs {
  /** The Qortal name that publishes. */
  name: string;
  title: string;
  /** Raw editor HTML; normalised to the Quill 1 shape before it is stored. */
  descriptionHtml: string;
  /** `cat:N;sub:N;sub2:N` from CategoryList.getCategoriesFetchString(). */
  categoryFetchString: string;
  /** `{ category, subcategory, subcategory2 }` from CategoryList.categoriesToObject(). */
  categoriesObject: CategoriesObject;
  files: ShareFileInput[];
  /** The share's thumbnail: a new image to publish, the one it has, or none. */
  thumbnail?: ThumbnailInput | null;
  /** Set when updating an existing share: its identifier, version and comments id are kept. */
  edit?: { identifier: string; version: number; commentsId: string };
  /** Id generator, 6 alphanumeric chars by default; tests inject a fixed one. */
  uid?: () => string;
}

export interface SharePublish {
  /** FILE resources first, in the order given, then a new THUMBNAIL, then the DOCUMENT. */
  resources: PublishResource[];
  fileObject: ShareMetadata;
  metadataIdentifier: string;
  fileReferences: FileRef[];
}

export const TITLE_MAX_LENGTH = 180;
export const SLUG_MAX_LENGTH = 30;
export const QDN_TITLE_MAX_LENGTH = 50;
export const QDN_DESCRIPTION_TEXT_LENGTH = 150;
export const METADATA_SUFFIX = "_metadata";
export const METADATA_FILENAME = "video_metadata.json";

const defaultUid = new ShortUniqueId();

/**
 * The identifier slug the original app derives from the title: letters,
 * digits, spaces and dashes only, spaces to dashes, dashes collapsed, lower
 * case, cut to 30 chars. A title made only of symbols gives "share" so the
 * identifier still reads.
 */
export function shareSlug(title: string): string {
  const slug = title
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .toLowerCase()
    .slice(0, SLUG_MAX_LENGTH);
  // "!!! ???" leaves only "-"; anything without a letter or digit is unreadable.
  return /[a-z0-9]/.test(slug) ? slug : "share";
}

/** The QDN metadata description: the category string plus a text excerpt. */
export function qdnDescription(categoryFetchString: string, fullDescription: string): string {
  return `**${categoryFetchString}**` + fullDescription.slice(0, QDN_DESCRIPTION_TEXT_LENGTH);
}

export async function buildSharePublish({
  name,
  title,
  descriptionHtml,
  categoryFetchString,
  categoriesObject,
  files,
  thumbnail,
  edit,
  uid = () => defaultUid.randomUUID(),
}: BuildSharePublishArgs): Promise<SharePublish> {
  const htmlDescription = normalizeQuillHtml(descriptionHtml);
  const fullDescription = extractTextFromHTML(htmlDescription);
  const slug = shareSlug(title);
  const qdnTitle = title.slice(0, QDN_TITLE_MAX_LENGTH);
  const description = qdnDescription(categoryFetchString, fullDescription);

  const resources: PublishResource[] = [];
  const fileReferences: FileRef[] = [];
  // A share holds up to 300 files: no two may get the same identifier.
  const used = new Set(files.flatMap((input) => ("existing" in input ? [input.existing.identifier] : [])));
  const fileIdentifier = () => {
    for (let tries = 0; tries < 20; tries++) {
      const identifier = `${QSHARE_FILE_BASE}${slug}_${uid()}`;
      if (!used.has(identifier)) {
        used.add(identifier);
        return identifier;
      }
    }
    throw new Error("Could not make a unique identifier for every file");
  };

  for (const input of files) {
    if ("existing" in input) {
      fileReferences.push(input.existing);
      continue;
    }
    const { file } = input;
    const identifier = fileIdentifier();
    resources.push({
      action: "PUBLISH_QDN_RESOURCE",
      name,
      service: "FILE",
      file,
      title: qdnTitle,
      description,
      identifier,
      filename: file.name.replaceAll(titleFormatterOnSave, ""),
      tag1: QSHARE_FILE_BASE,
    });
    fileReferences.push({
      filename: file.name,
      identifier,
      name,
      service: "FILE",
      mimetype: file.type,
      size: file.size,
    });
  }

  let metadataIdentifier: string;
  let version: number;
  let commentsId: string;
  if (edit) {
    metadataIdentifier = edit.identifier;
    version = edit.version;
    commentsId = edit.commentsId;
  } else {
    const idMeta = uid();
    metadataIdentifier = `${QSHARE_FILE_BASE}${slug}_${idMeta}${METADATA_SUFFIX}`;
    version = 1;
    commentsId = `${QSHARE_FILE_BASE}_cm_${idMeta}`;
  }

  let thumbnailRef: ShareThumbnail | undefined;
  if (thumbnail && "existing" in thumbnail) {
    thumbnailRef = thumbnail.existing;
  } else if (thumbnail && "file" in thumbnail) {
    const identifier = `${THUMBNAIL_BASE}${slug}_${uid()}`;
    thumbnailRef = { service: "THUMBNAIL", name, identifier };
    resources.push({
      action: "PUBLISH_QDN_RESOURCE",
      name,
      service: "THUMBNAIL",
      file: thumbnail.file,
      title: qdnTitle,
      description,
      identifier,
      filename: thumbnail.file.name || THUMBNAIL_FILENAME,
      tag1: THUMBNAIL_BASE,
    });
  }

  const fileObject: ShareMetadata = {
    title,
    version,
    fullDescription,
    htmlDescription,
    commentsId,
    ...categoriesObject,
    files: fileReferences,
    ...(thumbnailRef ? { thumbnail: thumbnailRef } : {}),
  };

  resources.push({
    action: "PUBLISH_QDN_RESOURCE",
    name,
    service: "DOCUMENT",
    identifier: metadataIdentifier,
    data64: await objectToBase64(fileObject),
    title: qdnTitle,
    description,
    tag1: QSHARE_FILE_BASE,
    filename: METADATA_FILENAME,
  });

  return { resources, fileObject, metadataIdentifier, fileReferences };
}

/** The request MultiplePublish sends through qortalRequestWithTimeout. */
export function toMultiplePublish(resources: PublishResource[]): MultiplePublishRequest {
  return { action: "PUBLISH_MULTIPLE_QDN_RESOURCES", resources };
}
