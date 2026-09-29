import { describe, expect, it } from "vitest";
import ArticleOutlined from "@mui/icons-material/ArticleOutlined";
import AudiotrackOutlined from "@mui/icons-material/AudiotrackOutlined";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import FolderZipOutlined from "@mui/icons-material/FolderZipOutlined";
import ImageOutlined from "@mui/icons-material/ImageOutlined";
import InsertDriveFileOutlined from "@mui/icons-material/InsertDriveFileOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import VideocamOutlined from "@mui/icons-material/VideocamOutlined";
import { fileKind, fileKindIcon, fileKindLabel } from "./fileKind";

describe("fileKind", () => {
  it("classifies by MIME type", () => {
    expect(fileKind("image/png", "x")).toBe("image");
    expect(fileKind("video/mp4", "x")).toBe("video");
    expect(fileKind("audio/mpeg", "x")).toBe("audio");
    expect(fileKind("application/pdf", "x")).toBe("pdf");
    expect(fileKind("text/plain; charset=utf-8", "x")).toBe("text");
    expect(fileKind("application/json", "x")).toBe("text");
    expect(fileKind("application/zip", "x")).toBe("archive");
    expect(fileKind("application/x-7z-compressed", "x")).toBe("archive");
    expect(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "x")).toBe("document");
    expect(fileKind("application/vnd.oasis.opendocument.text", "x")).toBe("document");
    expect(fileKind("application/msword", "x")).toBe("document");
  });

  it("falls back to the extension when the type is empty or generic", () => {
    expect(fileKind("", "holiday.JPG")).toBe("image");
    expect(fileKind(undefined, "clip.mkv")).toBe("video");
    expect(fileKind(null, "song.flac")).toBe("audio");
    expect(fileKind("application/octet-stream", "paper.pdf")).toBe("pdf");
    expect(fileKind("", "notes.md")).toBe("text");
    expect(fileKind("", "backup.tar.gz")).toBe("archive");
    expect(fileKind("", "slides.pptx")).toBe("document");
  });

  it("returns 'other' for unknown types, no extension and dotfiles", () => {
    expect(fileKind("application/octet-stream", "firmware.bin")).toBe("other");
    expect(fileKind("", "README")).toBe("other");
    expect(fileKind("", ".env")).toBe("other");
    expect(fileKind("", "")).toBe("other");
    expect(fileKind(undefined, undefined)).toBe("other");
  });

  it("maps every kind to an icon and a label", () => {
    expect(fileKindIcon("image")).toBe(ImageOutlined);
    expect(fileKindIcon("video")).toBe(VideocamOutlined);
    expect(fileKindIcon("audio")).toBe(AudiotrackOutlined);
    expect(fileKindIcon("pdf")).toBe(PictureAsPdfOutlined);
    expect(fileKindIcon("text")).toBe(ArticleOutlined);
    expect(fileKindIcon("archive")).toBe(FolderZipOutlined);
    expect(fileKindIcon("document")).toBe(DescriptionOutlined);
    expect(fileKindIcon("other")).toBe(InsertDriveFileOutlined);
    expect(fileKindLabel("pdf")).toBe("PDF");
    expect(fileKindLabel("other")).toBe("File");
  });
});
