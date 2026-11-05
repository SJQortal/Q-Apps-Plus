/**
 * A product's description on its page: the seller's formatting (headings,
 * lists, links…), styled by the theme (after Q-Share+'s DisplayHtml), and its
 * videos and files, which show under the product's pictures (ProductMedia).
 * The HTML is made safe first (richtext/sanitize.ts), then cut into runs of
 * text and the blocks between them:
 *
 * - an embed (richtext/embeds.ts) plays or previews in place;
 * - a paragraph that is only a Q-Tube video link plays it, and one that is
 *   only a Q-Share link shows the share's files; both are read from QDN only
 *   once they scroll into view, and stay plain links if they can't be;
 * - qortal:// links open in a new Hub tab (QortalText.tsx useOpenQortalLink); web, mail and phone links copy themselves.
 *
 * A product with only the original's plain `description` shows it the same
 * way (a paragraph a line), so its Qortal links work too.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Box, Link, Skeleton, Typography } from "@mui/material";
import { sanitizeDescription } from "./sanitize";
import { EMBED_CLASS, embedFromData, parseQortalLink, type FileEmbed, type QortalEmbed, type QortalTarget, type VideoEmbed } from "./embeds";
import { descriptionHtmlOf } from "./plainText";
import { QortalVideo } from "./QortalVideo";
import { QortalFile } from "./QortalFile";
import { filesFromQshare, videoFromQtube } from "./qortalSources";
import { useOpenQortalLink } from "./QortalText";

export { RichText } from "./RichText";
import { RichText, useRichTextLinks } from "./RichText";

export type Segment = { kind: "html"; html: string } | { kind: "embed"; embed: QortalEmbed } | { kind: "link"; target: QortalTarget; href: string };

/** The cleaned HTML cut into runs of text, embeds and stand-alone Q-Tube/Q-Share links (see above). */
export function segmentsOf(clean: string): Segment[] {
  if (!clean) return [];
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, "text/html");
  const segments: Segment[] = [];
  let run = doc.createElement("div");
  const flush = () => {
    if (run.childNodes.length > 0) segments.push({ kind: "html", html: run.innerHTML });
    run = doc.createElement("div");
  };
  for (const node of Array.from(doc.body.childNodes)) {
    if (node instanceof HTMLElement && node.classList.contains(EMBED_CLASS)) {
      const embed = embedFromData({ ...node.dataset });
      if (embed) {
        flush();
        segments.push({ kind: "embed", embed });
        continue;
      }
    }
    if (node instanceof HTMLElement && node.tagName === "P") {
      const links = node.querySelectorAll("a");
      const only = links.length === 1 ? links[0] : null;
      const href = only?.getAttribute("href") ?? "";
      const target = only && (node.textContent ?? "").trim() === (only.textContent ?? "").trim() ? parseQortalLink(href) : null;
      if (target && (target.kind === "qtube" || target.kind === "qshare" || target.kind === "video" || target.kind === "file")) {
        flush();
        segments.push({ kind: "link", target, href });
        continue;
      }
    }
    run.append(node);
  }
  flush();
  return segments;
}

function PlainLink({ href }: { href: string }) {
  const open = useOpenQortalLink();
  return (
    <Typography component="p">
      <Link href={href} className="qortal-link" title="Opens in a new tab" onClick={(event) => open(event, href)} sx={{ wordBreak: "break-all" }}>
        {href}
      </Link>
    </Typography>
  );
}

type Resolved = { status: "loading" } | { status: "video"; embed: VideoEmbed } | { status: "files"; files: FileEmbed[] } | { status: "failed" };

