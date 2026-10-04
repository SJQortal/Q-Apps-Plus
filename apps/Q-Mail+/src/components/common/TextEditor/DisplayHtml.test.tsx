import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { store } from "../../../state/store";
import { DisplayHtml, sanitizeMessageHtml } from "./DisplayHtml";
import { convertQortalLinks } from "./utils";
import { mockQortalAction, qortalCalls } from "../../../test/setup";
import { removeNotification } from "../../../state/features/notificationsSlice";

/** Parse the sanitised output the way the page will. */
function parse(html: string): HTMLElement {
  const box = document.createElement("template");
  box.innerHTML = sanitizeMessageHtml(html);
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

const renderBody = (html: string) =>
  render(
    <Provider store={store}>
      <DisplayHtml html={html} />
    </Provider>
  );

describe("sanitizeMessageHtml: stored XSS through qortal:// text", () => {
  // Mail text that tries to close the href and add attributes: the hole the
  // regex-built links used to open (pitfall 18).
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
    expect(Array.from(links[0].attributes).map((a) => a.name).sort()).toEqual(["class", "href", "title"]);
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

  it("keeps the href of a qortal link written as a link and nests nothing inside it", () => {
    const root = parse(`<p><a href="qortal://APP/Q-Tube/video/a/b" target="_blank">qortal://APP/Q-Tube/video/a/b</a></p>`);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("qortal://APP/Q-Tube/video/a/b");
    expect(root.querySelector("a a")).toBeNull();
  });

  it("turns a Quill about:blank link around a qortal:// URL into one working link", () => {
    const html = `<p><a href="about:blank" target="_blank" rel="noopener noreferrer">qortal://APP/Q-Mail/to/alice</a></p>`;
    const root = parse(html);
    const links = root.querySelectorAll("a");
    expect(links.length).toBe(1);
    expect(links[0].getAttribute("href")).toBe("qortal://APP/Q-Mail/to/alice");
  });

  it("leaves sentence punctuation after a qortal:// URL out of the link", () => {
    const root = parse("<p>Join qortal://use-group/action-join/groupid-1176. Or (qortal://APP/Q-Tube)!</p>");
    expect(Array.from(root.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([
      "qortal://use-group/action-join/groupid-1176",
      "qortal://APP/Q-Tube",
    ]);
    expect(root.textContent).toBe("Join qortal://use-group/action-join/groupid-1176. Or (qortal://APP/Q-Tube)!");
  });

  it("titles each qortal:// link with what it does, over the sender's title", () => {
    const root = parse(
      `<p><a href="qortal://APP/Q-Tube" title="Free QORT">tube</a> qortal://use-group/action-join/groupid-7 ` +
        `qortal://APP/Simon%20James</p>`
    );
    expect(Array.from(root.querySelectorAll("a")).map((a) => a.getAttribute("title"))).toEqual([
      "Open Q-Tube in a new tab",
      "Join group 7 (Hub asks first)",
      "Open Simon James in a new tab",
    ]);
  });

  it("turns a qortal:// link that can't open into its text", () => {
    const root = parse(`<p><a href="qortal://APP/../Evil">see</a> and <a href="qortal://bad service/x">this</a></p>`);
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("see and this");
  });

  it("leaves qortal:// text in code alone", () => {
    const root = parse(`<pre class="ql-syntax">qortal://APP/x</pre><p><code>qortal://APP/y</code></p>`);
    expect(root.querySelectorAll("a").length).toBe(0);
    expect(root.textContent).toContain("qortal://APP/x");
  });

  it("still drops script, javascript: links, <style> and forms", () => {
    const root = parse(
      `<p><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><script>alert(1)</script></p>` +
        `<style>body{display:none}</style><form action="/render/APP/Evil"><input name="q"><button>Go</button></form>`
    );
    expect(handlerAttributes(root)).toEqual([]);
    expect(root.querySelector("script, style, form, input, button")).toBeNull();
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("xGo");
  });

  it("returns nothing for an empty body", () => {
    expect(sanitizeMessageHtml("")).toBe("");
    expect(sanitizeMessageHtml(null)).toBe("");
    expect(sanitizeMessageHtml(undefined)).toBe("");
  });
});

describe("sanitizeMessageHtml: inline colours", () => {
  it.each([
    "color: rgb(255, 255, 255); background-color: transparent;",
    "background-color: rgb(15, 15, 15); color: rgb(241, 241, 241);",
    "color: var(--fgColor-accent, var(--color-accent-fg)); background-color: transparent;",
  ])("drops %s and keeps the text", (style) => {
    const root = parse(`<p><strong style="${style}">Heading</strong> body</p>`);
    const strong = root.querySelector("strong");
    expect(strong?.textContent).toBe("Heading");
    expect(strong?.hasAttribute("style")).toBe(false);
  });

  it("keeps the declarations that are not colours", () => {
    const root = parse(`<p><span style="color: rgb(0, 0, 0); font-weight: bold; text-decoration: underline">x</span></p>`);
    const style = root.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).toContain("font-weight: bold");
    expect(style).toContain("text-decoration: underline");
    expect(style).not.toMatch(/(^|[^-])color/);
  });

  it("drops colour attributes", () => {
    const root = parse(`<p><font color="white">x</font></p><table><tbody><tr><td bgcolor="black">y</td></tr></tbody></table>`);
    expect(root.querySelector("[color], [bgcolor]")).toBeNull();
    expect(root.textContent).toBe("xy");
  });
});

describe("sanitizeMessageHtml: links that leave Qortal", () => {
  it("marks http(s) links to copy, and drops target", () => {
    const root = parse(`<p><a href="https://example.com/x" target="_blank">x</a></p>`);
    const link = root.querySelector("a")!;
    expect(link.hasAttribute("data-copy-link")).toBe(true);
    expect(link.getAttribute("title")).toMatch(/copy web link/i);
    expect(link.hasAttribute("target")).toBe(false);
  });

  it("keeps mailto: and tel: links, marked to copy their address", () => {
    const root = parse(`<p><a href="mailto:a@example.com">mail</a> <a href="tel:+100">call</a></p>`);
    const links = Array.from(root.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["mailto:a@example.com", "tel:+100"]);
    expect(links.every((a) => a.hasAttribute("data-copy-link"))).toBe(true);
  });

  it.each(["/render/APP/Evil", "#top", "?x=1", "about:blank", "mailto:?subject=Hi"])("turns a %s link into text", (href) => {
    const root = parse(`<p>Go <a href="${href}">here</a> now</p>`);
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toBe("Go here now");
  });

  it("drops a data-copy-link marker the sender wrote", () => {
    const root = parse(`<p><a href="qortal://APP/x" data-copy-link>x</a></p>`);
    expect(root.querySelector("a")?.getAttribute("href")).toBe("qortal://APP/x");
    expect(root.querySelector("[data-copy-link]")).toBeNull();
  });
});

describe("DisplayHtml", () => {
  const html = `<p><a href="https://example.com/x">Example</a> and <a href="qortal://APP/Q-Tube">Q-Tube</a></p>`;
  let prevented: boolean | null = null;
  // Stands in for q-apps.js's document listener: records what the app did, then stops jsdom navigating.
  const recordDefault = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  beforeEach(() => {
    prevented = null;
    document.addEventListener("click", recordDefault);
  });
  afterEach(() => {
    document.removeEventListener("click", recordDefault);
    vi.restoreAllMocks();
  });

  it("copies a web link on click instead of following it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderBody(html);
    fireEvent.click(screen.getByText("Example"));
    expect(prevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/x");
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertSuccess).toBe(
        "Link copied. Hub can't open web links, so paste it in your browser."
      )
    );
  });

  it("opens a qortal:// app link in a new Hub tab, and q-apps.js never sees the click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    mockQortalAction("OPEN_NEW_TAB", true);
    renderBody(html);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    screen.getByText("Q-Tube").dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(prevented).toBeNull();
    await waitFor(() => expect(qortalCalls("OPEN_NEW_TAB")).toEqual([{ action: "OPEN_NEW_TAB", qortalLink: "qortal://APP/Q-Tube" }]));
    expect(writeText).not.toHaveBeenCalled();
  });

  // Mugician's "Q-Builder Test Users" mail, textContentV2 exactly as stored:
  // the sender's Quill wrote the qortal: href as about:blank.
  const mugician =
    `<p><a href="about:blank" rel="noopener noreferrer" target="_blank">qortal://use-group/action-join/groupid-1176</a></p>` +
    `<p><br></p><p>built a Little something and all group members can publish Apps at no extra cost. Would be glad to get your feedback</p>`;

  it("asks Hub to join the group from Mugician's join link (no frame navigation)", async () => {
    store.dispatch(removeNotification());
    mockQortalAction("JOIN_GROUP", { signature: "x" });
    renderBody(mugician);
    const link = screen.getByRole("link", { name: "qortal://use-group/action-join/groupid-1176" });
    expect(link.getAttribute("href")).toBe("qortal://use-group/action-join/groupid-1176");
    expect(link.getAttribute("title")).toBe("Join group 1176 (Hub asks first)");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(prevented).toBeNull();
    await waitFor(() => expect(qortalCalls("JOIN_GROUP")).toEqual([{ action: "JOIN_GROUP", groupId: 1176 }]));
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertSuccess).toMatch(/^Join request for group 1176 sent/)
    );
  });

  it("stays quiet when the user declines Hub's join dialog", async () => {
    store.dispatch(removeNotification());
    mockQortalAction("JOIN_GROUP", () => {
      throw { error: "User declined to join group", message: "User declined to join group" };
    });
    renderBody(mugician);
    fireEvent.click(screen.getByRole("link", { name: /groupid-1176/ }));
    await waitFor(() => expect(qortalCalls("JOIN_GROUP")).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const alerts = store.getState().notifications.alertTypes;
    expect([alerts.alertSuccess, alerts.alertError, alerts.alertInfo]).toEqual(["", "", ""]);
  });

  it("copies a group calendar link, which Hub opens only from its chat", async () => {
    store.dispatch(removeNotification());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const link = "qortal://use-group/action-calendar/groupid-5/eventid-0b0e8f3c-5a3d-4c6f-9e2a-1f2b3c4d5e6f";
    renderBody(`<p>${link}</p>`);
    fireEvent.click(screen.getByRole("link"));
    expect(prevented).toBeNull();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/group chat\. Link copied\.$/));
    expect(qortalCalls()).toEqual([]);
  });

  it("renders the payload without event handlers", () => {
    const { container } = renderBody(`<p>qortal://APP/x"/onpointerenter="alert(1)"/data-x="</p>`);
    expect(handlerAttributes(container)).toEqual([]);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("qortal://APP/x");
  });

  it("renders nothing without a body", () => {
    const { container } = renderBody("");
    expect(container.innerHTML).toBe("");
  });
});

describe("utils", () => {
  it("convertQortalLinks builds links on the DOM", () => {
    const out = convertQortalLinks(`<p>qortal://APP/x"onclick="alert(1)</p>`);
    const root = document.createElement("div");
    root.innerHTML = out;
    expect(handlerAttributes(root)).toEqual([]);
    expect(root.querySelector("a")?.getAttribute("href")).toBe("qortal://APP/x");
    expect(convertQortalLinks("<p>plain</p>")).toBe("<p>plain</p>");
  });
});
