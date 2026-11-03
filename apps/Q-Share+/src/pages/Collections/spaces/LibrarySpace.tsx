import { memo, useCallback, useId, useMemo, useState, type ChangeEvent } from "react";
import {
  Box,
  Button,
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { alpha, lighten, type Theme } from "@mui/material/styles";
import { useSelector } from "react-redux";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShelvesIcon from "@mui/icons-material/ViewModuleOutlined";
import CatalogueIcon from "@mui/icons-material/ViewListOutlined";
import { ClearFieldButton } from "../../../components/common/ClearFieldButton";
import FileElement from "../../../components/common/FileElement";
import { OpenPdfButton, PreviewPanel, PreviewToggleButton, previewKind } from "../../../components/common/FilePreview";
import { BottomSheet } from "../../../components/common/mobile/BottomSheet";
import { DisplayHtml } from "../../../components/common/TextEditor/DisplayHtml";
import { LANDSCAPE_PHONE_MEDIA, PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { shareKey } from "../../../state/features/fileSlice";
import type { RootState } from "../../../state/store";
import { formatBytes } from "../../../utils/formatBytes";
import type { Collection, CollectionCover as Cover, CollectionFolder } from "../../../utils/collections";
import type { ShareFile } from "../../FileContent/FileRow";
import { CollectionCover } from "../CollectionCover";
import { folderCountLabel } from "../FolderGrid";
import {
  LIBRARY_SERIF,
  bookFormats,
  bookStatus,
  countLabel,
  filterBooks,
  formatBadge,
  libraryLook,
  readLibraryView,
  shelfSpines,
  sortBooks,
  totalBytes,
  writeLibraryView,
  type LibraryLook,
  type LibrarySort,
  type LibraryView,
} from "./libraryShelf";
import { BookCover, STILL, twoLines } from "./bookCover";
import { ItemCoverDialog } from "./ItemCoverDialog";
import { ShareOwnerActions, SpaceShell, SpaceShowMore } from "./SpaceShell";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

/** Files a book's panel lists at a time: each row is a download control. */
const FILE_PAGE = 20;
const LANDSCAPE = `@media ${LANDSCAPE_PHONE_MEDIA}`;

/**
 * The shelf under a row and the shadow on the wall behind it. Each book draws its own stretch and the
 * gap after it, so they don't overlap and darken, and the last runs on to the end of the row.
 */
const boardSx = (look: LibraryLook, theme: Theme) => ({
  "&::before": {
    content: '""',
    position: "absolute",
    top: "-14px",
    bottom: 0,
    left: 0,
    right: "calc(-1 * var(--shelf-gap))",
    background: `linear-gradient(to top, ${theme.palette.mode === "dark" ? alpha(look.boardEdge, 0.4) : alpha(look.board, 0.3)}, transparent 40%)`,
    zIndex: 0,
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: "100%",
    left: 0,
    right: "calc(-1 * var(--shelf-gap))",
    height: 20,
    background: `linear-gradient(to bottom, ${lighten(look.board, 0.14)} 0 1px, ${look.board} 1px 7px, ${look.boardEdge} 7px 11px, ${alpha(theme.palette.common.black, 0.2)} 11px, transparent)`,
    zIndex: 0,
  },
  "li:last-of-type > &::before, li:last-of-type > &::after": { right: "-100vw" },
});

interface BookProps {
  share: SpaceShare;
  look: LibraryLook;
  /** The cover the collection's owner chose for it, if any. */
  cover: Cover | undefined;
  onOpen: (key: string) => void;
}

const sameCover = (a: Cover | undefined, b: Cover | undefined) => a?.name === b?.name && a?.identifier === b?.identifier;

const sameBook = (a: SpaceShare, b: SpaceShare) =>
  a.key === b.key &&
  a.title === b.title &&
  a.loaded === b.loaded &&
  a.unavailable === b.unavailable &&
  a.deleted === b.deleted &&
  a.unreadable === b.unreadable &&
  a.thumbnailUrl === b.thumbnailUrl &&
  a.files.length === b.files.length;

/** One book on a shelf. The whole place is its button, so the tap reaches the caption too. */
const ShelfBook = memo(
  function ShelfBook({ share, look, cover, onOpen }: BookProps) {
    const status = bookStatus(share);
    if (!share.title) {
      return (
        <Box component="li" sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={(theme: Theme) => ({ position: "relative", ...boardSx(look, theme) })}>
            <Skeleton variant="rectangular" sx={{ position: "relative", zIndex: 1, width: "calc(100% - 4px)", height: "auto", aspectRatio: "2 / 3" }} />
          </Box>
          <Skeleton sx={{ mt: 3.25, width: "80%" }} />
        </Box>
      );
    }
    return (
      <Box
        component="li"
        sx={{
          position: "relative",
          minWidth: 0,
          "&:hover .library-book, &:focus-within .library-book": {
            transform: "translateY(-6px)",
            [STILL]: { transform: "none" },
          },
        }}
      >
        <Box sx={(theme: Theme) => ({ position: "relative", ...boardSx(look, theme) })}>
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <BookCover share={share} look={look} cover={cover} />
          </Box>
        </Box>
        <Box sx={{ pt: 3.25, minWidth: 0 }}>
          <Typography component="p" sx={{ ...twoLines(2), fontFamily: LIBRARY_SERIF, fontSize: 15, lineHeight: 1.25, fontWeight: 600, color: look.ink }}>
            {share.title}
          </Typography>
          <Typography component="p" sx={{ ...twoLines(status ? 2 : 1), mt: 0.25, fontSize: 13, color: look.quiet }}>
            {status ?? share.user}
          </Typography>
        </Box>
        <Box
          component="button"
          type="button"
          aria-haspopup="dialog"
          aria-label={`${share.title} by ${share.user}${status ? `. ${status}` : ""}`}
          onClick={() => onOpen(share.key)}
          sx={(theme: Theme) => ({
            position: "absolute",
            inset: 0,
            zIndex: 2,
            appearance: "none",
            p: 0,
            border: 0,
            borderRadius: 1,
            background: "transparent",
            cursor: "pointer",
            "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 4 },
          })}
        />
      </Box>
    );
  },
  (a, b) => a.look === b.look && a.onOpen === b.onOpen && sameCover(a.cover, b.cover) && sameBook(a.share, b.share)
);

interface CatalogueProps extends BookProps {
  isOwner: boolean;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
}

/** One line of the catalogue: a small cover, title, author, formats and size, and the owner's buttons. */
const CatalogueRow = memo(
  function CatalogueRow({ share, look, cover, onOpen, isOwner, onMove, onRemove }: CatalogueProps) {
    const status = bookStatus(share);
    const details = status ?? [bookFormats(share).join(", "), share.files.length ? formatBytes(totalBytes(share.files), 1) : ""].filter(Boolean).join(" · ");
    return (
      <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, borderBottom: `1px solid ${alpha(look.rule, 0.5)}` }}>
        {share.title ? (
          <Box
            component="button"
            type="button"
            aria-haspopup="dialog"
            aria-label={`${share.title} by ${share.user}${status ? `. ${status}` : ""}`}
            onClick={() => onOpen(share.key)}
            sx={(theme: Theme) => ({
              appearance: "none",
              flex: 1,
              minWidth: 0,
              minHeight: 76,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 0.5,
              py: 1,
              border: 0,
              background: "transparent",
              color: "inherit",
              font: "inherit",
              textAlign: "left",
              cursor: "pointer",
              transition: "background-color 150ms ease",
              [STILL]: { transition: "none" },
              "&:hover": { backgroundColor: theme.palette.action.hover },
              "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
            })}
          >
            <Box sx={{ width: 40, flexShrink: 0 }}>
              <BookCover share={share} look={look} cover={cover} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography component="span" sx={{ ...twoLines(2), fontFamily: LIBRARY_SERIF, fontSize: 16, lineHeight: 1.25, fontWeight: 600, color: look.ink }}>
                {share.title}
              </Typography>
              <Typography component="span" sx={{ ...twoLines(1), fontSize: 13, color: look.quiet }}>
                {share.user}
              </Typography>
              {details ? (
                <Typography component="span" sx={{ ...twoLines(1), fontSize: 12, color: look.quiet }}>
                  {details}
                </Typography>
              ) : null}
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 76, display: "flex", alignItems: "center", gap: 1.5, px: 0.5 }}>
            <Skeleton variant="rectangular" sx={{ width: 36, height: 54, flexShrink: 0 }} />
            <Skeleton sx={{ flex: 1 }} />
          </Box>
        )}
        {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} sx={{ color: look.quiet }} /> : null}
      </Box>
    );
  },
  (a, b) =>
    a.look === b.look &&
    a.onOpen === b.onOpen &&
    a.isOwner === b.isOwner &&
    a.onMove === b.onMove &&
    a.onRemove === b.onRemove &&
    sameCover(a.cover, b.cover) &&
    sameBook(a.share, b.share)
);

