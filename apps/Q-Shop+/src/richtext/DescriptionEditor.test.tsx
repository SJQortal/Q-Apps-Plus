import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { Quill } from "react-quill-new";
import { renderWithProviders } from "../test/renderWithProviders";
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
  const view = renderWithProviders(<DescriptionEditor value={value} onChange={onChange} />);
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

  it("pastes text written with Markdown as its formatting, and leaves a formatted paste to Quill", async () => {
    const { container, quill } = renderEditor();
    await waitFor(() => expect(container.querySelector(".ql-editor")).not.toBeNull());
    const editor = container.querySelector<HTMLElement>(".ql-editor")!;
    const paste = (data: Record<string, string>) => {
      const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
      event.clipboardData = { getData: (type: string) => data[type] ?? "" };
      act(() => {
        quill().setSelection(0, 0);
        editor.dispatchEvent(event);
      });
      return event;
    };
    const event = paste({ "text/plain": "## Matcha\n**Ceremonial** grade, see [Q-Tube](qortal://APP/Q-Tube)\n- 30 g\n- 100 g" });
    expect(event.defaultPrevented).toBe(true);
    const ops = quill().getContents().ops as { insert: unknown; attributes?: Record<string, unknown> }[];
    expect(ops.some((op) => op.attributes?.header === 2)).toBe(true);
    expect(ops.find((op) => op.insert === "Ceremonial")?.attributes).toEqual({ bold: true });
    expect(ops.find((op) => op.insert === "Q-Tube")?.attributes).toEqual({ link: "qortal://APP/Q-Tube" });
    expect(ops.filter((op) => op.attributes?.list === "bullet")).toHaveLength(2);
    expect(quill().getText()).not.toContain("**");
    // A web page's copy, with formatting of its own: Quill's own paste, of its HTML (no list from the text).
    act(() => quill().setText(""));
    paste({ "text/plain": "**x**\n- a\n- b", "text/html": "<p><strong>x</strong></p>" });
    const own = quill().getContents().ops as { insert: unknown; attributes?: Record<string, unknown> }[];
    expect(own.find((op) => op.insert === "x")?.attributes).toEqual({ bold: true });
    expect(own.some((op) => op.attributes?.list)).toBe(false);
  });

  it("turns qortal:// addresses into links, pasted or typed, without the full stop after them", async () => {
    const { container, quill } = renderEditor();
    await waitFor(() => expect(container.querySelector(".ql-editor")).not.toBeNull());
    const pasted = quill().clipboard.convert({ html: "<p>See qortal://APP/Q-Tube/video/Bob/x. Thanks</p>" }).ops as { insert: unknown; attributes?: Record<string, unknown> }[];
    expect(pasted.find((op) => op.attributes?.link)).toEqual({ insert: "qortal://APP/Q-Tube/video/Bob/x", attributes: { link: "qortal://APP/Q-Tube/video/Bob/x" } });
    // Typed: the link comes once a space ends it.
    act(() => {
      quill().insertText(0, "Shop: qortal://APP/Q-Shop", "user");
      quill().setSelection(25, 0);
      quill().insertText(25, " ", "user");
      quill().setSelection(26, 0);
    });
    await waitFor(() => expect(quill().getFormat(6, 19).link).toBe("qortal://APP/Q-Shop"));
  });

  it("names its buttons; videos and files are added under the pictures, not here", async () => {
    const { onChange } = renderEditor("<p>Our ghee.</p>");
    expect(await screen.findByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a video" })).toBeNull();
    // Loading the value isn't a change of the seller's.
    expect(onChange).not.toHaveBeenCalled();
  });
});
