import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { DisplayHtml, sanitizeDescription } from "./DisplayHtml";

/** Parse the sanitised output the way the page will. */
function parse(html: string): HTMLElement {
  const box = document.createElement("template");
  box.innerHTML = sanitizeDescription(html);
  const root = document.createElement("div");
  root.append(box.content);
  return root;
}

function handlerAttributes(root: Element): string[] {
  return Array.from(root.querySelectorAll("*")).flatMap((el) =>
    Array.from(el.attributes)
      .map((a) => a.name)
      .filter((name) => name.toLowerCase().startsWith("on"))
  );
}

describe("sanitizeDescription: qortal:// links", () => {
  // Description text that tries to close the href and add attributes.
  const payloads = [
    `<p>qortal://APP/x"/onpointerenter="alert(1)"/data-x="</p>`,
    `<p>qortal://APP/x"onmouseover="alert(1)"style="display:block;position:fixed;inset:0</p>`,
    `<p>qortal://APP/x'onmouseover='alert(1)'</p>`,
    "<p>qortal://APP/x`onclick=alert(1)`</p>",
    `<p>qortal://APP/x&lt;img src=x onerror=alert(1)&gt;</p>`,
    `<p>qortal://APP/x"/onfocus="alert(1)"/tabindex="0"/autofocus="</p>`,
  ];

  it.each(payloads)("adds no handler or extra element for %s", (payload) => {
    const root = parse(payload);
    expect(handlerAttributes(root)).toEqual([]);
    expect(root.querySelectorAll("img, script").length).toBe(0);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("qortal://APP/x");
    expect(Array.from(links[0].attributes).map((a) => a.name).sort()).toEqual(["class", "href"]);
    // The rest of the text is still shown, as text.
    expect(root.textContent).toBe(new DOMParser().parseFromString(payload, "text/html").body.textContent);
  });

  it("turns plain-text qortal:// URLs into links and leaves the text around them", () => {
    const root = parse("<p>See qortal://APP/Q-Tube/video/a/b, then qortal://APP/Q-Mail now</p>");
    const links = Array.from(root.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["qortal://APP/Q-Tube/video/a/b", "qortal://APP/Q-Mail"]);
    expect(links.every((a) => a.className === "qortal-link")).toBe(true);
    expect(root.textContent).toBe("See qortal://APP/Q-Tube/video/a/b, then qortal://APP/Q-Mail now");
  });

  it("keeps & in a URL as & in the href", () => {
    const root = parse("<p>qortal://APP/Q-Share?x=1&amp;y=2</p>");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("qortal://APP/Q-Share?x=1&y=2");
  });

  it("keeps the href of a qortal link written as a link and nests nothing inside it", () => {
    const html = `<p><a href="qortal://APP/Q-Tube/video/a/b" target="_blank">qortal://APP/Q-Tube/video/a/b</a></p>`;
    const root = parse(html);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("qortal://APP/Q-Tube/video/a/b");
    expect(root.querySelector("a a")).toBeNull();
  });

  it("turns a Quill about:blank link around a qortal:// URL into one working link", () => {
    // Real data: Quill 1 stores qortal: links as about:blank, which DOMPurify drops.
    const html = `<p><a href="about:blank" target="_blank" rel="noopener noreferrer">qortal://APP/Q-Share/share/Zen432/qshare_file_x_metadata</a></p>`;
    const root = parse(html);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("qortal://APP/Q-Share/share/Zen432/qshare_file_x_metadata");
    expect(links[0].className).toBe("qortal-link");
  });

  it("leaves qortal:// text in code alone", () => {
    const root = parse(`<pre class="ql-syntax">qortal://APP/x</pre><p><code>qortal://APP/y</code></p>`);
    expect(root.querySelectorAll("a").length).toBe(0);
    expect(root.textContent).toContain("qortal://APP/x");
  });

  it("leaves https links as they are and does not linkify https text", () => {
    const root = parse(`<p><a href="https://github.com/gohugoio/hugo" rel="noopener noreferrer">Hugo</a> and https://example.com</p>`);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("https://github.com/gohugoio/hugo");
    expect(links[0].textContent).toBe("Hugo");
  });

  it("still drops script and javascript: links", () => {
    const root = parse(`<p><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><script>alert(1)</script></p>`);
    expect(handlerAttributes(root)).toEqual([]);
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("x");
  });

  it("returns nothing for an empty description", () => {
    expect(sanitizeDescription("")).toBe("");
    expect(sanitizeDescription(null)).toBe("");
  });
});

describe("sanitizeDescription: inline colours", () => {
  it.each([
    // Style strings from real shares on the node.
    "color: rgb(255, 255, 255); background-color: transparent;",
    "background-color: transparent; color: rgb(255, 255, 255);",
    "color: rgb(0, 0, 0);",
    "background-color: rgb(15, 15, 15); color: rgb(241, 241, 241);",
    "color: var(--fgColor-accent, var(--color-accent-fg)); background-color: transparent;",
  ])("drops %s and keeps the text", (style) => {
    const root = parse(`<p><strong style="${style}">Heading</strong> body</p>`);
    const strong = root.querySelector("strong");
    expect(strong?.textContent).toBe("Heading");
    expect(strong?.hasAttribute("style")).toBe(false);
    expect(root.textContent).toBe("Heading body");
  });

  it("keeps the declarations that are not colours", () => {
    const root = parse(`<p><span style="color: rgb(0, 0, 0); font-weight: bold; text-decoration: underline">x</span></p>`);
    const style = root.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).toContain("font-weight: bold");
    expect(style).toContain("text-decoration: underline");
    expect(style).not.toMatch(/(^|[^-])color/);
  });

  it("drops background shorthands and text fill colour", () => {
    const root = parse(`<p><span style="background: #fff url(x.png); -webkit-text-fill-color: white; font-style: italic">x</span></p>`);
    const style = root.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).not.toMatch(/background|fill-color/);
    expect(style).toContain("font-style: italic");
  });

  it("drops colour attributes", () => {
    const root = parse(`<p><font color="white">x</font></p><table><tbody><tr><td bgcolor="black">y</td></tr></tbody></table>`);
    expect(root.querySelector("[color], [bgcolor]")).toBeNull();
    expect(root.textContent).toBe("xy");
  });
});

describe("DisplayHtml", () => {
  it("renders the payload without event handlers", () => {
    const { container } = renderWithProviders(
      <DisplayHtml html={`<p>qortal://APP/x"/onpointerenter="alert(1)"/data-x="</p>`} />
    );
    expect(handlerAttributes(container)).toEqual([]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("qortal://APP/x");
  });

  it("renders nothing without a description", () => {
    const { container } = renderWithProviders(<DisplayHtml html="" />);
    expect(container.innerHTML).toBe("");
  });
});
