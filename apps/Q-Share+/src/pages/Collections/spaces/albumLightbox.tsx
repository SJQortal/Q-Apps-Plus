import { useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { useDispatch, useStore } from "react-redux";
import { Box, Button, CircularProgress, Dialog, IconButton, LinearProgress, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { errorMessage, saveFromNode } from "../../../components/common/FileElement";
import { fileUrl } from "../../../components/common/ShareArt";
import { useFileOnNode } from "../../../hooks/useFileOnNode";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { QDN_IMAGE_RETRY_MS, useQdnImage } from "../../../hooks/useQdnImage";
import { setNotification } from "../../../state/features/notificationsSlice";
import type { RootState } from "../../../state/store";
import { isHubDecline } from "../../../utils/hubErrors";
import { MyContext, isFailedStatus } from "../../../wrappers/DownloadWrapper";
import type { AlbumPhoto } from "./albumModel";
import type { SpaceItems, SpaceShare } from "./useSpaceItems";

/** Read by screen readers only. */
const visuallyHidden = { position: "absolute", width: "1px", height: "1px", margin: "-1px", p: 0, border: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

const SWIPE_PX = 60;
/**
 * Stepping to a picture asks for it only if it stays on screen this long, so
 * flicking through a share doesn't start a fetch for each picture passed. A
 * fetch the viewer started stops when its picture leaves the screen, so at
 * most one runs however many pictures are looked at.
 */
export const STEP_SETTLE_MS = 350;

interface AlbumLightboxProps {
  photos: AlbumPhoto[];
  startKey: string;
  items: Pick<SpaceItems, "hasMore" | "pending" | "showMore" | "shares">;
  onClose: () => void;
  /** The picture has been drawn from the file: its tile can show it too. */
  onShown: (identifier: string) => void;
  openShare: (share: Pick<SpaceShare, "user" | "identifier">) => void;
  openProfile: (name: string) => void;
}

/** One picture at full size, getting it onto the node for this tap, then its caption. */
function LightboxPhoto({ photo, settle, onShown, onOpenShare, onOpenProfile }: {
  photo: AlbumPhoto;
  settle: number;
  onShown: (identifier: string) => void;
  onOpenShare: () => void;
  onOpenProfile: () => void;
}) {
  const { file, share } = photo;
  const phone = usePhoneLayout();
  const dispatch = useDispatch();
  const node = useFileOnNode(file, share.identifier);
  const { ensure } = node;
  const asked = useRef(false);
  const store = useStore<RootState>();
  const { cancelDownload } = useContext(MyContext);
  const { identifier } = file;
  // The fetch running is this viewer's, not one the file's Download started.
  const ours = useRef(false);
  const left = useRef(false);
  const [misses, setMisses] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchHere = useCallback(async () => {
    const entry = () => store.getState().global?.downloads?.[identifier];
    const before = entry();
    await ensure();
    const after = entry();
    if (after && after !== before && (!before || isFailedStatus(before.status?.status))) ours.current = true;
    // The status answer came after the viewer moved on.
    if (left.current && ours.current) cancelDownload(identifier);
  }, [ensure, store, identifier, cancelDownload]);

  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
      if (ours.current) cancelDownload(identifier);
    };
  }, [cancelDownload, identifier]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (asked.current) return;
      asked.current = true;
      void fetchHere();
    }, settle);
    return () => clearTimeout(timer);
  }, [fetchHere, settle]);

  const ready = node.state === "ready";
  const full = useQdnImage(ready ? fileUrl(file) : null);
  const thumb = useQdnImage(drawn ? null : photo.thumbnailUrl);
  const gaveUp = misses > QDN_IMAGE_RETRY_MS.length;
  const failed = node.state === "failed" || node.stopped;
  const name = file.filename || "Photo";
  const title = share.title || share.identifier;

  const save = async () => {
    setSaving(true);
    try {
      await saveFromNode({ name: file.name, service: "FILE", identifier: file.identifier }, { filename: file.filename, mimeType: file.mimetype, size: file.size });
    } catch (error) {
      if (!isHubDecline(error)) dispatch(setNotification({ msg: errorMessage(error, "Could not save the file"), alertType: "error" }));
    } finally {
      setSaving(false);
    }
  };

  const imageSx = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" } as const;
  const lightButton = { minWidth: 44, minHeight: 44, color: "common.white", "&.Mui-disabled": { color: (t: Theme) => alpha(t.palette.common.white, 0.45) } };

  return (
    <>
      <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
        {thumb.src && !drawn ? <Box component="img" src={thumb.src} alt="" onError={thumb.onError} sx={imageSx} /> : null}
        {full.src ? (
          <Box
            component="img"
            src={full.src}
            alt={name}
            onError={() => {
              setDrawn(false);
              setMisses((count) => count + 1);
              full.onError();
            }}
            onLoad={() => {
              setDrawn(true);
              onShown(file.identifier);
            }}
            sx={imageSx}
          />
        ) : null}
        {!drawn ? (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "min(320px, 70%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              p: 2,
              textAlign: "center",
              borderRadius: 1,
              bgcolor: (t) => alpha(t.palette.common.black, 0.7),
            }}
          >
            {failed || gaveUp ? (
              <>
                <Typography role="status" sx={{ fontSize: 14 }}>
                  {gaveUp ? "Couldn't show this photo. Download it instead." : node.statusText}
                </Typography>
                {failed ? (
                  <Button startIcon={<RefreshOutlinedIcon />} onClick={() => void fetchHere()} sx={lightButton}>
                    Try again
                  </Button>
                ) : null}
              </>
            ) : node.state === "fetching" ? (
              <>
                <LinearProgress
                  variant="determinate"
                  value={node.percent}
                  color="inherit"
                  aria-label={`${name} loading progress`}
                  sx={{ width: "100%", borderRadius: 1, height: 6 }}
                />
                <Typography role="status" aria-live="polite" sx={{ fontSize: 14 }}>
                  {node.statusText}
                </Typography>
              </>
            ) : (
              <CircularProgress color="inherit" size={28} aria-label="Loading photo" />
            )}
          </Box>
        ) : null}
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 1.5, sm: 2.5 },
          py: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1.3,
              overflow: "hidden",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              "@media (max-height: 500px)": { WebkitLineClamp: 1 },
            }}
          >
            {title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, fontSize: 13, color: (t) => alpha(t.palette.common.white, 0.78) }}>
            <Box
              component="button"
              type="button"
              onClick={onOpenProfile}
              sx={{
                appearance: "none",
                border: 0,
                background: "transparent",
                font: "inherit",
                color: "inherit",
                cursor: "pointer",
                p: 0,
                minHeight: phone ? 44 : undefined,
                minWidth: phone ? 44 : undefined,
                textAlign: "left",
                maxWidth: "60%",
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                "&:focus-visible": { outline: (t) => `2px solid ${t.palette.common.white}`, outlineOffset: 2 },
              }}
            >
              {share.user}
            </Box>
            <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              · {name}
            </Box>
          </Box>
        </Box>
        {phone ? (
          <>
            <Tooltip title="Open share">
              <IconButton aria-label="Open share" onClick={onOpenShare} sx={lightButton}>
                <OpenInNewRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <span>
                <IconButton aria-label={`Download ${name}`} disabled={!ready || saving} onClick={() => void save()} sx={lightButton}>
                  <DownloadOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </>
        ) : (
          <>
            <Button startIcon={<OpenInNewRoundedIcon />} onClick={onOpenShare} sx={lightButton}>
              Open share
            </Button>
            <Button startIcon={<DownloadOutlinedIcon />} disabled={!ready || saving} onClick={() => void save()} aria-label={`Download ${name}`} sx={lightButton}>
              {saving ? "Saving…" : "Download"}
            </Button>
          </>
        )}
      </Box>
    </>
  );
}

