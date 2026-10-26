import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import { resetQdnCaches } from "../qdn/search";
import { ProductDescription, ProductMedia, useDescriptionParts } from "./ProductDescription";
import { htmlToPlainText } from "./plainText";

/** The product page's two parts: the media (under the pictures) and the description's text. */
function Described({ product }: { product: { description?: unknown; htmlDescription?: unknown } }) {
  const parts = useDescriptionParts(product);
  return (
    <>
      <ProductMedia parts={parts} />
      <section aria-label="Description">
        <ProductDescription parts={parts} />
      </section>
    </>
  );
}

/** A product as Q-Shop+ writes one: the plain description says what the formatted one says. */
const rich = (html: string) => ({ description: htmlToPlainText(html), htmlDescription: html });

const copyText = vi.fn(async (_text: string) => true);
vi.mock("../utils/clipboard", () => ({ copyText: (text: string) => copyText(text) }));
// pdf.js draws on a canvas jsdom doesn't have: the viewer says what it was handed.
vi.mock("./pdf/PdfViewer", () => ({ default: ({ data, title }: { data: ArrayBuffer; title: string }) => <p>{`Viewer: ${title}, ${data.byteLength} bytes`}</p> }));

type Answer = { status?: number; body: unknown } | ((url: string) => { status?: number; body: unknown });
let routes: Record<string, Answer> = {};
const calls: string[] = [];

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  routes = {};
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string): Promise<Record<string, unknown>> => {
      const url = String(input);
      calls.push(url);
      const route = routes[url.split("?")[0]];
      const answer = typeof route === "function" ? route(url) : route;
      if (!answer) return { ok: false, status: 404, text: async (): Promise<string> => '{"error":1401}', json: async () => ({ error: 1401 }), headers: new Headers() };
      const status = answer.status ?? 200;
      const body = answer.body;
      return {
        ok: status < 400,
        status,
        headers: new Headers(),
        text: async (): Promise<string> => (typeof body === "string" ? body : JSON.stringify(body)),
        json: async (): Promise<unknown> => body,
        arrayBuffer: async () => new TextEncoder().encode(String(body)).buffer,
      };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

const VIDEO_EMBED =
  '<div class="qshop-embed" data-kind="video" data-name="Seller Name" data-identifier="q-store-video-AbCdEf1234" data-title="Making ghee">Video: Making ghee</div>';

describe("a product's description", { timeout: 20_000 }, () => {
  it("shows the seller's formatting, and a plain one as it was written", async () => {
    const { unmount } = renderWithProviders(
      <Described product={rich("<h2>Ghee</h2><p>Slow-cooked <strong>Icelandic</strong> ghee.</p><ul><li>Grass-fed</li></ul>")} />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Ghee" })).toBeInTheDocument();
    expect(screen.getByText("Icelandic").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("Grass-fed");
    unmount();
    renderWithProviders(<Described product={{ description: "Line one\nSee qortal://APP/Q-Blog/x" }} />);
    expect(screen.getByText("Line one")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "qortal://APP/Q-Blog/x" })).toHaveAttribute("href", "qortal://APP/Q-Blog/x");
    // It opens in a new Hub tab.
    const request = vi.fn(async () => true);
    vi.stubGlobal("qortalRequest", request);
    fireEvent.click(screen.getByRole("link", { name: "qortal://APP/Q-Blog/x" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "OPEN_NEW_TAB", qortalLink: "qortal://APP/Q-Blog/x" }));
    vi.unstubAllGlobals();
  });

  it("puts its videos and attachments in sections of their own, out of the text", async () => {
    const pdf =
      '<div class="qshop-embed" data-kind="file" data-name="Bob" data-identifier="qshare_file_g" data-title="Care guide" data-filename="guide.pdf" data-mimetype="application/pdf">PDF: Care guide</div>';
    renderWithProviders(<Described product={rich(`<p>Our ghee.</p>${VIDEO_EMBED}<p>More text.</p>${pdf}`)} />);
    const video = screen.getByRole("region", { name: "Video" });
    expect(within(video).getByRole("button", { name: "Play video: Making ghee" })).toBeInTheDocument();
    const files = screen.getByRole("region", { name: "Attachments" });
    expect(within(files).getByRole("button", { name: "Preview Care guide" })).toBeInTheDocument();
    const text = screen.getByRole("region", { name: "Description" });
    expect(text).toHaveTextContent("Our ghee.More text.");
    expect(within(text).queryByRole("button")).toBeNull();
  });

  it("shows a video's thumbnail until it plays, from the seller's THUMBNAIL", async () => {
    const withThumb = VIDEO_EMBED.replace('data-kind="video"', 'data-kind="video" data-thumb-name="Seller Name" data-thumb-identifier="q-store-thumb-ThUmB12345"');
    const { container } = renderWithProviders(<Described product={rich(`<p>Watch:</p>${withThumb}`)} />);
    const video = screen.getByRole("region", { name: "Video" });
    const img = video.querySelector("img");
    expect(img).toHaveAttribute("src", "/arbitrary/THUMBNAIL/Seller%20Name/q-store-thumb-ThUmB12345");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(within(video).getByRole("button", { name: "Play video: Making ghee" })).toBeInTheDocument();
    // A bad thumbnail id is dropped (embeds.ts), so no picture.
    const bad = VIDEO_EMBED.replace('data-kind="video"', 'data-kind="video" data-thumb-name="Seller Name" data-thumb-identifier="../x"');
    container.remove();
    const second = renderWithProviders(<Described product={rich(`<p>Watch:</p>${bad}`)} />);
    expect(second.container.querySelector("img")).toBeNull();
  });

  it("plays a video only when asked, once the node has it", async () => {
    routes["/arbitrary/resource/status/VIDEO/Seller%20Name/q-store-video-AbCdEf1234"] = { body: { status: "READY" } };
    renderWithProviders(<Described product={rich(`<p>Watch:</p>${VIDEO_EMBED}`)} />);
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Play video: Making ghee" }));
    const video = await screen.findByLabelText("Making ghee", { selector: "video" });
    expect(video).toHaveAttribute("src", "/arbitrary/VIDEO/Seller%20Name/q-store-video-AbCdEf1234");
    expect(calls).toEqual(["/arbitrary/resource/status/VIDEO/Seller%20Name/q-store-video-AbCdEf1234?build=true"]);
  });

  it("says when a video isn't on QDN, and offers to try again", async () => {
    routes["/arbitrary/resource/status/VIDEO/Seller%20Name/q-store-video-AbCdEf1234"] = { body: { status: "NOT_PUBLISHED" } };
    renderWithProviders(<Described product={rich(VIDEO_EMBED)} />);
    fireEvent.click(screen.getByRole("button", { name: "Play video: Making ghee" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("It isn't on QDN");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("plays a Q-Tube link on a line of its own, and opens Q-Tube", async () => {
    routes["/arbitrary/DOCUMENT/Bob/qtube_vid_a"] = { body: { title: "Bob's ghee video", videoReference: { name: "Bob", identifier: "qtube_vid_a_v", service: "VIDEO" } } };
    renderWithProviders(<Described product={{ description: "Our video:\nqortal://APP/Q-Tube/video/Bob/qtube_vid_a" }} />);
    expect(await screen.findByRole("button", { name: "Play video: Bob's ghee video" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Q-Tube" })).toHaveAttribute("href", "qortal://APP/Q-Tube/video/Bob/qtube_vid_a");
  });

  it("shows a Q-Share link's files and previews a PDF", async () => {
    routes["/arbitrary/DOCUMENT/Bob/qshare_file_guide_x_metadata"] = {
      body: { title: "Care guide", files: [{ filename: "guide.pdf", identifier: "qshare_file_guide_f", name: "Bob", service: "FILE", mimetype: "application/pdf", size: 9 }] },
    };
    routes["/arbitrary/resource/status/FILE/Bob/qshare_file_guide_f"] = { body: { status: "READY" } };
    routes["/arbitrary/FILE/Bob/qshare_file_guide_f"] = { body: "%PDF-1.4!" };
    renderWithProviders(<Described product={{ description: "qortal://APP/Q-Share/share/Bob/qshare_file_guide_x_metadata" }} />);
    const preview = await screen.findByRole("button", { name: "Preview Care guide" });
    expect(screen.getByText(/PDF · guide.pdf · 9 B · by Bob/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Q-Share" })).toHaveAttribute("href", "qortal://APP/Q-Share/share/Bob/qshare_file_guide_x_metadata");
    fireEvent.click(preview);
    const dialog = await screen.findByRole("dialog", { name: "guide.pdf" });
    expect(await within(dialog).findByText("Viewer: guide.pdf, 9 bytes")).toBeInTheDocument();
  });

  it("leaves a link it can't read as a link", async () => {
    renderWithProviders(<Described product={{ description: "qortal://APP/Q-Share/share/Bob/missing_metadata" }} />);
    // Read and failed: the skeleton goes, the link stays.
    await waitFor(() => expect(calls).toContain("/arbitrary/DOCUMENT/Bob/missing_metadata"));
    await waitFor(() => expect(document.querySelector(".MuiSkeleton-root")).toBeNull());
    expect(screen.getByRole("link", { name: "qortal://APP/Q-Share/share/Bob/missing_metadata" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preview/ })).toBeNull();
  });

  it("copies a web link instead of opening it (Hub can't)", async () => {
    renderWithProviders(<Described product={rich('<p><a href="https://example.com/ghee">our site</a></p>')} />);
    fireEvent.click(screen.getByRole("link", { name: "our site" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith("https://example.com/ghee"));
  });
});
