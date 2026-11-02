import { memo, useCallback, useMemo, useState } from "react";
import { Box, Button, ListItemIcon, Menu, MenuItem, Typography } from "@mui/material";
import { alpha, darken, styled } from "@mui/material/styles";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import RemoveCircleOutlinedIcon from "@mui/icons-material/RemoveCircleOutlined";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { coverUrl } from "../../../utils/collections";
import { AlbumFolders } from "./albumFolders";
import { AlbumLightbox } from "./albumLightbox";
import { albumLayout, heroPhoto, heroSummary, sectionSummary, type AlbumEntry, type AlbumPhoto } from "./albumModel";
import { useAlbumPicture } from "./albumPicture";
import { JustifiedRows, OtherTile, PendingTile, PhotoTile, type OpenAlbumMenu } from "./albumTiles";
import { ShareOwnerActions, SpaceShell, SpaceShowMore } from "./SpaceShell";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

/** Tiles drawn at a time for one share; a share can hold hundreds of pictures. */
const SECTION_PAGE = 40;
/** This few pictures on the page are drawn large. */
const FEW_PHOTOS = 2;

/** A quiet small heading: Folders, Other shares. The pictures' own sections speak louder. */
const LABEL_SX = { fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "text.secondary" } as const;

const HeroFrame = styled("section")(({ theme }) => ({
  position: "relative",
  display: "flex",
  alignItems: "flex-end",
  overflow: "hidden",
  minHeight: "clamp(150px, 44vh, 460px)",
  // With no picture, a dark wash of the theme's colour: white reads on it in all four.
  backgroundImage: `linear-gradient(135deg, ${darken(theme.palette.primary.main, 0.5)}, ${darken(theme.palette.primary.dark, 0.72)})`,
  // Edge to edge below md, where the page's padding is spacing(2).
  margin: theme.spacing(0, -2),
  [theme.breakpoints.up("md")]: {
    margin: 0,
    borderRadius: Number(theme.shape.borderRadius) * 1.5,
  },
}));