/**
 * The full-screen viewer: a dark room, a big picture, previous and next by
 * buttons, arrow keys and swipe. Nothing is fetched ahead of the picture
 * being looked at. Past the last picture, Next loads the next page of shares.
 */
export function AlbumLightbox({ photos, startKey, items, onClose, onShown, openShare, openProfile }: AlbumLightboxProps) {
  const theme = useTheme();
  const titleId = useId();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [key, setKey] = useState(startKey);
  const [stepped, setStepped] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [drag, setDrag] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const index = photos.findIndex((photo) => photo.key === key);
  const photo = index >= 0 ? photos[index] : null;
  const { hasMore, pending, showMore } = items;
  const shownShares = items.shares.length;
  const hasPrevious = index > 0;
  const hasNext = index >= 0 && (index < photos.length - 1 || hasMore || waiting);
  const nextPhotoKey = index >= 0 ? photos[index + 1]?.key : undefined;

  // Its share was removed or moved away while it was open.
  useEffect(() => {
    if (index < 0) onClose();
  }, [index, onClose]);

  // Next, past the end: keep loading pages until a picture turns up or none are left.
  if (waiting && nextPhotoKey) {
    setKey(nextPhotoKey);
    setStepped(true);
    setWaiting(false);
  } else if (waiting && pending === 0 && !hasMore) {
    setWaiting(false);
  }
  useEffect(() => {
    if (waiting && !nextPhotoKey && pending === 0 && hasMore) showMore();
  }, [waiting, nextPhotoKey, pending, hasMore, showMore, shownShares]);

  const go = (step: 1 | -1) => {
    if (index < 0) return;
    const next = photos[index + step];
    if (next) {
      setKey(next.key);
      setStepped(true);
      setWaiting(false);
    } else if (step === 1 && hasMore && !waiting) {
      setWaiting(true);
      showMore();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") go(-1);
    else if (event.key === "ArrowRight") go(1);
  };

  const onTouchStart = (event: TouchEvent) => {
    touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    setDrag(0);
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!touch.current) return;
    // A second finger is a pinch: leave it to the browser.
    if (event.touches.length !== 1) {
      touch.current = null;
      setDrag(0);
      return;
    }
    const dx = event.touches[0].clientX - touch.current.x;
    const dy = event.touches[0].clientY - touch.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setDrag(reducedMotion ? 0 : dx);
  };
  const onTouchEnd = (event: TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    setDrag(0);
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(end.clientY - start.y)) go(dx < 0 ? 1 : -1);
  };

  const onDark = {
    minWidth: 44,
    minHeight: 44,
    color: "common.white",
    "&:focus-visible": { outline: `2px solid ${theme.palette.common.white}`, outlineOffset: -2 },
  };
  const arrow = {
    ...onDark,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 1,
    bgcolor: alpha(theme.palette.common.black, 0.55),
    "&:hover": { bgcolor: alpha(theme.palette.common.black, 0.8) },
    "&.Mui-disabled": { display: "none" },
  };

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      onKeyDown={onKeyDown}
      aria-labelledby={titleId}
      transitionDuration={reducedMotion ? 0 : undefined}
      slotProps={{
        paper: {
          sx: {
            m: 0,
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            bgcolor: "common.black",
            color: "common.white",
            backgroundImage: "none",
            pt: "env(safe-area-inset-top, 0px)",
            pb: "env(safe-area-inset-bottom, 0px)",
            pl: "env(safe-area-inset-left, 0px)",
            pr: "env(safe-area-inset-right, 0px)",
          },
        },
      }}
    >
      <Box component="h2" id={titleId} sx={visuallyHidden}>
        Photo viewer
      </Box>
      <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", pl: { xs: 1.5, sm: 2.5 }, pr: 0.5, py: 0.25 }}>
        <Typography aria-live="polite" sx={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
          {index + 1} of {photos.length}
          {hasMore ? "+" : ""}
        </Typography>
        <Tooltip title="Close">
          <IconButton aria-label="Close" onClick={onClose} sx={onDark}>
            <CloseRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        data-testid="album-stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "pan-y pinch-zoom" }}
      >
        <Box
          sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
          style={{
            transform: drag ? `translateX(${drag}px)` : undefined,
            transition: drag || reducedMotion ? "none" : "transform 180ms ease",
          }}
        >
          {photo ? (
            <LightboxPhoto
              key={photo.key}
              photo={photo}
              settle={stepped ? STEP_SETTLE_MS : 0}
              onShown={onShown}
              onOpenShare={() => {
                onClose();
                openShare(photo.share);
              }}
              onOpenProfile={() => {
                onClose();
                openProfile(photo.share.user);
              }}
            />
          ) : null}
        </Box>
        <IconButton aria-label="Previous photo" disabled={!hasPrevious} onClick={() => go(-1)} sx={{ ...arrow, left: { xs: 4, sm: 16 } }}>
          <ChevronLeftRoundedIcon fontSize="large" />
        </IconButton>
        <IconButton aria-label="Next photo" disabled={!hasNext} onClick={() => go(1)} sx={{ ...arrow, right: { xs: 4, sm: 16 } }}>
          {waiting ? <CircularProgress color="inherit" size={24} aria-label="Loading more" /> : <ChevronRightRoundedIcon fontSize="large" />}
        </IconButton>
      </Box>
    </Dialog>
  );
}
