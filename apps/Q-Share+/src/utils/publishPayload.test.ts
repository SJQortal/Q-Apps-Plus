import { describe, expect, it } from "vitest";
import {
  buildSharePublish,
  shareSlug,
  toMultiplePublish,
  type DocumentPublishResource,
  type FilePublishResource,
  type FileRef,
} from "./publishPayload";

/** Deterministic 6-char ids, the length ShortUniqueId uses by default. */
function fixedUid() {
  let n = 0;
  return () => `id${String(++n).padStart(4, "0")}`;
}

function decode(data64: string) {
  return JSON.parse(atob(data64));
}

const pdf = new File(["%PDF-1.4"], "Report: final?.pdf", { type: "application/pdf" });
const png = new File([new Uint8Array([1, 2, 3])], "photo.png", { type: "image/png" });

const base = {
  name: "alice",
  title: "My First Share",
  descriptionHtml: "<p>Hello <strong>world</strong></p>",
  categoryFetchString: "cat:6;sub:601",
  categoriesObject: { category: "6", subcategory: "601", subcategory2: "" },
};

describe("shareSlug", () => {
  it("lower-cases, strips symbols, turns spaces into single dashes and cuts to 30", () => {
    expect(shareSlug("My First Share")).toBe("my-first-share");
    expect(shareSlug("Hello,  World!!  (2024)")).toBe("hello-world-2024");
    expect(shareSlug("a---b - c")).toBe("a-b-c");
    expect(shareSlug("x".repeat(80))).toBe("x".repeat(30));
  });

  it("falls back to 'share' when nothing is left", () => {
    expect(shareSlug("!!! ???")).toBe("share");
    expect(shareSlug("")).toBe("share");
  });
});

describe("buildSharePublish (new share)", () => {
  it("puts the FILE resources first and the DOCUMENT last, with every stored field", async () => {
    const result = await buildSharePublish({ ...base, files: [{ file: pdf }, { file: png }], uid: fixedUid() });

    expect(result.resources.map((r) => r.service)).toEqual(["FILE", "FILE", "DOCUMENT"]);

    const first = result.resources[0] as FilePublishResource;
    expect(first).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "FILE",
      file: pdf,
      title: "My First Share",
      description: "**cat:6;sub:601**Hello world",
      identifier: "qshare_file_my-first-share_id0001",
      filename: "Report final.pdf", // titleFormatterOnSave strips : and ?
      tag1: "qshare_file_",
    });
    expect((result.resources[1] as FilePublishResource).identifier).toBe("qshare_file_my-first-share_id0002");

    const doc = result.resources[2] as DocumentPublishResource;
    expect(doc.action).toBe("PUBLISH_QDN_RESOURCE");
    expect(doc.name).toBe("alice");
    expect(doc.identifier).toBe("qshare_file_my-first-share_id0003_metadata");
    expect(doc.title).toBe("My First Share");
    expect(doc.description).toBe("**cat:6;sub:601**Hello world");
    expect(doc.tag1).toBe("qshare_file_");
    expect(doc.filename).toBe("video_metadata.json");
    expect(result.metadataIdentifier).toBe(doc.identifier);

    expect(decode(doc.data64)).toEqual({
      title: "My First Share",
      version: 1,
      fullDescription: "Hello world",
      htmlDescription: "<p>Hello <strong>world</strong></p>",
      commentsId: "qshare_file__cm_id0003",
      category: "6",
      subcategory: "601",
      subcategory2: "",
      files: [
        {
          filename: "Report: final?.pdf", // the reference keeps the original name
          identifier: "qshare_file_my-first-share_id0001",
          name: "alice",
          service: "FILE",
          mimetype: "application/pdf",
          size: pdf.size,
        },
        {
          filename: "photo.png",
          identifier: "qshare_file_my-first-share_id0002",
          name: "alice",
          service: "FILE",
          mimetype: "image/png",
          size: 3,
        },
      ],
    });
    expect(result.fileObject).toEqual(decode(doc.data64));
    expect(result.fileReferences).toEqual(result.fileObject.files);
  });

  it("cuts the QDN title to 50 chars and the description text to 150, but stores the full title", async () => {
    const title = "T".repeat(120);
    const longText = "w".repeat(400);
    const result = await buildSharePublish({
      ...base,
      title,
      descriptionHtml: `<p>${longText}</p>`,
      files: [{ file: pdf }],
      uid: fixedUid(),
    });
    for (const r of result.resources) {
      expect(r.title).toBe("T".repeat(50));
      expect(r.description).toBe("**cat:6;sub:601**" + "w".repeat(150));
    }
    expect(result.fileObject.title).toBe(title);
  });

  it("keeps every identifier within 64 chars at the worst case (30-char slug + 6-char id)", async () => {
    const uid = () => "AbC123"; // ShortUniqueId's default length
    const result = await buildSharePublish({
      ...base,
      title: "abcdefghij".repeat(6), // 60 chars → slug cut to 30
      files: [{ file: pdf }],
      uid,
    });
    const [file, doc] = result.resources;
    expect(file.identifier).toBe("qshare_file_abcdefghijabcdefghijabcdefghij_AbC123");
    expect(file.identifier.length).toBe(49);
    expect(doc.identifier).toBe("qshare_file_abcdefghijabcdefghijabcdefghij_AbC123_metadata");
    expect(doc.identifier.length).toBe(58);
    expect(doc.identifier.length).toBeLessThanOrEqual(64);
  });

  it("uses 'share' in identifiers when the title is only symbols", async () => {
    const result = await buildSharePublish({ ...base, title: "???", files: [{ file: pdf }], uid: fixedUid() });
    expect(result.resources[0].identifier).toBe("qshare_file_share_id0001");
    expect(result.metadataIdentifier).toBe("qshare_file_share_id0002_metadata");
  });

  it("stores Quill 2 editor markup in the Quill 1 shape", async () => {
    const result = await buildSharePublish({
      ...base,
      descriptionHtml: '<ol><li data-list="bullet">x</li></ol><p>a&nbsp;b</p>',
      files: [{ file: pdf }],
      uid: fixedUid(),
    });
    expect(result.fileObject.htmlDescription).toBe("<ul><li>x</li></ul><p>a b</p>");
    expect(result.fileObject.fullDescription).toBe("x a b");
  });

  it("wraps the resources in a PUBLISH_MULTIPLE_QDN_RESOURCES request", async () => {
    const result = await buildSharePublish({ ...base, files: [{ file: pdf }], uid: fixedUid() });
    const request = toMultiplePublish(result.resources);
    expect(request.action).toBe("PUBLISH_MULTIPLE_QDN_RESOURCES");
    expect(request.resources).toBe(result.resources);
    expect(request.resources.length).toBe(2);
  });
});