const HeroWords = styled("div")(({ theme }) => ({
  position: "relative",
  width: "100%",
  "--album-fade": theme.spacing(10),
  padding: `var(--album-fade) ${theme.spacing(2)} ${theme.spacing(2)}`,
  color: theme.palette.common.white,
  // The scrim travels with the words, so a long title is covered all the way up, and fades above them with no edge.
  backgroundImage: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.8)}, ${alpha(theme.palette.common.black, 0.62)} calc(100% - var(--album-fade)), ${alpha(theme.palette.common.black, 0.28)} calc(100% - var(--album-fade) * 0.5), ${alpha(theme.palette.common.black, 0)})`,
  [theme.breakpoints.up("md")]: {
    "--album-fade": theme.spacing(14),
    padding: `var(--album-fade) ${theme.spacing(4)} ${theme.spacing(3.5)}`,
  },
}));

/** The big picture: the cover, or else one of the album's own that the node can show. */
function AlbumHero({ cover, title, kicker, summary, description, photo, flush }: {
  cover: SpaceProps["cover"];
  title: string;
  kicker: string;
  summary: string;
  description: string;
  photo: AlbumPhoto | null;
  /** Nothing above it: meet the phone's sub-header. */
  flush: boolean;
}) {
  const own = useQdnImage(cover ? coverUrl(cover) : null);
  const stand = useAlbumPicture(cover ? null : photo, true, false);
  const { src, onError } = cover ? own : stand;
  const [shown, setShown] = useState<string | null>(null);
  return (
    <HeroFrame aria-label={title} sx={flush ? { mt: -2 } : undefined}>
      {src ? (
        <Box
          component="img"
          src={src}
          alt=""
          decoding="async"
          onError={onError}
          onLoad={() => setShown(src)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "opacity 400ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
          style={{ opacity: shown === src ? 1 : 0 }}
        />
      ) : null}
      <HeroWords>
        <Typography sx={{ ...LABEL_SX, color: "inherit", mb: 0.75, fontSize: 13 }}>{kicker}</Typography>
        <Typography
          component="h1"
          sx={{
            color: "inherit",
            fontWeight: 700,
            fontSize: "clamp(1.75rem, 1.2rem + 2.6vw, 3.25rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ mt: 1, color: "inherit", fontSize: "clamp(0.95rem, 0.9rem + 0.3vw, 1.125rem)", lineHeight: 1.45, maxWidth: 680, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {description}
          </Typography>
        ) : null}
        {summary ? <Typography sx={{ mt: 1, color: "inherit", fontSize: 14 }}>{summary}</Typography> : null}
      </HeroWords>
    </HeroFrame>
  );
}

interface FlowProps {
  revealed: ReadonlySet<string>;
  onOpen: (key: string) => void;
  onMenu: OpenAlbumMenu;
  isOwner: boolean;
}

/** Pictures with no heading: each carries its share's title and the owner's menu. */
function AlbumRun({ entries, few, revealed, onOpen, onMenu, isOwner }: FlowProps & { entries: AlbumEntry[]; few: boolean }) {
  return (
    <JustifiedRows data-few={few || undefined} aria-label="Photos">
      {entries.map((entry) =>
        entry.type === "pending" ? (
          <PendingTile key={entry.key} />
        ) : (
          <PhotoTile
            key={entry.photo.key}
            photo={entry.photo}
            captioned
            revealed={revealed.has(entry.photo.file.identifier)}
            menu={isOwner}
            onOpen={onOpen}
            onMenu={onMenu}
          />
        )
      )}
    </JustifiedRows>
  );
}

/** A share with several pictures, under a small heading that opens it and holds the owner's buttons. */
const AlbumSection = memo(function AlbumSection({ share, photos, few, revealed, onOpen, onMenu, isOwner, onOpenShare, onMove, onRemove }: FlowProps & {
  share: SpaceShare;
  photos: AlbumPhoto[];
  few: boolean;
  onOpenShare: (key: string) => void;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
}) {
  const [limit, setLimit] = useState(SECTION_PAGE);
  const title = share.title || share.identifier;
  const left = photos.length - limit;
  return (
    <Box component="section" aria-label={title} sx={{ display: "flex", flexDirection: "column", gap: 1.25, minWidth: 0, mt: { xs: 1, md: 2 }, pt: 2, borderTop: 1, borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minHeight: 44 }}>
        {/* The title's button stretches over the small print too, for a 44 px target. */}
        <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
          <Typography component="h2" sx={{ fontSize: "clamp(1.25rem, 1.1rem + 0.7vw, 1.625rem)", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
            <Box
              component="button"
              type="button"
              onClick={() => onOpenShare(share.key)}
              sx={{
                appearance: "none",
                border: 0,
                display: "inline-block",
                // Padding given back in margin: a 44 px target that takes a line's room.
                py: "10px",
                px: 0,
                my: "-10px",
                background: "transparent",
                font: "inherit",
                color: "inherit",
                textAlign: "left",
                cursor: "pointer",
                overflowWrap: "anywhere",
                "&::after": { content: '""', position: "absolute", inset: 0 },
                "&:hover": { textDecoration: "underline", textUnderlineOffset: 3 },
                "&:focus-visible": { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
              }}
            >
              {title}
            </Box>
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
            {sectionSummary(share, photos.length)} · {share.user}
          </Typography>
        </Box>
        {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }} /> : null}
      </Box>
      <JustifiedRows data-few={few || undefined} aria-label={`Photos in ${title}`}>
        {photos.slice(0, limit).map((photo) => (
          <PhotoTile
            key={photo.key}
            photo={photo}
            captioned={false}
            revealed={revealed.has(photo.file.identifier)}
            menu={false}
            onOpen={onOpen}
            onMenu={onMenu}
          />
        ))}
      </JustifiedRows>
      {left > 0 ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
          <Button startIcon={<ExpandMoreRoundedIcon />} onClick={() => setLimit((count) => count + SECTION_PAGE)} sx={{ minHeight: 44 }}>
            Show more photos ({left})
          </Button>
        </Box>
      ) : null}
    </Box>
  );
});

/** The album space: a big cover, then the page's pictures edge to edge, and a dark room to see them in. */
export default function AlbumSpace(props: SpaceProps) {
  const { items, isOwner, onMove, onRemove, openShare, openProfile, openFolder, subfolders, cover, title, description, counts, breadcrumb, attribution, actions, emptyState } = props;
  const phone = usePhoneLayout();
  const { blocks, photos, others } = useMemo(() => albumLayout(items.shares), [items.shares]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; key: string } | null>(null);
  const menuShare = menu ? items.shares.find((share) => share.key === menu.key) : undefined;
  const few = photos.length <= FEW_PHOTOS && items.pending === 0 && !items.hasMore;

  const shares = items.shares;
  const onOpenShare = useCallback(
    (key: string) => {
      const share = shares.find((one) => one.key === key);
      if (share) openShare(share);
    },
    [shares, openShare]
  );
  const onMenu = useCallback<OpenAlbumMenu>((anchor, key) => setMenu({ anchor, key }), []);
  const onShown = useCallback((identifier: string) => {
    setRevealed((known) => (known.has(identifier) ? known : new Set(known).add(identifier)));
  }, []);
  const closeViewer = useCallback(() => setViewing(null), []);

  const flow = { revealed, onOpen: setViewing, onMenu, isOwner };
  const hero = (
    <>
      {breadcrumb}
      <AlbumHero
        cover={cover}
        title={title}
        kicker={props.folder ? "Album folder" : "Photo album"}
        summary={heroSummary(photos, items, counts)}
        description={description}
        photo={heroPhoto(photos)}
        flush={phone && !breadcrumb}
      />
    </>
  );

  return (
    <SpaceShell space={props.space} hero={hero} sx={{ gap: 2.5 }}>
      {attribution || actions ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
          <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>{attribution}</Box>
          {actions}
        </Box>
      ) : null}
      {subfolders.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography component="h2" sx={LABEL_SX}>
            Folders
          </Typography>
          <AlbumFolders folders={subfolders} openFolder={openFolder} />
        </Box>
      ) : null}
      {emptyState}
      {blocks.map((block) =>
        block.type === "run" ? (
          <AlbumRun key={block.key} entries={block.entries} few={few} {...flow} />
        ) : (
          <AlbumSection
            key={block.key}
            share={block.share}
            photos={block.photos}
            few={few}
            onOpenShare={onOpenShare}
            onMove={onMove}
            onRemove={onRemove}
            {...flow}
          />
        )
      )}
      {others.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography component="h2" sx={LABEL_SX}>
            {photos.length > 0 ? "Other shares" : "Shares"}
          </Typography>
          <Box
            component="ul"
            aria-label="Shares without photos"
            sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}
          >
            {others.map((share) => (
              <OtherTile key={share.key} share={share} menu={isOwner} onOpenShare={onOpenShare} onMenu={onMenu} />
            ))}
          </Box>
        </Box>
      ) : null}
      <SpaceShowMore items={items} />
      <Menu anchorEl={menu?.anchor} open={Boolean(menu && menuShare)} onClose={() => setMenu(null)}>
        {menuShare && onMove ? (
          <MenuItem
            aria-label={`Move ${menuShare.title || menuShare.identifier}`}
            onClick={() => {
              setMenu(null);
              onMove(menuShare.row);
            }}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon>
              <DriveFileMoveOutlinedIcon />
            </ListItemIcon>
            Move to a folder
          </MenuItem>
        ) : null}
        {menuShare ? (
          <MenuItem
            aria-label={`Remove ${menuShare.title || menuShare.identifier} from collection`}
            onClick={() => {
              setMenu(null);
              onRemove(menuShare.row);
            }}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon>
              <RemoveCircleOutlinedIcon />
            </ListItemIcon>
            Remove from collection
          </MenuItem>
        ) : null}
      </Menu>
      {viewing ? (
        <AlbumLightbox
          photos={photos}
          startKey={viewing}
          items={items}
          onClose={closeViewer}
          onShown={onShown}
          openShare={openShare}
          openProfile={openProfile}
        />
      ) : null}
    </SpaceShell>
  );
}
