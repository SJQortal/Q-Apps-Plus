import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { alpha, ThemeProvider } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { coverUrl } from "../../../utils/collections";
import { SpaceShell, SpaceShowMore } from "./SpaceShell";
import { CinemaPlayer, cinemaQueue, entryKey } from "./cinemaPlayer";
import { CinemaFolders, CinemaSection, Poster, RAIL_MAX, type PosterHandlers } from "./cinemaPosters";
import { cinemaTheme, filmFrame, REDUCED_MOTION } from "./cinemaTheme";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

const LANDSCAPE_PHONE = "@media (pointer: coarse) and (max-height: 500px)";

interface BillboardProps {
  props: SpaceProps;
  featured: SpaceShare | null;
  onPlay: (share: SpaceShare) => void;
}

/** The top of the stage: a wide backdrop, and what's on over a scrim that grows with the words. */
function Billboard({ props, featured, onPlay }: BillboardProps) {
  const { title, description, breadcrumb, cover, openShare } = props;
  const url = featured?.thumbnailUrl ?? (cover ? coverUrl(cover) : null);
  const { src, onError } = useQdnImage(url);
  const [wholeDescription, setWholeDescription] = useState(false);
  // At 150 characters at most, only line breaks can run past the clamp.
  const longDescription = description.includes("\n");

  return (
    <Box
      component="section"
      aria-label={props.folder ? "About this folder" : "About this collection"}
      sx={{
        position: "relative",
        display: "grid",
        minHeight: 300,
        overflow: "hidden",
        // The wide shape is a floor: the words stack over it and may grow past it.
        "&::before": { content: '""', gridArea: "1 / 1", aspectRatio: "21 / 9" },
        [`@media ${PHONE_MEDIA}`]: { minHeight: 240, "&::before": { aspectRatio: "4 / 3" } },
        [LANDSCAPE_PHONE]: { minHeight: 0, "&::before": { display: "none" } },
      }}
    >
      <Box aria-hidden sx={[{ position: "absolute", inset: 0 }, filmFrame(props.collection.title) as never]}>
        {src ? (
          <Box
            component="img"
            src={src}
            alt=""
            decoding="async"
            onError={onError}
            sx={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              animation: "cinema-fade 500ms ease both",
              "@keyframes cinema-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
              [REDUCED_MOTION]: { animation: "none" },
            }}
          />
        ) : null}
      </Box>
      {/* The scrim is on the words' own box, so it covers them however many lines they take. */}
      <Box
        sx={(theme) => ({
          position: "relative",
          gridArea: "1 / 1",
          alignSelf: "end",
          minWidth: 0,
          px: { xs: 2, md: 4 },
          pt: 7,
          pb: { xs: 2, md: 3 },
          background: `linear-gradient(to top, ${theme.palette.background.default} 0, ${alpha(theme.palette.common.black, 0.82)} 45%, ${alpha(theme.palette.common.black, 0.78)} calc(100% - 56px), transparent 100%)`,
          [LANDSCAPE_PHONE]: { pt: 3 },
        })}
      >
        <Box sx={{ maxWidth: 720 }}>
          {breadcrumb}
          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              fontSize: "clamp(1.75rem, 1.2rem + 3vw, 3.25rem)",
              overflowWrap: "anywhere",
              [LANDSCAPE_PHONE]: { fontSize: "1.5rem" },
            }}
          >
            {title}
          </Typography>
          {featured ? (
            <Typography noWrap sx={{ mt: 0.75, fontSize: 14, fontWeight: 600, color: "text.secondary" }}>
              Featured: {featured.title}
            </Typography>
          ) : null}
          {description ? (
            <>
              <Typography
                sx={{
                  mt: 1,
                  color: "text.secondary",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  ...(wholeDescription
                    ? {}
                    : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }),
                  [LANDSCAPE_PHONE]: wholeDescription ? {} : { WebkitLineClamp: 2 },
                }}
              >
                {description}
              </Typography>
              {longDescription ? (
                <Button
                  size="small"
                  aria-expanded={wholeDescription}
                  onClick={() => setWholeDescription((whole) => !whole)}
                  sx={{ px: 0, minHeight: 44, minWidth: 0 }}
                >
                  {wholeDescription ? "Show less" : "Show all"}
                </Button>
              ) : null}
            </>
          ) : null}
          {featured ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => onPlay(featured)}
                sx={{ minHeight: 48, minWidth: 128, fontSize: 16 }}
              >
                Play
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<InfoOutlinedIcon />}
                aria-label={`More info about ${featured.title}`}
                onClick={() => openShare(featured)}
                sx={(theme) => ({ minHeight: 48, fontSize: 16, bgcolor: alpha(theme.palette.common.white, 0.1) })}
              >
                More info
              </Button>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * The cinema: a dark stage of its own in every theme, a billboard, rows of
 * posters, and a full-screen player. A poster fetches nothing but its picture;
 * a video is only asked for once someone taps Play.
 */