/** One file in a book's panel: its format, name and size, then Download and Read. */
function BookFile({ file, jsonId, look }: { file: ShareFile; jsonId: string; look: LibraryLook }) {
  const [open, setOpen] = useState(false);
  const preview = previewKind(file);
  // While the node fetches the file, its progress and words take the whole line, under nothing.
  const fetching = useSelector((state: RootState) => {
    const download = state.global?.downloads?.[file.identifier];
    return Boolean(download) && download?.status?.status !== "READY";
  });
  return (
    <Box component="li" sx={{ listStyle: "none", py: 1.25, borderTop: `1px solid ${alpha(look.rule, 0.5)}`, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            mt: 0.125,
            px: 0.75,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0.5,
            fontSize: 11,
            lineHeight: "18px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            color: "text.primary",
          }}
        >
          {formatBadge(file)}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="p" sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {file.filename}
          </Typography>
          <Typography component="p" sx={{ fontSize: 13, color: "text.secondary" }}>
            {formatBytes(file.size || 0, 1)}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1, "& > *": { flex: "1 1 120px", minWidth: 0 }, "& > .book-file-fetching": { flexBasis: "100%" } }}>
        <Box className={fetching ? "book-file-fetching" : undefined} sx={{ display: "flex", minWidth: 0 }}>
          <FileElement
            fileInfo={{
              name: file.name,
              service: file.service || "FILE",
              identifier: file.identifier,
              filename: file.filename,
              mimetype: file.mimetype,
              mimeType: file.mimetype,
              size: file.size,
            }}
            jsonId={jsonId}
          />
        </Box>
        {preview === "pdf" ? (
          <OpenPdfButton file={file} jsonId={jsonId} />
        ) : preview ? (
          <PreviewToggleButton kind={preview} open={open} onToggle={() => setOpen((was) => !was)} filename={file.filename} />
        ) : null}
      </Box>
      {preview && preview !== "pdf" ? <PreviewPanel file={file} kind={preview} open={open} jsonId={jsonId} /> : null}
    </Box>
  );
}

