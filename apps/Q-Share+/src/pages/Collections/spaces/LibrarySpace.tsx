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
import { alpha, type Theme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShelvesIcon from "@mui/icons-material/ViewModuleOutlined";
import CatalogueIcon from "@mui/icons-material/ViewListOutlined";
import { ClearFieldButton } from "../../../components/common/ClearFieldButton";
import FileElement from "../../../components/common/FileElement";
import { OpenPdfButton, PreviewPanel, PreviewToggleButton, previewKind } from "../../../components/common/FilePreview";
import { ShareCardArt } from "../../../components/common/ShareArt";
import { BottomSheet } from "../../../components/common/mobile/BottomSheet";
import { DisplayHtml } from "../../../components/common/TextEditor/DisplayHtml";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { formatBytes } from "../../../utils/formatBytes";
import type { CollectionFolder } from "../../../utils/collections";
import type { ShareFile } from "../../FileContent/FileRow";
import { CollectionCover } from "../CollectionCover";
import { folderCountLabel } from "../FolderGrid";
import {
  LIBRARY_SERIF,
  bookCloth,
  bookFormats,
  bookStatus,
  countLabel,
  filterBooks,
  formatBadge,
  libraryLook,
  readLibraryView,
  sortBooks,
  totalBytes,
  writeLibraryView,
  type LibraryLook,
  type LibrarySort,
  type LibraryView,
} from "./libraryShelf";
import { ShareOwnerActions, SpaceShell, SpaceShowMore } from "./SpaceShell";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

/** Files a book's panel lists at a time: each row is a download control. */
const FILE_PAGE = 20;
const STILL = "@media (prefers-reduced-motion: reduce)";

const twoLines = (lines: number) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

/** A cover for a book without a picture: its title and author stamped on cloth. */
function ClothCover({ share }: { share: SpaceShare }) {
  const theme = useTheme();
  const { cloth, foil } = useMemo(() => bookCloth(theme, share.key), [theme, share.key]);
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        containerType: "inline-size",
        bgcolor: cloth,
        color: foil,
        fontFamily: LIBRARY_SERIF,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: "6% 7% 6% 13%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "4cqw",
          padding: "7cqw 5cqw",
          border: `1px solid ${alpha(foil, 0.55)}`,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <Box component="span" sx={{ ...twoLines(5), fontSize: "clamp(11px, 11cqw, 22px)", lineHeight: 1.2, fontWeight: 600 }}>
          {share.title}
        </Box>
        <Box component="span" sx={{ ...twoLines(1), flexShrink: 0, fontSize: "clamp(9px, 7cqw, 13px)", letterSpacing: "0.04em" }}>
          {share.user}
        </Box>
      </Box>
    </Box>
  );
}

/** The cover for a book that isn't there: blank paper and a dashed frame. */
function MissingCover({ look }: { look: LibraryLook }) {
  return <Box sx={{ position: "absolute", inset: "6%", border: `1px dashed ${look.quiet}`, opacity: 0.6 }} />;
}

