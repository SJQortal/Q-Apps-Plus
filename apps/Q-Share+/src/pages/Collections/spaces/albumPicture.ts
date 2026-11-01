import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fileUrl, isOnNode } from "../../../components/common/ShareArt";
import { useQdnImage } from "../../../hooks/useQdnImage";
import type { RootState } from "../../../state/store";
import { useAppSettings } from "../../../utils/settings";
import type { AlbumPhoto } from "./albumModel";

/**
 * What a tile may show for a picture, without ever asking peers for it: the
 * share's thumbnail, the file itself once someone has opened it here, or a
 * small file the node already holds (and image previews are on).
 */
export function useAlbumPicture(photo: AlbumPhoto | null, inView: boolean, revealed: boolean) {
  const settings = useAppSettings();
  const file = photo?.file ?? null;
  const identifier = file?.identifier ?? null;
  const name = file?.name ?? null;
  const fetched = useSelector((state: RootState) =>
    identifier ? state.global.downloads?.[identifier]?.status?.status === "READY" : false
  );
  const thumbnail = photo?.thumbnailUrl ?? null;
  const ask = inView && !revealed && !fetched && !thumbnail && Boolean(photo?.previewable) && settings.autoPreviewImages;
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    if (!ask || !identifier || !name) return;
    let active = true;
    void isOnNode({ name, identifier }).then((yes) => {
      if (active && yes) setConfirmed(identifier);
    });
    return () => {
      active = false;
    };
  }, [ask, identifier, name]);

  let url: string | null = null;
  if (inView && file && identifier && name) {
    if (revealed || fetched || confirmed === identifier) url = fileUrl({ name, identifier });
    else url = thumbnail;
  }
  return useQdnImage(url);
}
