/**
 * A Q-Tube video's own thumbnail (richtext/qortalSources.ts qtubeThumbnail),
 * read only while `enabled` (the video near the screen, or chosen in a
 * dialog). Null for any other video, until it is read, or when it can't be.
 */
import { useEffect, useState } from "react";
import { qtubeDocumentOf, qtubeThumbnail } from "./qortalSources";
import type { VideoEmbed } from "./embeds";

export function useQtubeThumbnail(embed: Pick<VideoEmbed, "name" | "identifier" | "link"> | null | undefined, enabled = true): string | null {
  const name = embed?.name ?? "";
  const identifier = embed?.identifier ?? "";
  const link = embed?.link;
  const key = `${name}\n${identifier}\n${link ?? ""}`;
  const [image, setImage] = useState<{ key: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!enabled || !name || !identifier || !qtubeDocumentOf({ name, identifier, link })) return;
    let alive = true;
    qtubeThumbnail({ name, identifier, link }).then(
      (src) => alive && setImage({ key, src }),
      () => alive && setImage({ key, src: null })
    );
    return () => {
      alive = false;
    };
  }, [enabled, key, name, identifier, link]);
  return image?.key === key ? image.src : null;
}
