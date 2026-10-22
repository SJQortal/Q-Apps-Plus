import { useState, type ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * A square picture (a product image or a shop logo, data URLs from QDN) that
 * shows `fallback` instead of a broken image when there is none or it can't
 * be decoded.
 */
export function Picture({
  src,
  alt,
  size,
  fallback,
}: {
  src?: string;
  alt: string;
  size: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1,
        overflow: "hidden",
        flexShrink: 0,
        bgcolor: "action.hover",
        color: "text.secondary",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {show ? (
        <Box
          component="img"
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src ?? null)}
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        fallback
      )}
    </Box>
  );
}
