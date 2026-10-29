import { describe, expect, it } from "vitest";
import { hasFormatting, inlineMarkdown, looksLikeMarkdown, markdownToHtml } from "./markdown";
import { sanitizeDescription } from "./sanitize";
import { descriptionHtmlOf } from "./plainText";

describe("Markdown in descriptions", () => {
  it("knows text written with it from plain text", () => {
    expect(looksLikeMarkdown("## Matcha\nGrown in Uji.")).toBe(true);
    expect(looksLikeMarkdown("Made with **organic** leaves")).toBe(true);
    expect(looksLikeMarkdown("- 30 g\n- 100 g")).toBe(true);
    expect(looksLikeMarkdown("See [the farm](https://example.com)")).toBe(true);
    expect(looksLikeMarkdown("> Best matcha I've had")).toBe(true);
    expect(looksLikeMarkdown("A mug.\nGlazed by hand, so every one is different.")).toBe(false);
    expect(looksLikeMarkdown("- one line with a dash")).toBe(false);
    expect(looksLikeMarkdown("Price: 5 * 3 = 15, file_name_here")).toBe(false);
    expect(looksLikeMarkdown("")).toBe(false);
  });

  it("formats a line's bold, italic, strikethrough, code and links", () => {
    expect(inlineMarkdown("**Bold** and *italic*, _too_, ~~old~~ and `a*b*c`")).toBe(
      "<strong>Bold</strong> and <em>italic</em>, <em>too</em>, <s>old</s> and <code>a*b*c</code>"
    );
    expect(inlineMarkdown("snake_case_name and 2*3*4")).toBe("snake_case_name and 2*3*4");
    expect(inlineMarkdown("[Shop](qortal://APP/Q-Shop) and [web](https://a.b/c?x=1&y=2)")).toBe(
      '<a href="qortal://APP/Q-Shop">Shop</a> and <a href="https://a.b/c?x=1&amp;y=2">web</a>'
    );
    expect(inlineMarkdown("\\*not italic\\*")).toBe("*not italic*");
  });

  it("never makes a link to another kind of address, nor loads a picture", () => {
    expect(inlineMarkdown("[click](javascript:alert(1))")).toBe("click");
    expect(inlineMarkdown("![the jar](https://tracker.example/pixel.png)")).toBe("the jar");
    expect(inlineMarkdown("<script>alert(1)</script> **x**")).toBe("&lt;script&gt;alert(1)&lt;/script&gt; <strong>x</strong>");
  });

  it("makes headings, nested lists, quotes and code blocks, a paragraph a line", () => {
    const html = markdownToHtml(
      [
        "# Ceremonial matcha",
        "Stone-ground in Uji.",
        "Whisk it, don't stir.",
        "",
        "### What's in the tin",
        "- 30 g of **matcha**",
        "  - first harvest",
        "- [x] organic",
        "1. Sift",
        "2. Whisk",
        "> Smooth, not bitter",
        "> — a buyer",
        "---",
        "```",
        "<b>keep</b>",
        "```",
      ].join("\n")
    );
    expect(html).toBe(
      "<h2>Ceremonial matcha</h2><p>Stone-ground in Uji.</p><p>Whisk it, don&#39;t stir.</p>".replace("&#39;", "'") +
        "<h3>What's in the tin</h3>" +
        "<ul><li>30 g of <strong>matcha</strong><ul><li>first harvest</li></ul></li><li>☑ organic</li></ul>" +
        "<ol><li>Sift</li><li>Whisk</li></ol>" +
        "<blockquote>Smooth, not bitter<br>— a buyer</blockquote>" +
        "<pre>&lt;b&gt;keep&lt;/b&gt;</pre>"
    );
    // Made safe like any description, and still formatted.
    expect(sanitizeDescription(html)).toContain("<strong>matcha</strong>");
  });

  it("shows a plain description written with it formatted on its page, and keeps the editor's start as written", () => {
    const product = { description: "## Notes\n- grassy\n- sweet" };
    expect(descriptionHtmlOf(product, { markdown: true })).toBe("<h2>Notes</h2><ul><li>grassy</li><li>sweet</li></ul>");
    expect(descriptionHtmlOf(product)).toBe("<p>## Notes</p><p>- grassy</p><p>- sweet</p>");
    // A formatted description stays as it was formatted.
    expect(descriptionHtmlOf({ description: "Notes", htmlDescription: "<h2>Notes</h2>" }, { markdown: true })).toBe("<h2>Notes</h2>");
  });

  it("tells a paste with its own formatting from a text editor's", () => {
    expect(hasFormatting('<meta charset="utf-8"><div><span style="color:#ccc">**bold**</span></div>')).toBe(false);
    expect(hasFormatting("<p>A <strong>bold</strong> claim</p>")).toBe(true);
    expect(hasFormatting("")).toBe(false);
  });
});
