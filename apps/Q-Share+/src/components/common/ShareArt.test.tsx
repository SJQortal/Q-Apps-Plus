import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { mockAllIsIntersecting } from "react-intersection-observer/test-utils";
import { fetchCallsMatching, mockFetch } from "../../test/setup";
import { resetSettingsCache, writeSettings } from "../../utils/settings";
import { ShareCardArt, ShareRowArt, cardImage } from "./ShareArt";

const icon = <span data-testid="icon" />;
const img = (container: HTMLElement) => container.querySelector("img")?.getAttribute("src") ?? null;
const photo = (identifier: string, size = 300_000) => ({
  filename: "beach.jpg",
  identifier,
  name: "dj b",
  service: "FILE",
  mimetype: "image/jpeg",
  size,
});

beforeEach(() => {
  localStorage.clear();
  resetSettingsCache();
});

describe("share art", () => {
  it("shows the share's thumbnail on cards and rows, over the icon", () => {
    const share = { files: [], thumbnail: { service: "THUMBNAIL", name: "dj b", identifier: "qshare_thumb_x_abc123" } };
    const card = render(<ShareCardArt share={share} fallback={icon} />);
    expect(img(card.container)).toBe("/arbitrary/THUMBNAIL/dj%20b/qshare_thumb_x_abc123?async=true");
    expect(card.container.querySelector("[data-testid=icon]")).not.toBeNull();
    const row = render(<ShareRowArt share={share} fallback={icon} />);
    expect(img(row.container)).toBe("/arbitrary/THUMBNAIL/dj%20b/qshare_thumb_x_abc123?async=true");
    // A row keeps its icon until the thumbnail has loaded.
    expect(row.container.querySelector("[data-testid=icon]")).not.toBeNull();
    fireEvent.load(row.container.querySelector("img")!);
    expect(row.container.querySelector("[data-testid=icon]")).toBeNull();
    expect(fetchCallsMatching("/arbitrary/resource/status").length).toBe(0);
  });

  it("shows a share's own small image on a card once the node has it, and never fetches it otherwise", async () => {
    mockFetch("/arbitrary/resource/status", (url: URL) =>
      url.pathname.endsWith("on_node") ? { status: "READY" } : url.pathname.endsWith("unbuilt") ? { status: "DOWNLOADED" } : { status: "PUBLISHED" }
    );
    const ready = render(<ShareCardArt share={{ files: [photo("img_on_node")] }} fallback={icon} />);
    mockAllIsIntersecting(true);
    await waitFor(() => expect(img(ready.container)).toBe("/arbitrary/FILE/dj%20b/img_on_node?async=true"));
    expect(fetchCallsMatching("/arbitrary/resource/status/FILE/dj%20b/img_on_node")).toHaveLength(1);

    const missing = render(<ShareCardArt share={{ files: [photo("img_elsewhere")] }} fallback={icon} />);
    mockAllIsIntersecting(true);
    await waitFor(() => expect(fetchCallsMatching("/arbitrary/resource/status/FILE/dj%20b/img_elsewhere")).toHaveLength(1));
    expect(img(missing.container)).toBeNull();
    expect(missing.container.querySelector("[data-testid=icon]")).not.toBeNull();
    // Every chunk on the node but not built yet counts too: the picture's GET builds it.
    const unbuilt = render(<ShareCardArt share={{ files: [photo("img_unbuilt")] }} fallback={icon} />);
    mockAllIsIntersecting(true);
    await waitFor(() => expect(img(unbuilt.container)).toBe("/arbitrary/FILE/dj%20b/img_unbuilt?async=true"));
    // Rows don't use the share's own image.
    const row = render(<ShareRowArt share={{ files: [photo("img_on_node")] }} fallback={icon} />);
    expect(img(row.container)).toBeNull();
  });

  it("leaves big images and image previews switched off alone", () => {
    expect(cardImage([photo("big", 3 * 1024 * 1024)])).toBeNull();
    expect(cardImage([{ ...photo("pdf"), filename: "a.pdf", mimetype: "application/pdf" }])).toBeNull();
    // Only FILEs: the status check and the picture both use FILE, whatever someone's JSON says.
    expect(cardImage([{ ...photo("odd"), service: "../../admin/stop?" }])).toBeNull();
    expect(cardImage([{ ...photo("old"), service: undefined }])?.identifier).toBe("old");
    writeSettings({ autoPreviewImages: false });
    const card = render(<ShareCardArt share={{ files: [photo("img_on_node")] }} fallback={icon} />);
    mockAllIsIntersecting(true);
    expect(img(card.container)).toBeNull();
    expect(fetchCallsMatching("/arbitrary/resource/status").length).toBe(0);
  });
});
