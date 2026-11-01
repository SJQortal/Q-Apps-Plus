import { memo, useState, type ReactNode } from "react";
import { useInView } from "react-intersection-observer";
import { Box, Button, CircularProgress, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import { keyframes, styled } from "@mui/material/styles";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import SaveAltOutlinedIcon from "@mui/icons-material/SaveAltOutlined";
import { useFileDownload } from "../../../components/common/FileElement";
import { trackTitle } from "../../../components/player/trackText";
import { useAudioCover } from "../../../hooks/useAudioCover";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import type { Track } from "../../../state/features/playerSlice";
import { fileKind, fileKindIconElement, fileKindLabel } from "../../../utils/fileKind";
import { formatBytes } from "../../../utils/formatBytes";
import { useAppSettings } from "../../../utils/settings";
import { trackKey } from "./musicQueue";
import { ShareOwnerActions } from "./SpaceShell";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

/** A long album shows this many tracks until asked; all of them still play. */
export const ALBUM_TRACKS_SHOWN = 30;

/** Which columns there are at this width. */
export interface TrackColumns {
  phone: boolean;
  /** Room for the album and size columns. */
  wide: boolean;
}

const columnCount = ({ phone, wide }: TrackColumns) => (phone ? 3 : wide ? 6 : 5);

const rise = keyframes({ "0%, 100%": { transform: "scaleY(0.35)" }, "50%": { transform: "scaleY(1)" } });

/** The current track's bars: moving while it plays, still when paused or for reduced motion. */
function Equaliser({ moving }: { moving: boolean }) {
  return (
    <Box aria-hidden sx={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", height: 16, color: "primary.main" }}>
      {[0, 180, 360].map((delay) => (
        <Box
          key={delay}
          sx={{
            width: 3,
            height: 16,
            bgcolor: "currentColor",
            borderRadius: 0.5,
            transformOrigin: "bottom",
            transform: "scaleY(0.5)",
            animation: moving ? `${rise} 900ms ease-in-out ${delay}ms infinite` : "none",
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
      ))}
    </Box>
  );
}

const Table = styled("table")(({ theme }) => ({
  width: "100%",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  borderSpacing: 0,
  "& > tbody + tbody": { borderTop: `1px solid ${theme.palette.divider}` },
}));

const HeadCell = styled("th")(({ theme }) => ({
  padding: theme.spacing(1),
  textAlign: "left",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Row = styled("tr")(({ theme }) => ({
  height: 56,
  transition: "background-color 120ms ease",
  "&:hover, &:focus-within": { backgroundColor: theme.palette.action.hover },
  "&[aria-current='true']": { backgroundColor: theme.palette.action.selected },
  [`@media ${PHONE_MEDIA}`]: { cursor: "pointer" },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  // The number gives way to a play icon when the row is pointed at or focused.
  "& .track-play": { display: "none" },
  "&:hover .track-number, &:focus-within .track-number": { display: "none" },
  "&:hover .track-play, &:focus-within .track-play": { display: "inline-flex" },
}));

const Cell = styled("td")(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  minWidth: 0,
  overflow: "hidden",
  verticalAlign: "middle",
}));

const clipped = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;

/** A quiet link-like button: an album's name, or a name's profile. */
const TextLink = styled("button")(({ theme }) => ({
  appearance: "none",
  display: "block",
  maxWidth: "100%",
  padding: 0,
  border: 0,
  background: "transparent",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  ...clipped,
  "&:hover": { textDecoration: "underline" },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
}));

const artBox = {
  position: "relative",
  flexShrink: 0,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 1,
  bgcolor: "action.hover",
  color: "text.secondary",
} as const;

const artImage = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } as const;

/** A track's square: the art inside the file once the node holds it (never fetched for this), else the share's thumbnail. */
function TrackArt({ track, share, overlay }: { track: Track; share: SpaceShare; overlay?: ReactNode }) {
  const settings = useAppSettings();
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
  const own = useAudioCover(track.name ? { name: track.name, identifier: track.identifier } : null, inView && settings.autoPreviewImages);
  const thumb = useQdnImage(inView && !own ? share.thumbnailUrl : null);
  const src = own ?? thumb.src;
  return (
    <Box ref={ref} aria-hidden sx={{ ...artBox, width: 44, height: 44 }}>
      <MusicNoteRoundedIcon fontSize="small" />
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={own ? undefined : thumb.onError} style={artImage} /> : null}
      {overlay ? (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.paper", opacity: 0.88 }}>
          {overlay}
        </Box>
      ) : null}
    </Box>
  );
}

/** A slim album header's or a compact row's square. */
function ShareArt({ share, fallback }: { share: SpaceShare; fallback: ReactNode }) {
  const { src, onError } = useQdnImage(share.thumbnailUrl);
  return (
    <Box aria-hidden sx={{ ...artBox, width: 40, height: 40 }}>
      {fallback}
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={onError} style={artImage} /> : null}
    </Box>
  );
}

/** The file's download machine as one small button: only a tap asks the node for the file. */
function TrackDownload({ track, jsonId, phone }: { track: Track; jsonId: string; phone: boolean }) {
  const { phase, percent, statusText, start, retry, save, saving } = useFileDownload(track, jsonId);
  const label = track.filename || "file";
  const size = phone ? 44 : 36;
  const button = (title: string, aria: string, onClick: () => void, icon: ReactNode, disabled = false) => (
    <Tooltip title={title}>
      <span>
        <IconButton aria-label={aria} onClick={onClick} disabled={disabled} sx={{ width: size, height: size, color: "text.secondary" }}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
  if (phase === "idle") return button("Download", `Download ${label}`, start, <DownloadOutlinedIcon fontSize="small" />);
  if (phase === "ready") return button("Save", `Save ${label}`, () => void save(), <SaveAltOutlinedIcon fontSize="small" />, saving);
  if (phase === "failed") return button(statusText, `Try downloading ${label} again`, start, <RefreshOutlinedIcon fontSize="small" />);
  if (phase === "stalled") return button(statusText, `Retry ${label}`, retry, <RefreshOutlinedIcon fontSize="small" />);
  return (
    <Tooltip title={statusText}>
      <Box role="status" aria-label={`${label}: ${statusText}`} sx={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={18} variant={phase === "building" ? "indeterminate" : "determinate"} value={percent} />
      </Box>
    </Tooltip>
  );
}

interface TrackRowProps {
  track: Track;
  number: number;
  share: SpaceShare;
  columns: TrackColumns;
  current: boolean;
  playing: boolean;
  onPlay: (track: Track) => void;
  onOpenShare: (share: SpaceShare) => void;
}

function TrackRow({ track, number, share, columns, current, playing, onPlay, onOpenShare }: TrackRowProps) {
  const { phone, wide } = columns;
  const title = trackTitle(track);
  const label = `${current ? (playing ? "Pause" : "Resume") : "Play"} ${title}`;
  const stateIcon = current && playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />;
  const equaliser = current ? <Equaliser moving={playing} /> : null;
  const size = track.size ? formatBytes(track.size, 1) : "";
  return (
    <Row
      aria-current={current ? "true" : undefined}
      // On a phone the whole row is the target; its own buttons do their own thing.
      onClick={
        phone
          ? (event) => {
              if (!(event.target as Element).closest("button, a")) onPlay(track);
            }
          : undefined
      }
    >
      {phone ? null : (
        <Cell sx={{ textAlign: "center", px: 0 }}>
          <IconButton aria-label={label} onClick={() => onPlay(track)} sx={{ width: 36, height: 36, color: "text.secondary" }}>
            <Box
              className="track-number"
              component="span"
              sx={{ fontSize: 14, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center" }}
            >
              {equaliser ?? number}
            </Box>
            <Box className="track-play" component="span" sx={{ alignItems: "center", color: "text.primary" }}>
              {stateIcon}
            </Box>
          </IconButton>
        </Cell>
      )}
      <Cell sx={{ px: phone ? 0 : 0.5 }}>
        {phone ? (
          <Box
            component="button"
            type="button"
            aria-label={label}
            onClick={() => onPlay(track)}
            sx={{ appearance: "none", display: "flex", p: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", borderRadius: 1 }}
          >
            <TrackArt track={track} share={share} overlay={equaliser} />
          </Box>
        ) : (
          <TrackArt track={track} share={share} />
        )}
      </Cell>
      <Cell>
        <Typography title={title} sx={{ ...clipped, fontSize: 15, fontWeight: current ? 700 : 500, lineHeight: 1.3 }}>
          {title}
        </Typography>
        {phone ? (
          <Typography variant="body2" sx={{ ...clipped, color: "text.secondary", fontSize: 13 }}>
            {[share.title, size].filter(Boolean).join(" · ")}
          </Typography>
        ) : null}
      </Cell>
      {wide && !phone ? (
        <Cell>
          <Box sx={{ color: "text.secondary", fontSize: 14 }}>
            <TextLink type="button" title={share.title} onClick={() => onOpenShare(share)}>
              {share.title}
            </TextLink>
          </Box>
        </Cell>
      ) : null}
      {phone ? null : (
        <Cell sx={{ textAlign: "right", color: "text.secondary", fontSize: 13, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{size}</Cell>
      )}
      <Cell sx={{ textAlign: "right", px: 0 }}>
        <TrackDownload track={track} jsonId={share.identifier} phone={phone} />
      </Cell>
    </Row>
  );
}

/** What a share with no track says about itself. */
export function shareNote(share: SpaceShare): string {
  if (share.deleted) return "Deleted by its publisher";
  if (share.unreadable) return "This share can't be read";
  if (share.unavailable) return "Not available right now. Open it to try again";
  const count = share.files.length;
  if (count === 0) return "No files";
  if (count > 1) return `${count} files, no audio`;
  return fileKindLabel(fileKind(share.files[0].mimetype, share.files[0].filename));
}

interface AlbumProps {
  share: SpaceShare;
  /** Each of the share's tracks' place in the queue. */
  numbers: number[];
  columns: TrackColumns;
  /** The current track's key when it is in this share, or null. */
  currentKey: string | null;
  /** Whether that track is playing. */
  playing: boolean;
  isOwner: boolean;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
  onPlay: (track: Track) => void;
  onOpenShare: (share: SpaceShare) => void;
  onOpenProfile: (name: string) => void;
}

/** One share's row of its own: its art, title, a line about it, and the owner's buttons. */
function ShareHead({ share, art, note, columns, isOwner, onMove, onRemove, onOpenShare, onOpenProfile }: {
  share: SpaceShare;
  art: ReactNode;
  note: string;
} & Pick<AlbumProps, "columns" | "isOwner" | "onMove" | "onRemove" | "onOpenShare" | "onOpenProfile">) {
  const { phone } = columns;
  const noteText = (
    <Typography component="span" variant="body2" sx={{ ...clipped, color: "text.secondary", fontSize: 13 }}>
      {note}
    </Typography>
  );
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, py: 0.5 }}>
      {art}
      <Box sx={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <Box sx={{ fontSize: 14, fontWeight: 700, minHeight: phone ? 44 : undefined, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <TextLink
            type="button"
            title={share.title}
            onClick={() => onOpenShare(share)}
            // The note is inside this button on a phone, and a label would hide it.
            aria-label={phone ? `Open ${share.title}, ${note}` : `Open ${share.title}`}
            // On a phone the note joins the button, so the two lines are one 44 px target.
            style={phone ? { minHeight: 44 } : undefined}
          >
            {share.title}
            {phone ? <Box component="span" sx={{ display: "block", fontWeight: 400, ...clipped }}>{noteText}</Box> : null}
          </TextLink>
        </Box>
        {phone ? null : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
            <Box component="span" sx={{ color: "text.secondary", fontSize: 13, fontWeight: 400, flexShrink: 1, minWidth: 0, maxWidth: "60%" }}>
              <TextLink type="button" title={share.user} onClick={() => onOpenProfile(share.user)} aria-label={`Shares by ${share.user}`}>
                {share.user}
              </TextLink>
            </Box>
            <Box component="span" aria-hidden sx={{ color: "text.secondary", fontSize: 13 }}>
              ·
            </Box>
            {noteText}
          </Box>
        )}
      </Box>
      {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} sx={{ color: "text.secondary", flexShrink: 0 }} /> : null}
    </Box>
  );
}

function AlbumGroupView({ share, numbers, columns, currentKey, playing, isOwner, onMove, onRemove, onPlay, onOpenShare, onOpenProfile }: AlbumProps) {
  const [all, setAll] = useState(false);
  const span = columnCount(columns);
  const head = { share, columns, isOwner, onMove, onRemove, onOpenShare, onOpenProfile };

  if (!share.loaded && !share.unavailable) {
    return (
      <tbody aria-hidden>
        <tr>
          <td colSpan={span}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1 }}>
              <Skeleton variant="rounded" width={40} height={40} sx={{ flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton width="45%" />
                <Skeleton width="25%" />
              </Box>
            </Box>
          </td>
        </tr>
      </tbody>
    );
  }

  const tracks = share.deleted || share.unreadable ? [] : share.audio;
  if (tracks.length === 0) {
    const kind = share.files[0] ? fileKind(share.files[0].mimetype, share.files[0].filename) : null;
    const fallback = kind && !share.deleted && !share.unreadable ? fileKindIconElement(kind, { fontSize: "small" }) : <MusicNoteRoundedIcon fontSize="small" />;
    return (
      <tbody>
        <tr>
          <td colSpan={span}>
            <ShareHead {...head} art={<ShareArt share={share} fallback={fallback} />} note={shareNote(share)} />
          </td>
        </tr>
      </tbody>
    );
  }

  const shown = all ? tracks : tracks.slice(0, ALBUM_TRACKS_SHOWN);
  return (
    <tbody>
      <tr>
        <th scope="rowgroup" colSpan={span} style={{ fontWeight: "inherit", paddingTop: 8 }}>
          <ShareHead
            {...head}
            art={<ShareArt share={share} fallback={<MusicNoteRoundedIcon fontSize="small" />} />}
            note={`${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`}
          />
        </th>
      </tr>
      {shown.map((track, index) => (
        <TrackRow
          key={`${trackKey(track)}/${index}`}
          track={track}
          number={numbers[index] + 1}
          share={share}
          columns={columns}
          current={currentKey === trackKey(track)}
          playing={playing}
          onPlay={onPlay}
          onOpenShare={onOpenShare}
        />
      ))}
      {shown.length < tracks.length ? (
        <tr>
          <td colSpan={span} style={{ textAlign: "center" }}>
            <Button size="small" onClick={() => setAll(true)} sx={{ minHeight: 44 }}>
              Show all {tracks.length} tracks
            </Button>
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

const sameShare = (a: SpaceShare, b: SpaceShare) =>
  a.key === b.key &&
  a.loaded === b.loaded &&
  a.title === b.title &&
  a.unavailable === b.unavailable &&
  a.deleted === b.deleted &&
  a.unreadable === b.unreadable &&
  a.files.length === b.files.length &&
  a.thumbnailUrl === b.thumbnailUrl;

/**
 * A share's slim header and tracks. SpaceView re-renders on every body that
 * lands, with new objects each time, so this compares what it draws. Its
 * callbacks are stable, and onMove only comes and goes with the folders.
 */
export const AlbumGroup = memo(
  AlbumGroupView,
  (a, b) =>
    sameShare(a.share, b.share) &&
    a.numbers.join() === b.numbers.join() &&
    a.columns.phone === b.columns.phone &&
    a.columns.wide === b.columns.wide &&
    a.currentKey === b.currentKey &&
    a.playing === b.playing &&
    a.isOwner === b.isOwner &&
    a.onMove === b.onMove &&
    a.onRemove === b.onRemove
);

/** The track table's frame: its columns and header; one AlbumGroup per share goes inside. */
export function TrackTable({ columns, children }: { columns: TrackColumns; children: ReactNode }) {
  const { phone, wide } = columns;
  const hidden = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)" } as const;
  return (
    <Table aria-label="Tracks">
      <colgroup>
        {phone ? null : <col style={{ width: 48 }} />}
        <col style={{ width: 56 }} />
        <col />
        {wide && !phone ? <col style={{ width: "30%" }} /> : null}
        {phone ? null : <col style={{ width: 88 }} />}
        <col style={{ width: phone ? 48 : 44 }} />
      </colgroup>
      <Box component="thead" sx={phone ? hidden : undefined}>
        <tr>
          {phone ? null : <HeadCell sx={{ textAlign: "center" }}>#</HeadCell>}
          <HeadCell><Box component="span" sx={hidden}>Art</Box></HeadCell>
          <HeadCell>Title</HeadCell>
          {wide && !phone ? <HeadCell>Album</HeadCell> : null}
          {phone ? null : <HeadCell sx={{ textAlign: "right" }}>Size</HeadCell>}
          <HeadCell><Box component="span" sx={hidden}>Download</Box></HeadCell>
        </tr>
      </Box>
      {children}
    </Table>
  );
}
