import { createElement, type ReactElement } from "react";
import type { SvgIconComponent } from "@mui/icons-material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import AudiotrackOutlined from "@mui/icons-material/AudiotrackOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FolderZipOutlined from "@mui/icons-material/FolderZipOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";

export type FileKind = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "document" | "other";

const MIME_EXACT: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/json": "text",
  "application/xml": "text",
  "application/javascript": "text",
  "application/x-javascript": "text",
  "application/typescript": "text",
  "application/x-sh": "text",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-7z-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/vnd.rar": "archive",
  "application/gzip": "archive",
  "application/x-gzip": "archive",
  "application/x-tar": "archive",
  "application/x-bzip2": "archive",
  "application/x-xz": "archive",
  "application/msword": "document",
  "application/rtf": "document",
  "application/epub+zip": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.ms-powerpoint": "document",
};

const EXTENSIONS: Record<FileKind, string[]> = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif", "heic", "heif", "tif", "tiff", "ico"],
  video: ["mp4", "mkv", "webm", "mov", "avi", "m4v", "wmv", "flv", "mpg", "mpeg", "3gp", "ogv"],
  audio: ["mp3", "wav", "ogg", "oga", "flac", "m4a", "m4b", "aac", "opus", "weba", "wma", "aiff", "mid", "midi"],
  pdf: ["pdf"],
  text: ["txt", "md", "markdown", "csv", "tsv", "json", "xml", "yaml", "yml", "log", "ini", "cfg", "toml", "html", "htm", "css", "js", "mjs", "ts", "tsx", "jsx", "py", "sh", "java", "c", "h", "cpp", "rs", "go", "sql", "srt", "vtt", "md5", "sha1", "sha256", "sha512"],
  archive: ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "iso", "dmg"],
  document: ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "epub", "cbz", "cbr", "pages", "numbers", "key"],
  other: [],
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Classifies a file by MIME type first, then by its extension (browsers often
 * hand over an empty type, and QDN file references may have none).
 */
export function fileKind(mimetype?: string | null, filename?: string | null): FileKind {
  const mime = (mimetype || "").toLowerCase().split(";")[0].trim();
  if (mime) {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("text/")) return "text";
    const exact = MIME_EXACT[mime];
    if (exact) return exact;
    if (mime.startsWith("application/vnd.openxmlformats-officedocument.")) return "document";
    if (mime.startsWith("application/vnd.oasis.opendocument.")) return "document";
    if (mime.startsWith("application/vnd.ms-")) return "document";
  }
  const ext = extensionOf(filename || "");
  if (ext) {
    for (const kind of Object.keys(EXTENSIONS) as FileKind[]) {
      if (EXTENSIONS[kind].includes(ext)) return kind;
    }
  }
  return "other";
}

const ICONS: Record<FileKind, SvgIconComponent> = {
  image: ImageOutlined,
  video: VideocamOutlined,
  audio: AudiotrackOutlined,
  pdf: PictureAsPdfOutlined,
  text: ArticleOutlined,
  archive: FolderZipOutlined,
  document: DescriptionOutlined,
  other: InsertDriveFileOutlined,
};

/** The MUI icon component for a kind; render it as `<Icon />`. */
export function fileKindIcon(kind: FileKind): SvgIconComponent {
  return ICONS[kind] ?? InsertDriveFileOutlined;
}

/** The kind's icon as an element, for components that pick the icon at render time. */
export function fileKindIconElement(kind: FileKind, props?: SvgIconProps): ReactElement {
  return createElement(fileKindIcon(kind), props);
}

/** A short label for a kind, for tooltips and accessible names. */
export function fileKindLabel(kind: FileKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "pdf":
      return "PDF";
    case "text":
      return "Text";
    case "archive":
      return "Archive";
    case "document":
      return "Document";
    default:
      return "File";
  }
}