interface PanelProps {
  share: SpaceShare;
  look: LibraryLook;
  collection: Collection;
  cover: Cover | undefined;
  phone: boolean;
  titleId: string;
  onClose: () => void;
  isOwner: boolean;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
  openShare: SpaceProps["openShare"];
  openProfile: SpaceProps["openProfile"];
}

/** What a book's panel holds, in the side panel or the phone's sheet. */
function BookDetails({ share, look, collection, cover, phone, titleId, onClose, isOwner, onMove, onRemove, openShare, openProfile }: PanelProps) {
  const [fileCount, setFileCount] = useState(FILE_PAGE);
  const [coverOpen, setCoverOpen] = useState(false);
  const status = bookStatus(share);
  const body = share.body as { htmlDescription?: unknown; fullDescription?: unknown; description?: unknown } | undefined;
  const html = typeof body?.htmlDescription === "string" ? body.htmlDescription : "";
  const plain = [body?.fullDescription, body?.description].find((text) => typeof text === "string" && text) as string | undefined;
  const facts = [bookFormats(share).join(", "), share.files.length ? formatBytes(totalBytes(share.files), 1) : ""].filter(Boolean).join(" · ");
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexDirection: phone ? "row" : "column", position: "relative" }}>
        <Box sx={{ width: phone ? 96 : 176, flexShrink: 0, alignSelf: phone ? "flex-start" : "center" }}>
          <BookCover share={share} look={look} cover={cover} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, pr: phone ? 5 : 0, alignSelf: "stretch", textAlign: phone ? "left" : "center" }}>
          <Typography id={titleId} component="h2" sx={{ fontFamily: LIBRARY_SERIF, fontSize: phone ? 20 : 26, lineHeight: 1.2, fontWeight: 600, color: look.ink, overflowWrap: "anywhere" }}>
            {share.title}
          </Typography>
          <Button
            onClick={() => openProfile(share.user)}
            aria-label={`Published by ${share.user}`}
            sx={{ mt: 0.25, ml: phone ? -1 : 0, minHeight: 44, justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}
          >
            {share.user}
          </Button>
          {status ? (
            <Typography role="status" sx={{ color: look.quiet, fontSize: 14 }}>
              {status}
            </Typography>
          ) : facts ? (
            <Typography sx={{ color: look.quiet, fontSize: 13, letterSpacing: "0.02em" }}>{facts}</Typography>
          ) : null}
        </Box>
      </Box>

      {status ? null : html ? (
        <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <DisplayHtml html={html} />
        </Box>
      ) : plain ? (
        <Typography sx={{ fontFamily: LIBRARY_SERIF, fontSize: 16, lineHeight: 1.55, color: look.quiet, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{plain}</Typography>
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Button variant="contained" startIcon={<OpenInNewRoundedIcon />} onClick={() => openShare(share)} sx={{ minHeight: 44, flex: "1 1 auto" }}>
          Open share
        </Button>
        {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} /> : null}
      </Box>
      {/* The owner's own cover for this book, on this collection's shelves. */}
      {isOwner && !status ? (
        <>
          <Button
            variant="outlined"
            startIcon={<AddPhotoAlternateOutlinedIcon />}
            onClick={() => setCoverOpen(true)}
            sx={{ minHeight: 44, alignSelf: phone ? "stretch" : "flex-start", mt: -1 }}
          >
            {cover ? "Change cover" : "Add a cover"}
          </Button>
          <ItemCoverDialog
            open={coverOpen}
            onClose={() => setCoverOpen(false)}
            collection={collection}
            share={share}
            shape="book"
            preview={({ src, cover: chosen }) => <BookCover share={share} look={look} cover={chosen} src={src} />}
          />
        </>
      ) : null}

      {status || share.files.length === 0 ? null : (
        <Box component="section" aria-label="Files">
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: 14, mb: 0.75 }}>
            {countLabel(share.files.length, "file", "files")}
          </Typography>
          <Box component="ul" sx={{ m: 0, p: 0 }}>
            {share.files.slice(0, fileCount).map((file) => (
              <BookFile key={file.identifier} file={file} jsonId={share.identifier} look={look} />
            ))}
          </Box>
          {share.files.length > fileCount ? (
            <Button onClick={() => setFileCount((n) => n + FILE_PAGE)} sx={{ minHeight: 44, width: "100%" }}>
              Show more files ({share.files.length - fileCount})
            </Button>
          ) : null}
        </Box>
      )}
      <Tooltip title="Close">
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", top: phone ? 20 : 8, right: 8, width: 44, height: 44 }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

/** A book's details: a side panel, or a bottom sheet on phones. */
function BookPanel({ open, share, ...panel }: Omit<PanelProps, "share" | "phone" | "titleId"> & { open: boolean; share: SpaceShare | undefined }) {
  const phone = usePhoneLayout();
  const titleId = useId();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const inner = share ? <BookDetails key={share.key} share={share} phone={phone} titleId={titleId} {...panel} /> : null;
  if (phone) {
    return (
      <BottomSheet open={open} onClose={panel.onClose} ariaLabel={share?.title || "Book"}>
        {inner}
      </BottomSheet>
    );
  }
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={panel.onClose}
      transitionDuration={still ? 0 : undefined}
      slotProps={{
        paper: {
          role: "dialog",
          "aria-modal": true,
          "aria-labelledby": titleId,
          sx: { width: "min(440px, 100%)", p: 3, bgcolor: panel.look.room, backgroundImage: `radial-gradient(ellipse 100% 340px at 50% 0, ${panel.look.lamp}, transparent)` },
        },
      }}
    >
      {inner}
    </Drawer>
  );
}

/** A folder as a little shelf of its own: a row of spines, or its cover, on a board, beside its name. */
function ShelfTile({ folder, look, onOpen }: { folder: CollectionFolder; look: LibraryLook; onOpen: (id: string) => void }) {
  const theme = useTheme();
  const title = folder.title || "Untitled folder";
  const spines = useMemo(() => shelfSpines(theme, folder.id), [theme, folder.id]);
  return (
    <li style={{ minWidth: 0 }}>
      <Box
        component="button"
        type="button"
        aria-label={`Open folder ${title}`}
        onClick={() => onOpen(folder.id)}
        sx={{
          appearance: "none",
          width: "100%",
          height: "100%",
          minHeight: 84,
          display: "flex",
          alignItems: "center",
          gap: 1.75,
          px: 1.75,
          py: 1.25,
          border: `1px solid ${alpha(look.rule, 0.45)}`,
          borderRadius: 1,
          backgroundColor: alpha(look.board, 0.08),
          color: look.ink,
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          transition: "background-color 160ms ease, border-color 160ms ease",
          [STILL]: { transition: "none" },
          "&:hover": { backgroundColor: alpha(look.board, 0.2), borderColor: look.rule },
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        }}
      >
        <Box aria-hidden sx={{ flexShrink: 0, width: 76 }}>
          <Box sx={{ height: 54, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "1px", overflow: "hidden" }}>
            {folder.cover ? (
              <CollectionCover cover={folder.cover} kind="folder" size={50} />
            ) : (
              spines.map((spine, index) => (
                <Box
                  key={index}
                  sx={{
                    flexShrink: 0,
                    width: spine.width,
                    height: `${spine.height}%`,
                    borderRadius: "1px 1px 0 0",
                    bgcolor: spine.cloth,
                    backgroundImage: `linear-gradient(to bottom, transparent 14%, ${alpha(spine.foil, 0.75)} 14% 17%, transparent 17% 78%, ${alpha(spine.foil, 0.75)} 78% 81%, transparent 81%)`,
                  }}
                />
              ))
            )}
          </Box>
          <Box sx={{ height: 6, background: `linear-gradient(to bottom, ${look.board} 0 3px, ${look.boardEdge} 3px)`, borderRadius: "0 0 1px 1px" }} />
        </Box>
        <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
          <Box component="span" sx={{ ...twoLines(2), fontFamily: LIBRARY_SERIF, fontSize: 16, lineHeight: 1.25, fontWeight: 600 }}>
            {title}
          </Box>
          <Box component="span" sx={{ ...twoLines(1), mt: 0.25, fontSize: 13, color: look.quiet }}>
            {folderCountLabel(folder)}
          </Box>
        </Box>
      </Box>
    </li>
  );
}

/** A section's name, a rule running out from it, and what it holds. */
function SectionHead({ id, title, note, look }: { id: string; title: string; note?: string; look: LibraryLook }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, minWidth: 0 }}>
      <Typography id={id} component="h2" sx={{ fontFamily: LIBRARY_SERIF, fontWeight: 600, fontSize: 20, color: look.ink, flexShrink: 0 }}>
        {title}
      </Typography>
      <Box aria-hidden sx={{ flex: 1, minWidth: 12, height: "1px", bgcolor: alpha(look.rule, 0.55) }} />
      {note ? <Typography sx={{ flexShrink: 0, fontSize: 13, letterSpacing: "0.02em", color: look.quiet }}>{note}</Typography> : null}
    </Box>
  );
}