export default function CinemaSpace(props: SpaceProps) {
  const outer = useTheme();
  const theme = useMemo(() => cinemaTheme(outer), [outer]);
  const { items, isOwner, onMove, subfolders, attribution, actions, openFolder, openProfile, openShare, emptyState } = props;
  const [playing, setPlaying] = useState<string | null>(null);

  // The page's callbacks change with each of its renders; the posters' must not.
  const latest = useRef({ onMove, onRemove: props.onRemove, openShare });
  useEffect(() => {
    latest.current = { onMove, onRemove: props.onRemove, openShare };
  });
  const queue = useMemo(() => cinemaQueue(items.shares), [items.shares]);
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const handlers = useMemo<PosterHandlers>(
    () => ({
      play: (share) => {
        const first = queueRef.current.find((entry) => entry.share.key === share.key);
        if (first) setPlaying(entryKey(first));
      },
      open: (share) => latest.current.openShare(share),
      move: (row) => latest.current.onMove?.(row),
      remove: (row) => latest.current.onRemove(row),
    }),
    []
  );

  const films: SpaceShare[] = [];
  const series: SpaceShare[] = [];
  const others: SpaceShare[] = [];
  for (const share of items.shares) {
    const gone = share.deleted || share.unreadable;
    // A share on its way waits with the videos, where most of them will land.
    if (!share.loaded && !share.unavailable) films.push(share);
    else if (gone || share.videos.length === 0) others.push(share);
    else if (share.videos.length > 1) series.push(share);
    else films.push(share);
  }
  const withVideo = items.shares.filter((share) => queue.some((entry) => entry.share.key === share.key));
  const featured = withVideo.find((share) => share.thumbnailUrl) ?? withVideo[0] ?? null;
  // Decided on the total, so a page doesn't change layout while its bodies land.
  const rail = items.total <= RAIL_MAX;

  const posters = (shares: SpaceShare[]) =>
    shares.map((share) => (
      <Poster key={share.key} share={share} isOwner={isOwner} canMove={Boolean(onMove)} handlers={handlers} />
    ));

  return (
    <ThemeProvider theme={theme}>
      <SpaceShell
        space={props.space}
        hero={<Billboard props={props} featured={featured} onPlay={handlers.play} />}
        sx={(t) => ({
          gap: 0,
          color: "text.primary",
          bgcolor: "background.default",
          backgroundImage: `radial-gradient(90% 420px at 50% 100%, ${alpha(t.palette.secondary.main, 0.1)}, transparent)`,
          overflow: "clip",
          borderRadius: { md: 3 },
          boxShadow: { md: `0 18px 50px ${alpha(t.palette.common.black, 0.36)}` },
          // Edge to edge below the desktop's padding, up to the header on a phone.
          mx: { xs: -2, md: 0 },
          [`@media ${PHONE_MEDIA}`]: { mt: -2, mb: -3 },
        })}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            px: { xs: 2, md: 4 },
            pb: 1,
          }}
        >
          <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>{attribution}</Box>
          {actions}
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 }, px: { xs: 2, md: 4 }, pt: 2, pb: { xs: 3, md: 5 } }}>
          <CinemaFolders folders={subfolders} onOpen={openFolder} />
          {emptyState}
          {films.length > 0 ? (
            <CinemaSection
              id="cinema-videos"
              title="Videos"
              count={films.length - items.pending || undefined}
              rail={rail}
              busy={items.pending > 0}
            >
              {posters(films)}
            </CinemaSection>
          ) : null}
          {series.length > 0 ? (
            <CinemaSection id="cinema-series" title="Series" count={series.length} rail={rail}>
              {posters(series)}
            </CinemaSection>
          ) : null}
          {others.length > 0 ? (
            <CinemaSection id="cinema-others" title="Also here" count={others.length} rail={rail}>
              {posters(others)}
            </CinemaSection>
          ) : null}
          <SpaceShowMore items={items} />
        </Box>
      </SpaceShell>
      {playing ? (
        <CinemaPlayer
          queue={queue}
          current={playing}
          onSelect={setPlaying}
          onClose={() => setPlaying(null)}
          onOpenShare={openShare}
          onOpenProfile={openProfile}
          onShowMore={items.hasMore ? items.showMore : undefined}
        />
      ) : null}
    </ThemeProvider>
  );
}