/** A stand-alone Q-Tube or Q-Share link, read once it is on screen. */
function LinkedMedia({ target, href }: { target: QortalTarget; href: string }) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });
  const [resolved, setResolved] = useState<Resolved>(() =>
    target.kind === "video"
      ? { status: "video", embed: { kind: "video", name: target.name, identifier: target.identifier, link: href } }
      : target.kind === "file"
        ? { status: "files", files: [{ kind: "file", name: target.name, identifier: target.identifier, link: href }] }
        : { status: "loading" }
  );
  useEffect(() => {
    if (!inView || (target.kind !== "qtube" && target.kind !== "qshare")) return;
    let alive = true;
    const read =
      target.kind === "qtube"
        ? videoFromQtube(target.name, target.identifier).then((embed): Resolved => ({ status: "video", embed }))
        : filesFromQshare(target.name, target.identifier).then((share): Resolved => (share.files.length ? { status: "files", files: share.files } : { status: "failed" }));
    read.then(
      (result) => alive && setResolved(result),
      () => alive && setResolved({ status: "failed" })
    );
    return () => {
      alive = false;
    };
  }, [inView, target]);
  return (
    <Box ref={ref}>
      {resolved.status === "video" ? (
        <QortalVideo embed={resolved.embed} />
      ) : resolved.status === "files" ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {resolved.files.map((file) => (
            <QortalFile key={file.identifier} embed={file} />
          ))}
        </Box>
      ) : resolved.status === "failed" ? (
        <PlainLink href={href} />
      ) : (
        <Box>
          <Skeleton variant="rounded" height={target.kind === "qtube" ? 180 : 72} />
          <PlainLink href={href} />
        </Box>
      )}
    </Box>
  );
}

export type MediaItem = { kind: "embed"; embed: QortalEmbed } | { kind: "link"; target: QortalTarget; href: string };

export interface DescriptionParts {
  /** The text, in runs (videos and files taken out). */
  text: Segment[];
  videos: MediaItem[];
  attachments: MediaItem[];
}

const VIDEO_TARGETS = new Set(["qtube", "video"]);

/**
 * A product's description cut once into its text and its media: the videos
 * and the files (attachments) show under the product's pictures (Simon,
 * 2026-10-22), the text in the description.
 */
export function useDescriptionParts(product: { description?: unknown; htmlDescription?: unknown }): DescriptionParts {
  const html = descriptionHtmlOf(product, { markdown: true });
  return useMemo(() => {
    const parts: DescriptionParts = { text: [], videos: [], attachments: [] };
    for (const segment of segmentsOf(sanitizeDescription(html))) {
      if (segment.kind === "html") parts.text.push(segment);
      else if (segment.kind === "embed") (segment.embed.kind === "video" ? parts.videos : parts.attachments).push(segment);
      else (VIDEO_TARGETS.has(segment.target.kind) ? parts.videos : parts.attachments).push(segment);
    }
    return parts;
  }, [html]);
}

function Media({ item }: { item: MediaItem }) {
  if (item.kind === "link") return <LinkedMedia target={item.target} href={item.href} />;
  return item.embed.kind === "video" ? <QortalVideo embed={item.embed} /> : <QortalFile embed={item.embed} />;
}

/** The product's videos and attachments, each list with its heading; nothing when it has none. */
export function ProductMedia({ parts }: { parts: DescriptionParts }) {
  const videosId = useId();
  const filesId = useId();
  if (parts.videos.length === 0 && parts.attachments.length === 0) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
      {parts.videos.length > 0 && (
        <Box component="section" aria-labelledby={videosId} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography id={videosId} component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
            {parts.videos.length === 1 ? "Video" : "Videos"}
          </Typography>
          {parts.videos.map((item, i) => (
            <Media key={i} item={item} />
          ))}
        </Box>
      )}
      {parts.attachments.length > 0 && (
        <Box component="section" aria-labelledby={filesId} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography id={filesId} component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
            Attachments
          </Typography>
          {parts.attachments.map((item, i) => (
            <Media key={i} item={item} />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** The description's text (its videos and files show in ProductMedia). */
export function ProductDescription({ parts }: { parts: DescriptionParts }) {
  const copyLink = useRichTextLinks();

  if (parts.text.length === 0) {
    return <Typography color="text.secondary">{parts.videos.length || parts.attachments.length ? "See the videos and attachments." : "No description."}</Typography>;
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
      {parts.text.map((segment, i) => (segment.kind === "html" ? <RichText key={i} onClick={copyLink} dangerouslySetInnerHTML={{ __html: segment.html }} /> : null))}
    </Box>
  );
}