/** The collection's buttons, in the room's ink; Delete keeps quiet until it's pointed at. Hub 3.0 paints its main button with an image. */
const quietActions = (look: LibraryLook) => ({
  "& .MuiButton-root": { bgcolor: "transparent", backgroundImage: "none", color: look.ink, borderColor: alpha(look.rule, 0.7), boxShadow: "none" },
  "& .MuiButton-root:hover": { bgcolor: alpha(look.board, 0.2), backgroundImage: "none", borderColor: look.rule, boxShadow: "none" },
  "& .MuiButton-colorError": { color: look.quiet, borderColor: "transparent" },
  "& .MuiButton-colorError:hover": { bgcolor: "transparent", color: "error.main", borderColor: "transparent" },
});

/** The top of the room, set like a book's title page. */
function TitlePage({ props, look }: { props: SpaceProps; look: LibraryLook }) {
  const { cover, folder, breadcrumb, title, description, attribution, actions } = props;
  return (
    <Box component="section" aria-label={folder ? "About this folder" : "About this collection"} sx={{ minWidth: 0 }}>
      {breadcrumb}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, pt: { xs: 1.5, sm: 4 }, pb: { xs: 1, sm: 2 }, [LANDSCAPE]: { pt: 0.5, pb: 0, gap: 0.75, "& .library-flourish": { display: "none" } } }}>
        {cover ? <CollectionCover cover={cover} kind={folder ? "folder" : "collection"} size={96} /> : null}
        <Typography className="library-flourish" component="p" sx={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: look.quiet }}>
          {folder ? "A shelf" : "A library"}
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: LIBRARY_SERIF,
            fontWeight: 500,
            fontSize: "clamp(28px, 5vw, 48px)",
            [LANDSCAPE]: { fontSize: 26 },
            lineHeight: 1.12,
            letterSpacing: "-0.005em",
            maxWidth: "20em",
            color: look.ink,
            overflowWrap: "anywhere",
            textWrap: "balance",
          }}
        >
          {title}
        </Typography>
        <Box aria-hidden className="library-flourish" sx={{ width: 72, height: "1px", bgcolor: look.rule, my: 0.5 }} />
        {description ? (
          <Typography sx={{ fontFamily: LIBRARY_SERIF, fontSize: { xs: 16, sm: 18 }, lineHeight: 1.5, maxWidth: "36em", color: look.quiet, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {description}
          </Typography>
        ) : null}
        <Box sx={{ color: look.quiet, minWidth: 0, maxWidth: "100%", "& > *": { justifyContent: "center" } }}>{attribution}</Box>
        {actions ? <Box sx={{ display: "flex", justifyContent: "center", width: "100%", "& > *": { justifyContent: "center" }, ...quietActions(look) }}>{actions}</Box> : null}
      </Box>
    </Box>
  );
}

