import { describe, expect, it, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import Quill from "quill";
import { renderWithProviders } from "../../../test/renderWithProviders";
import TextEditorQuill from "./TextEditorQuill";

// What a share from the original Q-Share (Quill 1, no format whitelist) can hold.
const IMAGE = "https://example.com/figure.png";
const INLINE = "data:image/png;base64,iVBORw0KGgo=";
const VIDEO = "https://www.youtube.com/embed/abc";
const OLD_DESCRIPTION =
  `<p>Hello <img src="${IMAGE}"></p><p>b <img src="${INLINE}"></p>` +
  `<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="${VIDEO}"></iframe><p>end</p>`;

function renderEditor(value: string) {
  const setInlineContent = vi.fn();
  const view = renderWithProviders(<TextEditorQuill inlineContent={value} setInlineContent={setInlineContent} />);
  return { ...view, setInlineContent };
}

describe("TextEditorQuill", () => {
  it("keeps the images and video of an existing description when it loads", async () => {
    const { container, setInlineContent } = renderEditor(OLD_DESCRIPTION);
    await waitFor(() => expect(container.querySelector(".ql-editor")).not.toBeNull());
    const editor = container.querySelector(".ql-editor")!;
    await waitFor(() => expect(editor.querySelectorAll("img").length).toBe(2));
    expect(Array.from(editor.querySelectorAll("img")).map((img) => img.getAttribute("src"))).toEqual([IMAGE, INLINE]);
    expect(container.querySelector("iframe.ql-video")?.getAttribute("src")).toBe(VIDEO);
    // Loading hands the editor's HTML back as the draft: it must still carry them.
    for (const [html] of setInlineContent.mock.calls) {
      expect(html).toContain(IMAGE);
      expect(html).toContain(INLINE);
      expect(html).toContain(VIDEO);
    }
    // Still no toolbar button to add either.
    expect(container.querySelector(".ql-toolbar .ql-image, .ql-toolbar .ql-video")).toBeNull();
  });

  it("does not turn a dropped or pasted image file into a base64 image", async () => {
    const { container } = renderEditor("<p>Text</p>");
    await waitFor(() => expect(container.querySelector(".ql-container")).not.toBeNull());
    const quill = Quill.find(container.querySelector(".ql-container")!) as Quill;
    const png = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });
    await act(async () => {
      quill.uploader.upload({ index: 0, length: 0 }, [png]);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.querySelectorAll(".ql-editor img").length).toBe(0);
  });

  it("drops the images and video of pasted HTML and keeps its text and formatting", async () => {
    const { container, setInlineContent } = renderEditor("<p>Text</p>");
    await waitFor(() => expect(container.querySelector(".ql-editor")).not.toBeNull());
    const editor = container.querySelector(".ql-editor")!;
    // What a copied piece of a web page carries.
    const pasted =
      `<meta charset="utf-8"><p>Pasted <strong>bold</strong> <img src="${IMAGE}"> and <img src="${INLINE}"></p>` +
      `<iframe class="ql-video" src="${VIDEO}"></iframe><p>after</p>`;
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) => (type === "text/html" ? pasted : type === "text/plain" ? "Pasted bold and after" : ""),
        files: [],
      },
    });
    // jsdom has no layout, and Quill scrolls the pasted text into view.
    const range = Range.prototype as { getBoundingClientRect?: () => DOMRect };
    const hadRect = typeof range.getBoundingClientRect === "function";
    if (!hadRect) range.getBoundingClientRect = () => new DOMRect();
    try {
      await act(async () => {
        editor.dispatchEvent(paste);
      });
    } finally {
      if (!hadRect) delete range.getBoundingClientRect;
    }

    await waitFor(() => expect(editor.textContent).toContain("after"));
    expect(editor.querySelectorAll("img, iframe").length).toBe(0);
    expect(editor.textContent).toContain("Pasted bold and");
    expect(editor.querySelector("strong")?.textContent).toBe("bold");
    const draft = setInlineContent.mock.calls.at(-1)?.[0] as string;
    expect(draft).toContain("Pasted");
    expect(draft).not.toContain(IMAGE);
    expect(draft).not.toContain(INLINE);
    expect(draft).not.toContain(VIDEO);
  });
});
