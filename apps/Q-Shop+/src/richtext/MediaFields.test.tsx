/** The product form's videos and files (richtext/MediaFields.tsx), stored in the description as blocks (richtext/embeds.ts). */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { resetQdnCaches } from "../qdn/search";
import MediaFields from "./MediaFields";
import { joinDescription, splitDescription } from "./embeds";

// jsdom has no canvas to shrink pictures with.
vi.mock("../components/common/ImageUploader", () => ({ compressImage: async () => "data:image/webp;base64,UklGRg==" }));

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

/** The form's description, with its media edited here, as the product form does it. */
function renderFields(start = "<p>Our ghee.</p>") {
  const seen: string[] = [];
  function Form() {
    const [description, setDescription] = useState(start);
    const { embeds, text } = splitDescription(description);
    return (
      <MediaFields
        embeds={embeds}
        onChange={(next) => {
          const html = joinDescription(next, text);
          seen.push(html);
          setDescription(html);
        }}
        name="Seller Name"
        productTitle="Ghee"
        shopTitle="Biohackers Corner"
      />
    );
  }
  renderWithProviders(<Form />);
  return { last: () => seen.at(-1) ?? "" };
}

describe("videos and files under the product's pictures", { timeout: 20_000 }, () => {
  it("adds a video from a Q-Tube link as a block of the description, ahead of its text, and the X takes it out", async () => {
    installQortalMock({});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input) === "/arbitrary/DOCUMENT/Bob/qtube_vid_a"
          ? { ok: true, status: 200, text: async () => JSON.stringify({ title: "Making ghee", videoReference: { name: "Bob", identifier: "qtube_vid_a_v", service: "VIDEO" } }) }
          : { ok: false, status: 404, text: async () => '{"error":1401}' }
      )
    );
    const { last } = renderFields();
    expect(screen.getByRole("button", { name: "Add a PDF or file" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a video" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Q-Tube or Qortal link" }), { target: { value: "qortal://APP/Q-Tube/video/Bob/qtube_vid_a" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Find the video" }));
    expect(await within(dialog).findByText("Making ghee")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add video" }));
    await waitFor(() => expect(last()).toContain('class="qshop-embed"'));
    expect(last()).toContain('data-identifier="qtube_vid_a_v"');
    expect(last()).toContain('data-link="qortal://APP/Q-Tube/video/Bob/qtube_vid_a"');
    expect(last()).toContain("Video: Making ghee");
    expect(last().endsWith("<p>Our ghee.</p>")).toBe(true);
    // Shown as buyers see it, with an X.
    const videos = screen.getByRole("list", { name: "Videos" });
    fireEvent.click(within(videos).getByRole("button", { name: "Remove Video: Making ghee" }));
    await waitFor(() => expect(last()).toBe("<p>Our ghee.</p>"));
    expect(screen.queryByRole("list", { name: "Videos" })).toBeNull();
  });

  it("adds a Q-Tube video with Q-Tube's thumbnail, publishing nothing (Simon, 2026-10-27)", async () => {
    const qortal = installQortalMock({});
    const image = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input) === "/arbitrary/DOCUMENT/Bob/qtube_vid_a"
          ? { ok: true, status: 200, text: async () => JSON.stringify({ title: "Making ghee", videoReference: { name: "Bob", identifier: "qtube_vid_a_v", service: "VIDEO" }, videoImage: image }) }
          : { ok: false, status: 404, text: async () => '{"error":1401}' }
      )
    );
    const { last } = renderFields();
    fireEvent.click(screen.getByRole("button", { name: "Add a video" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Q-Tube or Qortal link" }), { target: { value: "qortal://APP/Q-Tube/video/Bob/qtube_vid_a" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Find the video" }));
    await waitFor(() => expect(within(dialog).getByRole("img", { name: "The video's thumbnail" })).toHaveAttribute("src", image));
    expect(within(dialog).getByText(/Q-Tube's thumbnail, nothing to publish/)).toBeInTheDocument();
    // Q-Tube's picture can be replaced, not removed.
    expect(within(dialog).getByRole("button", { name: "Choose another picture" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Remove" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add video" }));
    await waitFor(() => expect(last()).toContain('data-identifier="qtube_vid_a_v"'));
    expect(last()).not.toContain("data-thumb-identifier");
    expect(qortal.calls.some((call) => String(call.action).startsWith("PUBLISH"))).toBe(false);
    // Under the pictures, the video shows Q-Tube's thumbnail, and offers to change it.
    const videos = screen.getByRole("list", { name: "Videos" });
    expect(within(videos).getByRole("button", { name: "Change the thumbnail" })).toBeInTheDocument();
  });

  it("adds one of the seller's videos with a thumbnail, published under the seller's name first", async () => {
    const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => ({ signature: "s" }) });
    const rows = [{ name: "Seller Name", service: "VIDEO", identifier: "q-store-video-OLDxxxxxx1", created: 1, size: 1000, metadata: { title: "Churning" } }];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) })));
    const { last } = renderFields();
    fireEvent.click(screen.getByRole("button", { name: "Add a video" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.click(within(dialog).getByRole("tab", { name: "Your videos" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: /^Churning/ }));
    const input = within(dialog).getByRole("region", { name: "Thumbnail" }).querySelector("input[type=file]")!;
    fireEvent.change(input, { target: { files: [new File(["x"], "thumb.png", { type: "image/png" })] } });
    expect(await within(dialog).findByRole("img", { name: "The video's thumbnail" })).toHaveAttribute("src", "data:image/webp;base64,UklGRg==");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish thumbnail and add" }));
    await waitFor(() => expect(last()).toContain('data-identifier="q-store-video-OLDxxxxxx1"'));
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")[0]).toMatchObject({ name: "Seller Name", service: "THUMBNAIL", data64: "UklGRg==" });
    expect(last()).toContain('data-thumb-name="Seller Name"');
    expect(last()).toMatch(/data-thumb-identifier="q-store-thumb-[A-Za-z0-9]{10}"/);
  });

  it("changes a video's thumbnail, and can take it off again", async () => {
    installQortalMock({});
    const video =
      '<div class="qshop-embed" data-kind="video" data-name="Seller Name" data-identifier="q-store-video-AbCdEf1234" data-title="Making ghee" data-thumb-name="Seller Name" data-thumb-identifier="q-store-thumb-ThUmB12345">Video: Making ghee</div>';
    const { last } = renderFields(`<p>Our ghee.</p>${video}`);
    fireEvent.click(screen.getByRole("button", { name: "Change the thumbnail" }));
    const dialog = await screen.findByRole("dialog", { name: "Video thumbnail" });
    expect(within(dialog).getByRole("img", { name: "The video's thumbnail" })).toHaveAttribute("src", "/arbitrary/THUMBNAIL/Seller%20Name/q-store-thumb-ThUmB12345");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(last()).toContain('data-identifier="q-store-video-AbCdEf1234"'));
    expect(last()).not.toContain("data-thumb");
    expect(await screen.findByRole("button", { name: "Add a thumbnail" })).toBeInTheDocument();
  });

  it("says what isn't a video link", async () => {
    renderFields();
    fireEvent.click(screen.getByRole("button", { name: "Add a video" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Q-Tube or Qortal link" }), { target: { value: "https://youtube.com/watch?v=1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Find the video" }));
    expect(await within(dialog).findByText(/Paste a Q-Tube video link/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add video" })).toBeDisabled();
  });
});