/** A book's face at 2:3: picture or cloth, the highlight down its spine, and the edge of its pages. */
function BookCover({ share, look }: { share: SpaceShare; look: LibraryLook }) {
  const missing = bookStatus(share) !== null;
  return (
    <Box
      className="library-book"
      aria-hidden
      sx={(theme: Theme) => ({
        position: "relative",
        width: "calc(100% - 4px)",
        aspectRatio: "2 / 3",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.3)}`,
        borderRadius: "2px 3px 3px 2px",
        bgcolor: missing ? look.board : "transparent",
        [STILL]: { transition: "none" },
        // The block of pages, seen from the side.
        "&::after": {
          content: '""',
          position: "absolute",
          top: 3,
          bottom: 3,
          left: "100%",
          width: 4,
          borderRadius: "0 1px 1px 0",
          background: `repeating-linear-gradient(to bottom, ${alpha(theme.palette.common.white, 0.9)} 0 1px, ${alpha(theme.palette.common.black, 0.18)} 1px 2px)`,
        },
      })}
    >
      <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit" }}>
        {missing ? <MissingCover look={look} /> : <ShareCardArt share={share.body} fallback={<ClothCover share={share} />} />}
        <Box
          sx={(theme: Theme) => ({
            position: "absolute",
            inset: "0 auto 0 0",
            width: "11%",
            pointerEvents: "none",
            background: `linear-gradient(to right, ${alpha(theme.palette.common.black, 0.3)}, ${alpha(theme.palette.common.white, 0.2)} 40%, ${alpha(theme.palette.common.black, 0.14)} 75%, transparent)`,
          })}
        />
      </Box>
    </Box>
  );
}

/** The shelf board under a row: each book draws its part, and the last runs on to the end of the row. */
const boardSx = (look: LibraryLook, theme: Theme) => ({
  "&::after": {
    content: '""',
    position: "absolute",
    top: "100%",
    left: "calc(-1 * var(--shelf-gap))",
    right: "calc(-1 * var(--shelf-gap))",
    height: 9,
    background: `linear-gradient(to bottom, ${look.board} 0 5px, ${look.boardEdge} 5px)`,
    boxShadow: `0 7px 10px -3px ${alpha(theme.palette.common.black, 0.35)}`,
    zIndex: 0,
  },
  "li:last-of-type > &::after": { right: "-100vw" },
});

interface BookProps {
  share: SpaceShare;
  look: LibraryLook;
  onOpen: (key: string) => void;
}

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
  function ShelfBook({ share, look, onOpen }: BookProps) {
    const status = bookStatus(share);
    if (!share.title) {
      return (
        <Box component="li" sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={(theme: Theme) => ({ position: "relative", ...boardSx(look, theme) })}>
            <Skeleton variant="rectangular" sx={{ width: "calc(100% - 4px)", height: "auto", aspectRatio: "2 / 3" }} />
          </Box>
          <Skeleton sx={{ mt: 2.5, width: "80%" }} />
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
            <BookCover share={share} look={look} />
          </Box>
        </Box>
        <Box sx={{ pt: 2.5, minWidth: 0 }}>
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
  (a, b) => a.look === b.look && a.onOpen === b.onOpen && sameBook(a.share, b.share)
);

interface CatalogueProps extends BookProps {
  isOwner: boolean;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
}

/** One line of the catalogue: a small cover, title, author, formats and size, and the owner's buttons. */
const CatalogueRow = memo(
  function CatalogueRow({ share, look, onOpen, isOwner, onMove, onRemove }: CatalogueProps) {
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
              <BookCover share={share} look={look} />
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
        {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} /> : null}
      </Box>
    );
  },
  (a, b) =>
    a.look === b.look &&
    a.onOpen === b.onOpen &&
    a.isOwner === b.isOwner &&
    a.onMove === b.onMove &&
    a.onRemove === b.onRemove &&
    sameBook(a.share, b.share)
);

/** One file in a book's panel: its format, name and size, then Download and Read. */
function BookFile({ file, jsonId, look }: { file: ShareFile; jsonId: string; look: LibraryLook }) {
  const [open, setOpen] = useState(false);
  const preview = previewKind(file);
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
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1, "& > *": { flex: "1 1 120px", minWidth: 0 } }}>
        <Box sx={{ display: "flex", minWidth: 0 }}>
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
function BookDetails({ share, look, phone, titleId, onClose, isOwner, onMove, onRemove, openShare, openProfile }: PanelProps) {
  const [fileCount, setFileCount] = useState(FILE_PAGE);
  const status = bookStatus(share);
  const body = share.body as { htmlDescription?: unknown; fullDescription?: unknown; description?: unknown } | undefined;
  const html = typeof body?.htmlDescription === "string" ? body.htmlDescription : "";
  const plain = [body?.fullDescription, body?.description].find((text) => typeof text === "string" && text) as string | undefined;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexDirection: phone ? "row" : "column", position: "relative" }}>
        <Box sx={{ width: phone ? 96 : 176, flexShrink: 0, alignSelf: phone ? "flex-start" : "center" }}>
          <BookCover share={share} look={look} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1, pr: phone ? 5 : 0, alignSelf: "stretch" }}>
          <Typography id={titleId} component="h2" sx={{ fontFamily: LIBRARY_SERIF, fontSize: phone ? 20 : 24, lineHeight: 1.2, fontWeight: 600, overflowWrap: "anywhere" }}>
            {share.title}
          </Typography>
          <Button
            onClick={() => openProfile(share.user)}
            aria-label={`Published by ${share.user}`}
            sx={{ mt: 0.5, ml: -1, minHeight: 44, justifyContent: "flex-start", textAlign: "left", overflowWrap: "anywhere" }}
          >
            {share.user}
          </Button>
          {status ? (
            <Typography role="status" sx={{ color: "text.secondary", fontSize: 14 }}>
              {status}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {status ? null : html ? (
        <Box sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <DisplayHtml html={html} />
        </Box>
      ) : plain ? (
        <Typography sx={{ color: "text.secondary", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{plain}</Typography>
      ) : null}

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Button variant="contained" startIcon={<OpenInNewRoundedIcon />} onClick={() => openShare(share)} sx={{ minHeight: 44, flex: "1 1 auto" }}>
          Open share
        </Button>
        {isOwner ? <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} /> : null}
      </Box>

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
          sx: { width: "min(440px, 100%)", p: 3, backgroundImage: "none", bgcolor: "background.paper" },
        },
      }}
    >
      {inner}
    </Drawer>
  );
}

/** A folder as a book lying on its side, spine out, with its name on it. */
function FolderSpine({ folder, onOpen }: { folder: CollectionFolder; onOpen: (id: string) => void }) {
  const theme = useTheme();
  const title = folder.title || "Untitled folder";
  const { cloth, foil } = useMemo(() => bookCloth(theme, folder.id), [theme, folder.id]);
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
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 2,
          py: 1,
          border: 0,
          borderRadius: "3px",
          bgcolor: cloth,
          color: foil,
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          boxShadow: `inset 10px 0 0 ${alpha(foil, 0.14)}, inset -10px 0 0 ${alpha(foil, 0.14)}, 0 4px 10px ${alpha(theme.palette.common.black, 0.25)}`,
          transition: "transform 160ms ease",
          [STILL]: { transition: "none" },
          "&:hover": { transform: "translateY(-2px)", [STILL]: { transform: "none" } },
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        }}
      >
        {folder.cover ? <CollectionCover cover={folder.cover} kind="folder" size={44} /> : null}
        <Box component="span" sx={{ minWidth: 0, flex: 1 }}>
          <Box component="span" sx={{ ...twoLines(2), fontFamily: LIBRARY_SERIF, fontSize: 16, lineHeight: 1.2, fontWeight: 600 }}>
            {title}
          </Box>
          <Box component="span" sx={{ ...twoLines(1), mt: 0.25, fontSize: 12 }}>
            {folderCountLabel(folder)}
          </Box>
        </Box>
      </Box>
    </li>
  );
}

/** The top of the room, set like a book's title page. */
function TitlePage({ props, look }: { props: SpaceProps; look: LibraryLook }) {
  const { cover, folder, breadcrumb, title, description, attribution, actions, items, subfolders } = props;
  const counts = [countLabel(items.total, "book", "books")];
  if (subfolders.length > 0) counts.push(countLabel(subfolders.length, "shelf", "shelves"));
  return (
    <Box component="section" aria-label={folder ? "About this folder" : "About this collection"} sx={{ minWidth: 0 }}>
      {breadcrumb}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1.5, pt: { xs: 1.5, sm: 4 }, pb: { xs: 1, sm: 2 } }}>
        {cover ? <CollectionCover cover={cover} kind={folder ? "folder" : "collection"} size={96} /> : null}
        <Typography component="p" sx={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: look.quiet }}>
          {folder ? "A shelf" : "A library"}
        </Typography>
        <Typography
          component="h1"
          sx={{
            fontFamily: LIBRARY_SERIF,
            fontWeight: 500,
            fontSize: "clamp(28px, 5vw, 48px)",
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
        <Box aria-hidden sx={{ width: 72, height: "1px", bgcolor: look.rule, my: 0.5 }} />
        {description ? (
          <Typography sx={{ fontFamily: LIBRARY_SERIF, fontSize: { xs: 16, sm: 18 }, lineHeight: 1.5, maxWidth: "36em", color: look.quiet, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {description}
          </Typography>
        ) : null}
        <Typography sx={{ fontSize: 13, letterSpacing: "0.04em", color: look.quiet }}>{counts.join(" · ")}</Typography>
        <Box sx={{ color: look.quiet, minWidth: 0, maxWidth: "100%", "& > *": { justifyContent: "center" } }}>{attribution}</Box>
        {actions ? <Box sx={{ display: "flex", justifyContent: "center", width: "100%", "& > *": { justifyContent: "center" } }}>{actions}</Box> : null}
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
  const { items, isOwner, onMove, onRemove, openFolder, openShare, openProfile, subfolders, foldersSection, emptyState } = props;
  const theme = useTheme();
  const phone = usePhoneLayout();
  const look = useMemo(() => libraryLook(theme), [theme]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("added");
  const [view, setView] = useState<LibraryView>(readLibraryView);
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const books = useMemo(() => sortBooks(filterBooks(items.shares, query), sort), [items.shares, query, sort]);
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
        color: look.ink,
        gap: 3,
        p: { xs: 1.5, sm: 3, md: 4 },
        borderRadius: 2,
        border: `1px solid ${alpha(look.rule, 0.45)}`,
      }}
    >
      {subfolders.length > 0 ? (
        <Box component="section" aria-labelledby="library-shelves" sx={{ minWidth: 0 }}>
          <Typography id="library-shelves" component="h2" sx={{ fontFamily: LIBRARY_SERIF, fontWeight: 600, fontSize: 20, mb: 1.25, color: look.ink }}>
            Shelves
          </Typography>
          <Box
            component="ul"
            aria-label="Folders"
            sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))" }}
          >
            {subfolders.map((folder) => (
              <FolderSpine key={folder.id} folder={folder} onOpen={openFolder} />
            ))}
          </Box>
        </Box>
      ) : foldersSection}

      {emptyState}

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
            pt: 1,
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
            <ShelfBook key={share.key} share={share} look={look} onOpen={openBook} />
          ))}
        </Box>
      ) : (
        <Box component="ul" aria-label="Books" aria-busy={items.pending > 0} sx={{ listStyle: "none", m: 0, p: 0, borderTop: `1px solid ${alpha(look.rule, 0.5)}` }}>
          {books.map((share) => (
            <CatalogueRow key={share.key} share={share} look={look} onOpen={openBook} isOwner={isOwner} onMove={onMove} onRemove={onRemove} />
          ))}
        </Box>
      )}

      <SpaceShowMore items={items} />

      <BookPanel
        open={panelOpen && Boolean(selectedShare)}
        share={selectedShare}
        look={look}
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
