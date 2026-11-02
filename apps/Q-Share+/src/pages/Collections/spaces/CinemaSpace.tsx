import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { alpha, ThemeProvider } from "@mui/material/styles";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { coverUrl } from "../../../utils/collections";
import { SpaceShell, SpaceShowMore } from "./SpaceShell";
import { CinemaPlayer, cinemaQueue, entryKey } from "./cinemaPlayer";
import { CinemaFolders, CinemaSection, Poster, RAIL_MAX, posterNote, type PosterHandlers } from "./cinemaPosters";
import { cinemaTheme, filmFrame, REDUCED_MOTION } from "./cinemaTheme";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

const LANDSCAPE_PHONE = "@media (pointer: coarse) and (max-height: 500px)";
/** Wide enough for the words to sit beside the picture's subject; narrower, they go under it. */
const SIDE_BY_SIDE = "@media (min-width: 900px), (pointer: coarse) and (max-height: 500px)";
/** At most this much of the billboard holds words: the rest of the picture stays clear. */
const WORDS_WIDTH = "min(600px, 56%)";

interface BillboardProps {
  props: SpaceProps;
  featured: SpaceShare | null;
  onPlay: (share: SpaceShare) => void;
}

/**
 * The top of the stage: the picture as a screen in a dark room, its colour
 * spilling onto the walls behind everything.
 */
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
        minWidth: 0,
        [SIDE_BY_SIDE]: { minHeight: url ? 500 : 300, alignContent: "end" },
        [LANDSCAPE_PHONE]: { minHeight: 0 },
      }}
    >
      {src ? (
        // A quarter of the size, scaled up: the blur costs a phone little that way.
        <Box aria-hidden sx={{ position: "absolute", zIndex: -1, inset: "0 0 -180px", overflow: "hidden", maskImage: "linear-gradient(to bottom, black 55%, transparent)", pointerEvents: "none" }}>
          <img
            src={src}
            alt=""
            decoding="async"
            style={{ display: "block", width: "25%", height: "25%", objectFit: "cover", transform: "scale(4)", transformOrigin: "0 0", filter: "blur(20px)", opacity: 0.2 }}
          />
        </Box>
      ) : null}
      <Box
        aria-hidden
        sx={{
          position: "relative",
          overflow: "hidden",
          ...(url ? { aspectRatio: "16 / 9", maxHeight: "50vh" } : { height: 88 }),
          maskImage: "linear-gradient(to top, transparent, black 30%)",
          [SIDE_BY_SIDE]: { position: "absolute", inset: 0, aspectRatio: "auto", height: "auto", maxHeight: "none" },
        }}
      >
        <Box sx={[{ position: "absolute", inset: 0 }, filmFrame(props.collection.title) as never]} />
        {src ? (
          <Box
            component="img"
            src={src}
            alt=""
            decoding="async"
            onError={onError}
            sx={{
              position: "absolute",
              inset: 0,
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              animation: "cinema-fade 500ms ease both",
              "@keyframes cinema-fade": { from: { opacity: 0 }, to: { opacity: 1 } },
              [REDUCED_MOTION]: { animation: "none" },
            }}
          />
        ) : null}
      </Box>
      <Box
        sx={(theme) => ({
          position: "relative",
          zIndex: 1,
          minWidth: 0,
          px: { xs: 2, md: 4 },
          mt: url ? -5 : -2,
          pb: { xs: 2, md: 3 },
          // The scrim is on the words' own box, so it covers them however many lines they take.
          [SIDE_BY_SIDE]: {
            mt: 0,
            pt: 4,
            width: WORDS_WIDTH,
            boxSizing: "content-box",
            maxWidth: "calc(100% - 64px)",
            "&::before": {
              content: '""',
              position: "absolute",
              zIndex: -1,
              inset: "-160px -40% -48px 0",
              background: alpha(theme.palette.background.default, 0.86),
              maskImage: "linear-gradient(to right, black 62%, transparent), linear-gradient(to bottom, transparent, black 160px, black calc(100% - 48px), transparent)",
              maskComposite: "intersect",
              pointerEvents: "none",
            },
          },
          [LANDSCAPE_PHONE]: { pt: 2, pb: 1 },
        })}
      >
        {breadcrumb}
        <Typography
          component="h1"
          sx={{
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            fontSize: "clamp(2rem, 1.3rem + 3vw, 3.5rem)",
            overflowWrap: "anywhere",
            [LANDSCAPE_PHONE]: { fontSize: "1.625rem" },
          }}
        >
          {title}
        </Typography>
        {description ? (
          <>
            <Typography
              sx={{
                mt: 1,
                fontSize: "1rem",
                lineHeight: 1.5,
                color: "text.secondary",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                ...(wholeDescription
                  ? {}
                  : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden" }),
                [LANDSCAPE_PHONE]: wholeDescription ? {} : { WebkitLineClamp: 1, mt: 0.5 },
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
          <>
            <Box sx={{ mt: 2, minWidth: 0, [LANDSCAPE_PHONE]: { mt: 1 } }}>
              <Typography
                sx={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "warning.light" }}
              >
                Now showing
              </Typography>
              <Typography noWrap sx={{ mt: 0.25, fontSize: 17, fontWeight: 700 }}>
                {featured.title}
              </Typography>
              <Typography noWrap sx={{ fontSize: 13.5, color: "text.secondary" }}>
                {posterNote(featured)}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => onPlay(featured)}
                sx={{ minHeight: 48, minWidth: 136, fontSize: 16 }}
              >
                Play
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<InfoOutlinedIcon />}
                aria-label={`More info about ${featured.title}`}
                onClick={() => openShare(featured)}
                sx={(theme) => ({ minHeight: 48, fontSize: 16, color: "common.white", borderColor: alpha(theme.palette.common.white, 0.4), bgcolor: alpha(theme.palette.common.white, 0.1) })}
              >
                More info
              </Button>
            </Box>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

/** Edit, New folder and Delete stay out of Play's way: quiet until pointed at. */
const quietActions = {
  "& .MuiButton-root": { bgcolor: "transparent", color: "text.secondary", borderColor: "transparent", boxShadow: "none", px: 1.25 },
  "& .MuiButton-root:hover": { bgcolor: "action.hover", color: "text.primary", boxShadow: "none" },
  "& .MuiButton-colorError:hover": { color: "error.light" },
} as const;

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
  const phone = usePhoneLayout();

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
  // One or two posters don't fill a row: on a wide screen such rows share a line.
  const layoutFor = (count: number) => (!rail ? "grid" : !phone && count <= 2 ? "short" : "rail");

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
          isolation: "isolate",
          overflow: "clip",
          borderRadius: { md: 3 },
          boxShadow: { md: `0 18px 50px ${alpha(t.palette.common.black, 0.36)}` },
          // Edge to edge below the desktop's padding, up to the header on a phone.
          mx: { xs: -2, md: 0 },
          // A shadow, so the dark runs on under the bottom bar without making the page longer.
          [`@media ${PHONE_MEDIA}`]: { mt: -2, mb: -3, boxShadow: `0 240px 0 ${t.palette.background.default}` },
        })}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            // Above the end of the billboard's scrim.
            position: "relative",
            zIndex: 2,
            px: { xs: 2, md: 4 },
            pb: 1,
          }}
        >
          <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>{attribution}</Box>
          {actions ? <Box sx={{ ...quietActions, mx: -1.25, minWidth: 0 }}>{actions}</Box> : null}
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 3, md: 4 }, px: { xs: 2, md: 4 }, pt: 2, pb: { xs: 3, md: 5 } }}>
          <CinemaFolders folders={subfolders} onOpen={openFolder} />
          {emptyState}
          {films.length > 0 ? (
            <CinemaSection
              id="cinema-videos"
              title="Videos"
              count={films.length - items.pending || undefined}
              layout={rail ? "rail" : "grid"}
              busy={items.pending > 0}
            >
              {posters(films)}
            </CinemaSection>
          ) : null}
          {series.length > 0 || others.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: { xs: 3, md: 4 }, minWidth: 0 }}>
              {series.length > 0 ? (
                <CinemaSection id="cinema-series" title="Series" count={series.length} layout={layoutFor(series.length)}>
                  {posters(series)}
                </CinemaSection>
              ) : null}
              {others.length > 0 ? (
                <CinemaSection id="cinema-others" title="Also here" count={others.length} layout={layoutFor(others.length)}>
                  {posters(others)}
                </CinemaSection>
              ) : null}
            </Box>
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
