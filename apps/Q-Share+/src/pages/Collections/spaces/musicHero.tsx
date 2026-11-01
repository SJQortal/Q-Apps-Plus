import { useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import { useLandscapePhone, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { coverUrl } from "../../../utils/collections";
import { formatBytes } from "../../../utils/formatBytes";
import { heroWash, readImageTint } from "./musicTint";
import type { SpaceProps } from "./types";

/** A picture of the cover; the first one gives the hero its colour. */
function CoverTile({ url, onTint }: { url: string; onTint?: (tint: string) => void }) {
  const { src, onError } = useQdnImage(url);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      decoding="async"
      onError={onError}
      onLoad={(event) => {
        const tint = onTint ? readImageTint(event.currentTarget) : null;
        if (tint) onTint?.(tint);
      }}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", minWidth: 0, minHeight: 0 }}
    />
  );
}

/** The big square: this place's cover, or up to four of its shares' thumbnails, or a note on the theme's colour. */
function MusicCover({ url, thumbnails, size, onTint }: { url: string | null; thumbnails: string[]; size: number; onTint: (tint: string) => void }) {
  const theme = useTheme();
  const urls = url ? [url] : thumbnails.length >= 4 ? thumbnails.slice(0, 4) : thumbnails.slice(0, 1);
  return (
    <Box
      aria-hidden
      sx={{
        position: "relative",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 1.5,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        color: "primary.contrastText",
        boxShadow: `0 16px 48px ${alpha(theme.palette.common.black, 0.45)}`,
      }}
    >
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MusicNoteRoundedIcon sx={{ fontSize: Math.round(size * 0.45) }} />
      </Box>
      {urls.length > 0 ? (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", gridTemplate: urls.length > 1 ? "1fr 1fr / 1fr 1fr" : "1fr / 1fr" }}>
          {urls.map((one, index) => (
            <CoverTile key={one} url={one} onTint={index === 0 ? onTint : undefined} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

const titleSize = (title: string) => {
  const length = Array.from(title).length;
  if (length <= 24) return "clamp(2.25rem, 6vw, 4.5rem)";
  if (length <= 60) return "clamp(1.75rem, 4vw, 3rem)";
  return "clamp(1.375rem, 3vw, 2rem)";
};

/** "12 tracks · 48 MB", and "so far" while there are more to come. */
export function trackSummary(count: number, bytes: number, partial: boolean): string {
  const tracks = `${count} ${count === 1 ? "track" : "tracks"}${partial ? " so far" : ""}`;
  return bytes > 0 ? `${tracks} · ${formatBytes(bytes, 1)}` : tracks;
}

type HeroProps = Pick<SpaceProps, "folder" | "breadcrumb" | "title" | "description" | "attribution" | "cover"> & {
  thumbnails: string[];
  summary: string | null;
};

/**
 * The top of the page, edge to edge: a wash of the cover's own colour, or the
 * theme's without one, fading into the page. heroWash keeps its text readable,
 * so the page's ready-made breadcrumb and attribution can sit on it.
 */
export function MusicHero({ folder, breadcrumb, title, description, attribution, cover, thumbnails, summary }: HeroProps) {
  const theme = useTheme();
  const phone = usePhoneLayout();
  const landscape = useLandscapePhone();
  const [tint, setTint] = useState<string | null>(null);
  const { palette } = theme;
  const base = palette.background.default;
  const wash = heroWash(tint ?? palette.primary.main, base, [palette.text.primary, palette.text.secondary, palette.primary.main]) ?? base;
  const stacked = phone && !landscape;
  return (
    <Box
      component="section"
      aria-label={folder ? "About this folder" : "About this collection"}
      sx={{
        mx: { xs: -2, md: -3 },
        mt: { xs: -1.5, md: -2.5 },
        px: { xs: 2, md: 3 },
        pt: { xs: 2, md: 4 },
        pb: { xs: 1, md: 2 },
        background: `linear-gradient(180deg, ${wash} 0%, ${wash} 40%, ${base} 100%)`,
      }}
    >
      {breadcrumb}
      <Box
        sx={{
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          alignItems: stacked ? "stretch" : "flex-end",
          gap: stacked ? 2 : 3,
          mt: breadcrumb ? 1 : 0,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <MusicCover url={cover ? coverUrl(cover) : null} thumbnails={thumbnails} size={stacked ? 200 : phone ? 112 : 232} onTint={setTint} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {folder ? "Album" : "Playlist"}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: phone ? "clamp(1.375rem, 7vw, 2rem)" : titleSize(title),
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              my: 0.5,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </Typography>
          {description ? (
            <Typography sx={{ color: "text.secondary", whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 0.5 }}>{description}</Typography>
          ) : null}
          {attribution}
          {summary ? (
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {summary}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
