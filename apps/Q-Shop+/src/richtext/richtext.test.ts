import { describe, expect, it } from "vitest";
import { embedData, embedFromData, embedLabel, parseQortalLink, qshareLink, qtubeLink, type QortalEmbed } from "./embeds";
import { descriptionHtmlOf, htmlToPlainText, isPlainHtml, plainToHtml } from "./plainText";
import { sanitizeDescription } from "./sanitize";

const video: QortalEmbed = { kind: "video", name: "Seller Name", identifier: "q-store-video-AbCdEf1234", title: "Making ghee", link: "qortal://APP/Q-Tube/video/Seller%20Name/qtube_vid_ghee_abc" };
const pdf: QortalEmbed = {
  kind: "file",
  name: "Seller Name",
  identifier: "qshare_file_guide_abc123",
  title: "Care guide",
  filename: "guide.pdf",
  mimetype: "application/pdf",
  size: 120_000,
  link: "qortal://APP/Q-Share/share/Seller%20Name/qshare_file_guide_def456_metadata",
};
const embedHtml = (embed: QortalEmbed) =>
  `<div class="qshop-embed" ${Object.entries(embedData(embed))
    .map(([k, v]) => `data-${k}="${v}"`)
    .join(" ")}>${embedLabel(embed)}</div>`;

describe("Qortal links in a description", () => {
  it("are read for Q-Tube videos, Q-Share shares and plain resources, + apps included", () => {
    expect(parseQortalLink("qortal://APP/Q-Tube/video/Seller%20Name/qtube_vid_ghee_abc")).toEqual({ kind: "qtube", name: "Seller Name", identifier: "qtube_vid_ghee_abc" });
    expect(parseQortalLink("qortal://APP/Q-Tube+/video/Bob/qtube_vid_x/qc_comment")).toEqual({ kind: "qtube", name: "Bob", identifier: "qtube_vid_x" });
    expect(parseQortalLink(" qortal://APP/Q-Share/share/Bob/qshare_file_a_b_metadata ")).toEqual({ kind: "qshare", name: "Bob", identifier: "qshare_file_a_b_metadata" });
    expect(parseQortalLink("qortal://VIDEO/Bob/q-store-video-x")).toEqual({ kind: "video", name: "Bob", identifier: "q-store-video-x" });
    expect(parseQortalLink("qortal://FILE/Bob/f1")).toEqual({ kind: "file", name: "Bob", identifier: "f1" });
    expect(qtubeLink("Seller Name", "qtube_vid_ghee_abc")).toBe("qortal://APP/Q-Tube/video/Seller%20Name/qtube_vid_ghee_abc");
    expect(qshareLink("a+b", "id")).toBe("qortal://APP/Q-Share/share/a%2Bb/id");
  });

  it("are not anything else", () => {
    for (const link of [
      "https://example.com/video",
      "qortal://APP/Q-Shop/Bob/q-store-general-x",
      "qortal://APP/Q-Tube/video/Bob",
      "qortal://APP/Q-Tube/video/Bob/bad%20id",
      "qortal://VIDEO/Bob/<script>",
      `qortal://VIDEO/${"x".repeat(41)}/id`,
      "qortal://VIDEO/%E0%A4%A/id",
      null,
    ]) {
      expect(parseQortalLink(link)).toBeNull();
    }
  });
});

describe("embeds", () => {
  it("keep only well-formed data", () => {
    expect(embedFromData(embedData(video))).toEqual(video);
    expect(embedFromData(embedData(pdf))).toEqual(pdf);
    expect(embedFromData({ kind: "video", name: "Bob", identifier: "x y" })).toBeNull();
    expect(embedFromData({ kind: "script", name: "Bob", identifier: "x" })).toBeNull();
    // A link that isn't a qortal:// one, and a mimetype that isn't one, are left out.
    expect(embedFromData({ kind: "file", name: "Bob", identifier: "f", link: "javascript:alert(1)", mimetype: "x<y" })).toEqual({ kind: "file", name: "Bob", identifier: "f" });
  });
});

