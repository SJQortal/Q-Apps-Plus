import { afterEach, describe, expect, it, vi } from "vitest";
import { base64ToJson } from "../qdn/payloads";
import { resetQdnCaches } from "../qdn/search";
import { buildPdfSharePublish, buildVideoPublish, filesFromQshare, shareSlug, videoFromQtube } from "./qortalSources";

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

function serve(docs: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const body = docs[String(input)];
      return body === undefined
        ? { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) }
        : { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
    })
  );
}

describe("a PDF published from the editor", () => {
  it("is a Q-Share share in Q-Share's own shapes: the FILE, then its JSON document", () => {
    const file = new File(["%PDF-1.4"], "Care guide: ghee.pdf", { type: "application/pdf" });
    const ids = ["FILE01", "META01"];
    const built = buildPdfSharePublish({ name: "Seller Name", file, title: "Ghee care guide", shopTitle: "Biohackers Corner", uid: () => ids.shift()! });
    expect(built.metadataId).toBe("qshare_file_ghee-care-guide_META01_metadata");
    const [fileRes, docRes] = built.request.resources;
    expect(built.request.action).toBe("PUBLISH_MULTIPLE_QDN_RESOURCES");
    expect(fileRes).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Seller Name",
      service: "FILE",
      file,
      title: "Ghee care guide",
      description: "**cat:6;sub:601**From Biohackers Corner on Q-Shop.",
      identifier: "qshare_file_ghee-care-guide_FILE01",
      filename: "Care guide ghee.pdf",
      tag1: "qshare_file_",
    });
    expect({ ...docRes, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Seller Name",
      service: "DOCUMENT",
      identifier: "qshare_file_ghee-care-guide_META01_metadata",
      data64: undefined,
      title: "Ghee care guide",
      description: "**cat:6;sub:601**From Biohackers Corner on Q-Shop.",
      tag1: "qshare_file_",
      filename: "video_metadata.json",
    });
    expect(base64ToJson((docRes as { data64: string }).data64)).toEqual({
      title: "Ghee care guide",
      version: 1,
      fullDescription: "From Biohackers Corner on Q-Shop.",
      htmlDescription: "<p>From Biohackers Corner on Q-Shop.</p>",
      commentsId: "qshare_file__cm_META01",
      category: "6",
      subcategory: "601",
      subcategory2: "",
      files: [{ filename: "Care guide: ghee.pdf", identifier: "qshare_file_ghee-care-guide_FILE01", name: "Seller Name", service: "FILE", mimetype: "application/pdf", size: 8 }],
    });
    expect(built.embed).toEqual({
      kind: "file",
      name: "Seller Name",
      identifier: "qshare_file_ghee-care-guide_FILE01",
      title: "Ghee care guide",
      filename: "Care guide: ghee.pdf",
      mimetype: "application/pdf",
      size: 8,
      link: "qortal://APP/Q-Share/share/Seller%20Name/qshare_file_ghee-care-guide_META01_metadata",
    });
    expect(shareSlug("!!! ???")).toBe("share");
  });
});

describe("a video published from the editor", () => {
  it("is a VIDEO resource of the seller's, q-store-video-<uid>", () => {
    const file = new File(["v"], "ghee.mp4", { type: "video/mp4" });
    const built = buildVideoPublish({ name: "Seller Name", file, title: "Making ghee", shopTitle: "Biohackers Corner", uid: () => "AbCdEf1234" });
    expect(built.request).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Seller Name",
      service: "VIDEO",
      identifier: "q-store-video-AbCdEf1234",
      file,
      filename: "ghee.mp4",
      title: "Making ghee",
      description: "A product video from Biohackers Corner on Q-Shop",
    });
    expect(built.embed).toEqual({ kind: "video", name: "Seller Name", identifier: "q-store-video-AbCdEf1234", title: "Making ghee" });
  });
});

describe("videos and files from other apps", () => {
  it("reads a Q-Tube page's video, only one its publisher names", async () => {
    serve({
      "/arbitrary/DOCUMENT/Bob/qtube_vid_a": { title: "Bob's video", videoReference: { name: "Bob", identifier: "qtube_vid_a_v", service: "VIDEO" } },
      "/arbitrary/DOCUMENT/Bob/qtube_vid_b": { title: "Not Bob's", videoReference: { name: "Eve", identifier: "x", service: "VIDEO" } },
    });
    expect(await videoFromQtube("Bob", "qtube_vid_a")).toEqual({ kind: "video", name: "Bob", identifier: "qtube_vid_a_v", title: "Bob's video", link: "qortal://APP/Q-Tube/video/Bob/qtube_vid_a" });
    await expect(videoFromQtube("Bob", "qtube_vid_b")).rejects.toThrow();
  });

  it("reads a Q-Share share's files, only those its publisher published", async () => {
    serve({
      "/arbitrary/DOCUMENT/Bob/share_metadata": {
        title: "Manuals",
        files: [
          { filename: "a.pdf", identifier: "qshare_file_a", name: "Bob", service: "FILE", mimetype: "application/pdf", size: 10 },
          { filename: "b.pdf", identifier: "qshare_file_b", name: "Eve", service: "FILE", mimetype: "application/pdf", size: 10 },
          { filename: "c.pdf", identifier: "bad id", name: "Bob", service: "FILE" },
        ],
      },
    });
    const share = await filesFromQshare("Bob", "share_metadata");
    expect(share.title).toBe("Manuals");
    expect(share.files).toEqual([
      { kind: "file", name: "Bob", identifier: "qshare_file_a", title: "Manuals", filename: "a.pdf", mimetype: "application/pdf", size: 10, link: "qortal://APP/Q-Share/share/Bob/share_metadata" },
    ]);
  });
});
