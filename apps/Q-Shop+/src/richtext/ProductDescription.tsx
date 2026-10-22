/**
 * A product's description on its page: the seller's formatting (headings,
 * lists, links…), its videos and files, styled by the theme (after Q-Share+'s
 * DisplayHtml). The HTML is made safe first (richtext/sanitize.ts), then cut
 * into runs of text and the blocks between them:
 *
 * - an embed (richtext/embeds.ts) plays or previews in place;
 * - a paragraph that is only a Q-Tube video link plays it, and one that is
 *   only a Q-Share link shows the share's files; both are read from QDN only
 *   once they scroll into view, and stay plain links if they can't be;
 * - qortal:// links open in Hub; web, mail and phone links copy themselves.
 *
 * A product with only the original's plain `description` shows it the same
 * way (a paragraph a line), so its Qortal links work too.
 */
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useDispatch } from "react-redux";
import { useInView } from "react-intersection-observer";
import { Box, Link, Skeleton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { setNotification } from "../state/features/notificationsSlice";
import { copyText } from "../utils/clipboard";
import { COPY_TEXT, copyTarget, sanitizeDescription } from "./sanitize";
import { EMBED_CLASS, embedFromData, parseQortalLink, type FileEmbed, type QortalEmbed, type QortalTarget, type VideoEmbed } from "./embeds";
import { descriptionHtmlOf } from "./plainText";
import { QortalVideo } from "./QortalVideo";
import { QortalFile } from "./QortalFile";
import { filesFromQshare, videoFromQtube } from "./qortalSources";

export const RichText = styled("div")(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  // Anyone can publish a description: keep anything it positions painted inside this box.
  contain: "paint",
  fontSize: 16,
  lineHeight: 1.6,
  color: theme.palette.text.primary,
  overflowWrap: "anywhere",
  "& > *": { margin: 0 },
  "& > * + *": { marginTop: theme.spacing(0.75) },
  "& h1": { fontSize: "1.5em", lineHeight: 1.25 },
  "& h2": { fontSize: "1.3em", lineHeight: 1.3 },
  "& h3": { fontSize: "1.15em" },
  "& h4, & h5, & h6": { fontSize: "1em" },
  "& ul, & ol": { paddingLeft: "1.5em" },
  "& ul": { listStyle: "disc" },
  "& ol": { listStyle: "decimal" },
  "& blockquote": {
    borderLeft: `4px solid ${theme.palette.divider}`,
    margin: 0,
    paddingLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  "& pre": {
    background: theme.palette.action.hover,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(1, 1.5),
    whiteSpace: "pre-wrap",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.875em",
  },
  "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  "& a": { color: theme.palette.primary.main, wordBreak: "break-all" },
  "& a[data-copy-link]": { cursor: "copy" },
  "& a[data-copy-link]::after": { content: ['"\\2197"', '"\\2197" / ""'], display: "inline-block", marginLeft: "0.15em", fontSize: "0.85em" },
  "& .ql-align-center": { textAlign: "center" },
  "& .ql-align-right": { textAlign: "right" },
  "& .ql-align-justify": { textAlign: "justify" },
  "& .ql-size-small": { fontSize: "0.75em" },
  "& .ql-size-large": { fontSize: "1.5em" },
  "& .ql-size-huge": { fontSize: "2em" },
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`& .ql-indent-${i + 1}:not(li)`, { paddingLeft: `${(i + 1) * 3}em` }])),
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`& li.ql-indent-${i + 1}`, { marginLeft: `${(i + 1) * 1.5}em` }])),
}));

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
  return (
    <Typography component="p">
      <Link href={href} className="qortal-link" sx={{ wordBreak: "break-all" }}>
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

export function ProductDescription({ product }: { product: { description?: unknown; htmlDescription?: unknown } }) {
  const dispatch = useDispatch();
  const html = descriptionHtmlOf(product);
  const segments = useMemo(() => segmentsOf(sanitizeDescription(html)), [html]);

  // qortal:// links keep their default (q-apps.js opens them in Hub); the others copy themselves.
  const copyLink = async (event: MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-copy-link]") : null;
    const target = link ? copyTarget(link.getAttribute("href") ?? "") : null;
    if (!target) return;
    event.preventDefault();
    const messages = COPY_TEXT[target.kind];
    const copied = await copyText(target.text);
    dispatch(setNotification(copied ? { msg: messages.copied, alertType: "success" } : { msg: messages.failed(target.text), alertType: "error" }));
  };

  if (segments.length === 0) return <Typography color="text.secondary">No description.</Typography>;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
      {segments.map((segment, i) =>
        segment.kind === "html" ? (
          <RichText key={i} onClick={copyLink} dangerouslySetInnerHTML={{ __html: segment.html }} />
        ) : segment.kind === "embed" ? (
          segment.embed.kind === "video" ? (
            <QortalVideo key={i} embed={segment.embed} />
          ) : (
            <QortalFile key={i} embed={segment.embed} />
          )
        ) : (
          <LinkedMedia key={i} target={segment.target} href={segment.href} />
        )
      )}
    </Box>
  );
}