/** Find, sort, and shelf or catalogue. */
function Toolbar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  phone,
}: {
  query: string;
  onQuery: (value: string) => void;
  sort: LibrarySort;
  onSort: (value: LibrarySort) => void;
  view: LibraryView;
  onView: (value: LibraryView) => void;
  phone: boolean;
}) {
  const fieldSx = phone ? { "& .MuiInputBase-root": { minHeight: 44 } } : undefined;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, minWidth: 0 }}>
      <TextField
        size="small"
        label="Find a book"
        placeholder="Title or author"
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQuery(event.target.value)}
        sx={{ flex: "1 1 220px", minWidth: 0, ...fieldSx }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query ? <ClearFieldButton onClear={() => onQuery("")} label="Clear the book search" /> : undefined,
          },
        }}
      />
      <TextField
        select
        size="small"
        label="Sort"
        value={sort}
        onChange={(event) => onSort(event.target.value as LibrarySort)}
        sx={{ flex: { xs: "1 1 120px", sm: "0 0 140px" }, minWidth: 0, ...fieldSx }}
      >
        <MenuItem value="added">As added</MenuItem>
        <MenuItem value="title">By title</MenuItem>
      </TextField>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        aria-label="How to show the books"
        onChange={(_, next: LibraryView | null) => {
          if (next) onView(next);
        }}
      >
        <ToggleButton value="shelf" aria-label="Shelf" sx={{ minWidth: 44, minHeight: 40, [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } }}>
          <ShelvesIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="catalogue" aria-label="Catalogue" sx={{ minWidth: 44, minHeight: 40, [`@media ${PHONE_MEDIA}`]: { minHeight: 44 } }}>
          <CatalogueIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}