describe("buildSharePublish (update)", () => {
  const existing: FileRef = {
    filename: "old.zip",
    identifier: "qshare_file_my-first-share_zzz999",
    name: "alice",
    service: "FILE",
    mimetype: "application/zip",
    size: 12345,
  };
  const edit = { identifier: "qshare_file_my-first-share_meta01_metadata", version: 1, commentsId: "qshare_file__cm_meta01" };

  it("passes existing files through unchanged and keeps the identifier, version and comments id", async () => {
    const result = await buildSharePublish({
      ...base,
      title: "Renamed share",
      files: [{ existing }, { file: png }],
      edit,
      uid: fixedUid(),
    });

    // Only the new file is published; the existing one is referenced as is.
    expect(result.resources.map((r) => r.service)).toEqual(["FILE", "DOCUMENT"]);
    expect(result.resources[0].identifier).toBe("qshare_file_renamed-share_id0001");
    expect(result.resources[1].identifier).toBe(edit.identifier);
    expect(result.metadataIdentifier).toBe(edit.identifier);

    const stored = decode((result.resources[1] as DocumentPublishResource).data64);
    expect(stored.version).toBe(1);
    expect(stored.commentsId).toBe(edit.commentsId);
    expect(stored.files[0]).toEqual(existing);
    expect(stored.files[1].identifier).toBe("qshare_file_renamed-share_id0001");
    expect(stored.files.length).toBe(2);
  });

  it("publishes only the DOCUMENT when no file was added", async () => {
    const result = await buildSharePublish({ ...base, files: [{ existing }], edit, uid: fixedUid() });
    expect(result.resources.length).toBe(1);
    expect(result.resources[0].service).toBe("DOCUMENT");
    expect(result.fileReferences).toEqual([existing]);
  });
});
