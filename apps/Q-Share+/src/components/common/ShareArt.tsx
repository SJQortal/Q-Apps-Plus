import { useEffect, useState, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { useQdnImage } from "../../hooks/useQdnImage";
import { CardPicture, RowIcon } from "../../pages/Home/FileList-styles";
import { fileKind } from "../../utils/fileKind";
import { shareThumbnail, type ShareThumbnail } from "../../utils/publishPayload";
import { resourceStatusDirect } from "../../utils/qdnResource";
import { useAppSettings } from "../../utils/settings";

/** Up to this size a share's own first image stands in for a thumbnail on a card, once it is on the node. */
export const CARD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
/** How long "not on the node" is believed before a card asks again. */
const NOT_ON_NODE_MS = 2 * 60_000;

interface ShareFileLike {
  name?: string;
  identifier?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  service?: string;
}

const thumbnailUrl = (t: ShareThumbnail) =>
  `/arbitrary/THUMBNAIL/${encodeURIComponent(t.name)}/${encodeURIComponent(t.identifier)}`;
const fileUrl = (f: Required<Pick<ShareFileLike, "name" | "identifier">>) =>
  `/arbitrary/FILE/${encodeURIComponent(f.name)}/${encodeURIComponent(f.identifier)}`;

/** The share's first small image, which a card may show when the share has no thumbnail. */
export function cardImage(files: unknown): (ShareFileLike & { name: string; identifier: string }) | null {
  if (!Array.isArray(files)) return null;
  const found = (files as ShareFileLike[]).find(
    (f) =>
      f &&
      typeof f.name === "string" &&
      typeof f.identifier === "string" &&
      // The picture is read as a FILE; a share JSON naming another service is left alone.
      (f.service === undefined || f.service === "FILE") &&
      fileKind(f.mimetype, f.filename) === "image" &&
      (f.size ?? 0) > 0 &&
      (f.size ?? 0) <= CARD_IMAGE_MAX_BYTES
  );
  return found ? (found as ShareFileLike & { name: string; identifier: string }) : null;
}

/**
 * Every chunk is on the node: READY, or DOWNLOADED / BUILDING (Core leaves a
 * local file unbuilt until something asks; the picture's GET with
 * `async=true` asks, and its retry shows it once built).
 */
const LOCAL = new Set(["READY", "DOWNLOADED", "BUILDING"]);

// One status check per image per while, shared by every card that shows it.
const onNode = new Map<string, { ready: Promise<boolean>; at: number }>();

/**
 * Whether the node holds the file already (a direct status GET, no Hub hop).
 * Cards never fetch an image from peers: a file that isn't local would hold
 * a node thread for about 15 s and then 404.
 */
export function isOnNode(file: { name: string; identifier: string }): Promise<boolean> {
  const key = `${file.name}/${file.identifier}`;
  const known = onNode.get(key);
  if (known && Date.now() - known.at < NOT_ON_NODE_MS) return known.ready;
  const ready = resourceStatusDirect({ service: "FILE", name: file.name, identifier: file.identifier }).then(
    (status) => LOCAL.has(status?.status),
    () => false
  );
  onNode.set(key, { ready, at: Date.now() });
  // A file that is there stays there: keep that answer for the session.
  void ready.then((yes) => {
    if (yes) onNode.set(key, { ready, at: Number.POSITIVE_INFINITY });
  });
  return ready;
}

/**
 * A card's picture: the share's thumbnail, or else its first image up to
 * 2 MB once the node has it (and image previews are on), over the category
 * icon `fallback`, which shows until the picture loads or if it can't.
 */
export function ShareCardArt({ share, fallback }: { share: any; fallback: ReactNode }) {
  const settings = useAppSettings();
  const thumb = shareThumbnail(share);
  const image = !thumb && settings.autoPreviewImages ? cardImage(share?.files) : null;
  const imageId = image?.identifier ?? null;
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    if (!inView || !image) return;
    let active = true;
    void isOnNode(image).then((yes) => {
      if (active && yes) setConfirmed(image.identifier);
    });
    return () => {
      active = false;
    };
    // The image is identified by its identifier; its object changes with every body read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, imageId]);

  const url = thumb ? thumbnailUrl(thumb) : image && confirmed === image.identifier ? fileUrl(image) : null;
  const { src, onError } = useQdnImage(url);
  return (
    <>
      {fallback}
      <span ref={ref} aria-hidden style={{ position: "absolute", inset: 0 }}>
        {src && <CardPicture src={src} alt="" loading="lazy" decoding="async" onError={onError} />}
      </span>
    </>
  );
}

/** A row's square: the share's thumbnail, else the category icon `fallback`. */
export function ShareRowArt({ share, fallback }: { share: any; fallback: ReactNode }) {
  const thumb = shareThumbnail(share);
  const { src, onError } = useQdnImage(thumb ? thumbnailUrl(thumb) : null);
  if (!src) return <>{fallback}</>;
  return <RowIcon src={src} alt="" loading="lazy" decoding="async" onError={onError} />;
}