/** The library space: a warm reading room with books on shelves. */
export default function LibrarySpace(props: SpaceProps) {
  const { collection, items, isOwner, onMove, onRemove, openFolder, openShare, openProfile, subfolders, foldersSection, emptyState } = props;
  const theme = useTheme();
  const phone = usePhoneLayout();
  const look = useMemo(() => libraryLook(theme), [theme]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("added");
  const [view, setView] = useState<LibraryView>(readLibraryView);
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const books = useMemo(() => sortBooks(filterBooks(items.shares, query), sort), [items.shares, query, sort]);
  // The covers the owner chose, by share.
  const covers = useMemo(
    () => new Map((collection.itemCovers ?? []).map((entry) => [shareKey(entry.name, entry.identifier), entry.cover])),
    [collection.itemCovers]
  );
  // Found by key, so the panel follows a body landing and closes itself when the share is removed.
  const selectedShare = useMemo(() => items.shares.find((share) => share.key === selected), [items.shares, selected]);
  const searching = query.trim().length > 0;

  const openBook = useCallback((key: string) => {
    setSelected(key);
    setPanelOpen(true);
  }, []);
  const closeBook = useCallback(() => setPanelOpen(false), []);

  return (
    <SpaceShell
      space={props.space}
      hero={<TitlePage props={props} look={look} />}
      sx={{
        bgcolor: look.room,
        backgroundImage: `radial-gradient(ellipse 80% 460px at 50% 0, ${look.lamp}, transparent)`,
        color: look.ink,
        gap: 3,
        p: { xs: 1.5, sm: 3, md: 4 },
        borderRadius: 2,
        border: `1px solid ${alpha(look.rule, 0.45)}`,
      }}
    >
      {subfolders.length > 0 ? (
        <Box component="section" aria-labelledby="library-shelves" sx={{ minWidth: 0 }}>
          <SectionHead id="library-shelves" title="Shelves" note={countLabel(subfolders.length, "shelf", "shelves")} look={look} />
          <Box
            component="ul"
            aria-label="Folders"
            sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 264px), 1fr))" }}
          >
            {subfolders.map((folder) => (
              <ShelfTile key={folder.id} folder={folder} look={look} onOpen={openFolder} />
            ))}
          </Box>
        </Box>
      ) : foldersSection}

      {emptyState}

      {items.total > 0 ? (
        <Box sx={{ minWidth: 0 }}>
          <SectionHead id="library-books" title="Books" note={countLabel(items.total, "book", "books")} look={look} />
          {items.total > 1 ? (
            <Toolbar
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              view={view}
              onView={(next) => {
                setView(next);
                writeLibraryView(next);
              }}
              phone={phone}
            />
          ) : null}
        </Box>
      ) : null}

      {searching ? (
        <Typography role="status" sx={{ fontSize: 13, color: look.quiet, mt: -1.5 }}>
          {books.length === 0 ? "No books match" : `${countLabel(books.length, "book", "books")} found`}
          {items.hasMore ? `, in the first ${items.shares.length} of ${items.total}. Show more to search the rest.` : ""}
        </Typography>
      ) : null}

      {books.length === 0 ? null : view === "shelf" ? (
        <Box
          component="ul"
          aria-label="Books"
          aria-busy={items.pending > 0}
          sx={{
            "--shelf-gap": { xs: "14px", sm: "28px" },
            listStyle: "none",
            m: 0,
            pt: 2,
            px: 0,
            pb: 0,
            display: "grid",
            columnGap: "var(--shelf-gap)",
            rowGap: { xs: 3.5, sm: 5 },
            gridTemplateColumns: { xs: "repeat(auto-fill, minmax(92px, 1fr))", sm: "repeat(auto-fill, minmax(136px, 1fr))" },
            // The boards run on past the row's end, and stop here.
            overflowX: "clip",
          }}
        >
          {books.map((share) => (
            <ShelfBook key={share.key} share={share} look={look} cover={covers.get(share.key)} onOpen={openBook} />
          ))}
        </Box>
      ) : (
        <Box component="ul" aria-label="Books" aria-busy={items.pending > 0} sx={{ listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${alpha(look.rule, 0.5)}` }}>
          {books.map((share) => (
            <CatalogueRow key={share.key} share={share} look={look} cover={covers.get(share.key)} onOpen={openBook} isOwner={isOwner} onMove={onMove} onRemove={onRemove} />
          ))}
        </Box>
      )}

      <SpaceShowMore items={items} />

      <BookPanel
        open={panelOpen && Boolean(selectedShare)}
        share={selectedShare}
        look={look}
        collection={collection}
        cover={selectedShare ? covers.get(selectedShare.key) : undefined}
        onClose={closeBook}
        isOwner={isOwner}
        onMove={onMove}
        onRemove={onRemove}
        openShare={openShare}
        openProfile={openProfile}
      />
    </SpaceShell>
  );
}