describe("a description as plain text and HTML", () => {
  it("goes from the original's plain text to the editor's HTML and back unchanged", () => {
    const text = "A mug.\nGlazed by hand, <so> every one is different.\n\nHolds 350 ml & more.";
    const html = plainToHtml(text);
    expect(html).toBe("<p>A mug.</p><p>Glazed by hand, &lt;so&gt; every one is different.</p><p><br></p><p>Holds 350 ml &amp; more.</p>");
    expect(htmlToPlainText(html)).toBe(text);
    expect(isPlainHtml(html)).toBe(true);
    expect(plainToHtml("")).toBe("");
    expect(htmlToPlainText("")).toBe("");
  });

  it("gives the original readable text for formatting, lists, links and embeds", () => {
    const html =
      "<h2>Ghee</h2><p>Slow-cooked <strong>Icelandic</strong> ghee.&nbsp; Read <a href=\"qortal://APP/Q-Blog/x\">our story</a>.</p>" +
      "<ul><li>Grass-fed</li><li>Small batches</li></ul><ol><li>Warm</li><li>Spread</li></ol><blockquote>Best ghee</blockquote>" +
      embedHtml(video) +
      embedHtml(pdf);
    expect(htmlToPlainText(html)).toBe(
      [
        "Ghee",
        "Slow-cooked Icelandic ghee.  Read our story (qortal://APP/Q-Blog/x).",
        "• Grass-fed",
        "• Small batches",
        "1. Warm",
        "2. Spread",
        "> Best ghee",
        `Video: Making ghee (${video.link})`,
        `PDF: Care guide (${pdf.link})`,
      ].join("\n")
    );
    expect(isPlainHtml(html)).toBe(false);
    expect(isPlainHtml("<p><strong>x</strong></p>")).toBe(false);
  });

  it("starts the editor from the formatted description, else the plain one", () => {
    expect(descriptionHtmlOf({ description: "Plain", htmlDescription: "<p><em>Rich</em></p>" })).toBe("<p><em>Rich</em></p>");
    expect(descriptionHtmlOf({ description: "Plain" })).toBe("<p>Plain</p>");
    expect(descriptionHtmlOf({ description: 5 })).toBe("");
  });
});

describe("a description made safe to show", () => {
  it("drops scripts, handlers, forms, pictures, styles and colours", () => {
    const clean = sanitizeDescription(
      '<p style="color: red; text-align: center" onclick="alert(1)">Hi<script>alert(1)</script><img src="https://x/y.png" onerror="alert(1)"></p>' +
        '<style>body{display:none}</style><form action="/x"><input name="a"></form><iframe src="/arbitrary/APP/x"></iframe><p id="root">x</p>'
    );
    expect(clean).toBe('<p style="text-align: center;">Hi</p><p>x</p>');
  });

  it("keeps qortal:// links, turns typed ones into links, makes web links copy themselves, and drops the rest", () => {
    const clean = sanitizeDescription(
      '<p><a href="QORTAL://APP/Q-Tube/video/A/b" target="_blank">video</a> see qortal://APP/Q-Shop/x too, <a href="https://example.com">site</a>, <a href="javascript:alert(1)">bad</a>, <a href="/render/APP/Other">frame</a></p>'
    );
    expect(clean).toContain('<a href="qortal://APP/Q-Tube/video/A/b">video</a>');
    expect(clean).toContain('<a href="qortal://APP/Q-Shop/x">qortal://APP/Q-Shop/x</a> too');
    expect(clean).toContain('<a href="https://example.com/" data-copy-link="" title="Copy web link (Hub can\'t open it)">site</a>');
    expect(clean).toContain(", bad, frame</p>");
  });

  it("rebuilds embeds from their checked data, and drops broken ones", () => {
    const clean = sanitizeDescription(
      `<div class="qshop-embed" data-kind="video" data-name="Seller Name" data-identifier="q-store-video-AbCdEf1234" data-title="Making ghee" data-evil="1" onclick="x()" style="position:fixed"><b>junk</b></div>` +
        `<div class="qshop-embed" data-kind="video" data-name="Seller Name" data-identifier="bad id">x</div>`
    );
    expect(clean).toBe(
      '<div class="qshop-embed" data-kind="video" data-name="Seller Name" data-identifier="q-store-video-AbCdEf1234" data-title="Making ghee">Video: Making ghee</div>'
    );
  });
});
