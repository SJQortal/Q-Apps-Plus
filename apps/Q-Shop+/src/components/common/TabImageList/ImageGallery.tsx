/**
 * A product's pictures (up to 3, as the seller tools allow): the main one,
 * arrows and thumbnails, swipe on touch screens, ← and → keys, and a full
 * screen viewer (full-screen on phones) with the same controls and Esc.
 * Replaces the original's TabImageList, whose thumbnails were clickable
 * images with no keyboard access.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { ResponsiveDialog } from "../mobile";
import { LANDSCAPE_PHONE_MEDIA } from "../../../hooks/usePhoneLayout";

export const MAX_GALLERY_IMAGES = 3;
const SWIPE_PX = 40;

/**
 * The gallery's width (and so its square's height) on a phone held
 * sideways: the app frame's height less the header and bar, so the whole
 * picture fits one frame (about 148 px in Hub's 266 px frame), at most 42 %
 * of the width, never under 148 px. Full width it was a square of about
 * 800 px.
 */
export const GALLERY_LANDSCAPE_WIDTH = "min(42vw, max(148px, calc(var(--qshare-app-height, 100dvh) - 120px)))";
const LANDSCAPE = `@media ${LANDSCAPE_PHONE_MEDIA}`;

const arrowSx = (side: "left" | "right") =>
  ({
    position: "absolute",
    top: "50%",
    [side]: 8,
    transform: "translateY(-50%)",
    width: 44,
    height: 44,
    bgcolor: "background.paper",
    color: "text.primary",
    border: 1,
    borderColor: "divider",
    "&:hover": { bgcolor: "background.paper" },
  }) as const;

function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current;
      const touch = event.changedTouches[0];
      start.current = null;
      if (!from || !touch) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
    },
  };
}

export function ImageGallery({ images, title, initialIndex = 0 }: { images: string[] | undefined; title: string; initialIndex?: number }) {
  const list = (images ?? []).filter((src) => typeof src === "string" && src).slice(0, MAX_GALLERY_IMAGES);
  const count = list.length;
  const [index, setIndex] = useState(() => (initialIndex >= 0 && initialIndex < count ? initialIndex : 0));
  const [viewerOpen, setViewerOpen] = useState(false);
  const at = count ? Math.min(index, count - 1) : 0;
  const go = (delta: number) => {
    if (count > 1) setIndex((i) => (Math.min(i, count - 1) + delta + count) % count);
  };
  const swipe = useSwipe(go);

  // ← and → in the viewer, wherever focus is inside it.
  useEffect(() => {
    if (!viewerOpen || count < 2) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowLeft") setIndex((i) => (Math.min(i, count - 1) - 1 + count) % count);
      if (event.key === "ArrowRight") setIndex((i) => (Math.min(i, count - 1) + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, count]);

  const onKeyDown = (event: KeyboardEvent) => {
    // The viewer's keys bubble here through its portal; the window listener has them.
    if (viewerOpen) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    }
  };

  if (count === 0) {
    return (
      <Box
        sx={{
          aspectRatio: "1 / 1",
          borderRadius: 2,
          bgcolor: "action.hover",
          color: "text.secondary",
          display: "grid",
          placeItems: "center",
          alignContent: "center",
          gap: 1,
          [LANDSCAPE]: { width: GALLERY_LANDSCAPE_WIDTH },
        }}
      >
        <ImageOutlinedIcon sx={{ fontSize: 48 }} />
        <Typography variant="body2">No pictures</Typography>
      </Box>
    );
  }

  const label = (i: number) => `${title}, picture ${i + 1} of ${count}`;

  return (
    <Box
      role="region"
      aria-roledescription="carousel"
      aria-label={`${title}: pictures`}
      onKeyDown={onKeyDown}
      sx={{ minWidth: 0, [LANDSCAPE]: { width: GALLERY_LANDSCAPE_WIDTH } }}
    >
      <Box
        {...swipe}
        sx={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 2, overflow: "hidden", bgcolor: "action.hover", touchAction: "pan-y" }}
      >
        <ButtonBase
          onClick={() => setViewerOpen(true)}
          aria-label={`Open picture ${at + 1} of ${count} full screen`}
          sx={{ width: "100%", height: "100%", display: "block", "&:focus-visible": { outline: 2, outlineColor: "text.primary", outlineOffset: -2 } }}
        >
          <Box component="img" src={list[at]} alt={label(at)} sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        </ButtonBase>
        {count > 1 && (
          <>
            <IconButton aria-label="Previous picture" onClick={() => go(-1)} sx={arrowSx("left")}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton aria-label="Next picture" onClick={() => go(1)} sx={arrowSx("right")}>
              <ChevronRightIcon />
            </IconButton>
            <Typography
              aria-hidden
              variant="caption"
              sx={{ position: "absolute", bottom: 8, right: 8, px: 1, py: 0.25, borderRadius: 4, bgcolor: "background.paper", color: "text.primary", fontWeight: 600 }}
            >
              {at + 1} / {count}
            </Typography>
          </>
        )}
      </Box>
      {count > 1 && (
        <Box role="group" aria-label="Pictures" sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          {list.map((src, i) => (
            <ButtonBase
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show picture ${i + 1} of ${count}`}
              aria-current={i === at ? "true" : undefined}
              sx={{
                width: 64,
                height: 64,
                borderRadius: 1.5,
                overflow: "hidden",
                border: 2,
                borderColor: i === at ? "text.primary" : "divider",
                bgcolor: "action.hover",
                "&:focus-visible": { outline: 2, outlineColor: "text.primary", outlineOffset: 2 },
                // Three fit under the smaller picture, still 44 px targets.
                [LANDSCAPE]: { width: 44, height: 44 },
              }}
            >
              <Box component="img" src={src} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </ButtonBase>
          ))}
        </Box>
      )}
      {viewerOpen && (
        <ResponsiveDialog open onClose={() => setViewerOpen(false)} title={count > 1 ? `${title} (${at + 1} of ${count})` : title} maxWidth="lg">
          <Box {...swipe} sx={{ position: "relative", touchAction: "pan-y", display: "flex", justifyContent: "center" }}>
            <Box
              component="img"
              src={list[at]}
              alt={label(at)}
              sx={{ width: "100%", height: "auto", maxHeight: "75dvh", objectFit: "contain", display: "block" }}
            />
            {count > 1 && (
              <>
                <IconButton aria-label="Previous picture" onClick={() => go(-1)} sx={arrowSx("left")}>
                  <ChevronLeftIcon />
                </IconButton>
                <IconButton aria-label="Next picture" onClick={() => go(1)} sx={arrowSx("right")}>
                  <ChevronRightIcon />
                </IconButton>
              </>
            )}
          </Box>
        </ResponsiveDialog>
      )}
    </Box>
  );
}

export default ImageGallery;
