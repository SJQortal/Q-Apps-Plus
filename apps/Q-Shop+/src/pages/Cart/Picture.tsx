import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";
import { useLoadedPictures } from "../../components/common/useLoadedPictures";
import { ProductImage } from "../../components/common/ProductImage";

/**
 * A square picture (a product image or a shop logo, data URLs from QDN) that
 * shows `fallback` instead of a broken image when there is none or it can't
 * be decoded. A logo is shown whole (`fit="contain"`); a product photo fills the square.
 * The square's backdrop goes once the picture is in, so a transparent background shows the page.
 */
export function Picture({
  src,
  alt,
  size,
  fallback,
  fit = "cover",
}: {
  src?: string;
  alt: string;
  size: number;
  fallback: ReactNode;
  fit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  const pictures = useLoadedPictures();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        overflow: "hidden",
        flexShrink: 0,
        bgcolor: show && pictures.isLoaded(src) ? "transparent" : "action.hover",
        color: "text.secondary",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {show && fit === "contain" ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={pictures.onLoad(src)}
          onError={() => setFailed(src ?? null)}
          sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      ) : show && src ? (
        // A product picture: a photo fills the square, a cut-out fits in it whole (ProductImage).
        <ProductImage src={src} alt={alt} loading="lazy" onLoad={pictures.onLoad(src)} onError={() => setFailed(src ?? null)} />
      ) : (
        fallback
      )}
    </Box>
  );
}
