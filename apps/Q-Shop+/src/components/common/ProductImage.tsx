/**
 * A product picture that fills its square frame the right way (Simon: "product
 * pictures if transparent are nicely adjusted into the square frame"): a
 * photo with a background fills the square (cover); a cut-out with a
 * transparent background (a jar on nothing) is fitted whole, with a margin,
 * so it is never cropped at the edges. Which one it is shows once the picture
 * has loaded: its edge pixels are read from a small copy of it (product
 * pictures are data URLs, so the canvas may read them), once per picture per
 * session.
 *
 * The picture never sizes its frame (`contain: size`): fitted whole, a tall
 * cut-out's own height would otherwise stretch a square frame made with
 * aspect-ratio (Simon, 2026-10-24: "product images are stretched when the
 * images are transparent vertical ones"). The frame sets its size.
 */
import { useState, type SyntheticEvent } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

const transparentPictures = new Map<string, boolean>();
const SAMPLE = 24;

/** Whether the picture's edge is (partly) transparent: a cut-out rather than a photo. */
export function hasTransparentEdge(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !img.naturalWidth || !img.naturalHeight) return false;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
    let clear = 0;
    let edge = 0;
    for (let y = 0; y < SAMPLE; y++) {
      for (let x = 0; x < SAMPLE; x++) {
        if (x !== 0 && y !== 0 && x !== SAMPLE - 1 && y !== SAMPLE - 1) continue;
        edge++;
        if (data[(y * SAMPLE + x) * 4 + 3] < 200) clear++;
      }
    }
    // A cut-out: a good part of its edge is see-through (a stray transparent corner isn't).
    return clear / edge > 0.25;
  } catch {
    return false;
  }
}

export function ProductImage({
  src,
  alt,
  loading,
  sx,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
  sx?: SxProps<Theme>;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
  onError?: () => void;
}) {
  const [cutOut, setCutOut] = useState<boolean | undefined>(() => transparentPictures.get(src));
  const known = transparentPictures.has(src) ? transparentPictures.get(src) : cutOut;
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      draggable={false}
      onError={onError}
      onLoad={(event: SyntheticEvent<HTMLImageElement>) => {
        if (!transparentPictures.has(src)) {
          const found = hasTransparentEdge(event.currentTarget);
          transparentPictures.set(src, found);
          setCutOut(found);
        }
        onLoad?.(event);
      }}
      sx={[
        {
          width: "100%",
          height: "100%",
          display: "block",
          boxSizing: "border-box",
          contain: "size",
          objectFit: known ? "contain" : "cover",
          // A cut-out keeps a margin inside its frame.
          p: known ? "7%" : 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
}

/** For tests. */
export function resetProductImageFits(): void {
  transparentPictures.clear();
}
