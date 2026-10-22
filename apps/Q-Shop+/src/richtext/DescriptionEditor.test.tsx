import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Quill } from "react-quill-new";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { resetQdnCaches } from "../qdn/search";
import DescriptionEditor from "./DescriptionEditor";

// jsdom measures no text: Quill asks where the cursor is when it scrolls to it.
beforeAll(() => {
  const proto = Range.prototype as unknown as Record<string, unknown>;
  proto.getBoundingClientRect ??= () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
  proto.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

function renderEditor(value = "") {
  const onChange = vi.fn();
  const view = renderWithProviders(<DescriptionEditor value={value} onChange={onChange} name="Seller Name" productTitle="Ghee" shopTitle="Biohackers Corner" />);
  const quill = () => Quill.find(view.container.querySelector(".ql-container")!) as Quill;
  return { ...view, onChange, quill };
}

describe("the description editor", { timeout: 20_000 }, () => {
  it("keeps the formatting of pasted text, without its colours or pictures", async () => {
    const { container, quill } = renderEditor();
    await waitFor(() => expect(container.querySelector(".ql-editor")).not.toBeNull());
    const delta = quill().clipboard.convert({
      html: '<h2>Ghee</h2><p><span style="color: rgb(255,255,255); background: black"><strong>Rich</strong> <em>text</em></span> <a href="qortal://APP/Q-Blog/x">a link</a><img src="https://example.com/x.png"></p><ul><li>One</li></ul>',
    });
    const ops = delta.ops as { insert: unknown; attributes?: Record<string, unknown> }[];
    expect(ops.find((op) => op.insert === "Rich")?.attributes).toEqual({ bold: true });
    expect(ops.find((op) => op.insert === "text")?.attributes).toEqual({ italic: true });
    expect(ops.some((op) => op.attributes?.header === 2)).toBe(true);
    expect(ops.some((op) => op.attributes?.list === "bullet")).toBe(true);
    // A qortal:// link stays one (Quill keeps only the schemes it allows).
    expect(ops.find((op) => op.insert === "a link")?.attributes).toEqual({ link: "qortal://APP/Q-Blog/x" });
    expect(ops.some((op) => op.attributes?.color || op.attributes?.background)).toBe(false);
    expect(ops.some((op) => typeof op.insert === "object")).toBe(false);
  });

  it("names its buttons, and adds a video from a Q-Tube link as a block in the text", async () => {
    installQortalMock({});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) =>
        String(input) === "/arbitrary/DOCUMENT/Bob/qtube_vid_a"
          ? { ok: true, status: 200, text: async () => JSON.stringify({ title: "Making ghee", videoReference: { name: "Bob", identifier: "qtube_vid_a_v", service: "VIDEO" } }) }
          : { ok: false, status: 404, text: async () => '{"error":1401}' }
      )
    );
    const { onChange, quill } = renderEditor("<p>Our ghee.</p>");
    const button = await screen.findByRole("button", { name: "Add a video" });
    expect(screen.getByRole("button", { name: "Add a file or PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    // Loading the value isn't a change of the seller's.
    expect(onChange).not.toHaveBeenCalled();
    act(() => quill().setSelection(quill().getLength(), 0));
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Q-Tube or Qortal link" }), { target: { value: "qortal://APP/Q-Tube/video/Bob/qtube_vid_a" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Find the video" }));
    expect(await within(dialog).findByText("Making ghee")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add video" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)![0] as string;
    expect(html).toContain('class="qshop-embed"');
    expect(html).toContain('data-identifier="qtube_vid_a_v"');
    expect(html).toContain('data-link="qortal://APP/Q-Tube/video/Bob/qtube_vid_a"');
    expect(html).toContain("Video: Making ghee");
    expect(screen.queryByRole("dialog", { name: "Add a video" })).toBeNull();
  });

  it("says what isn't a video link", async () => {
    renderEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Add a video" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a video" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Q-Tube or Qortal link" }), { target: { value: "https://youtube.com/watch?v=1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Find the video" }));
    expect(await within(dialog).findByText(/Paste a Q-Tube video link/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add video" })).toBeDisabled();
  });
});
