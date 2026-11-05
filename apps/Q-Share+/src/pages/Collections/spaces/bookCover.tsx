import { useMemo } from "react";
import { Box, useTheme } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { ShareCardArt } from "../../../components/common/ShareArt";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { coverUrl, type CollectionCover } from "../../../utils/collections";
import { LIBRARY_SERIF, bookCloth, bookStatus, type LibraryLook } from "./libraryShelf";
import type { SpaceShare } from "./useSpaceItems";

export const STILL = "@media (prefers-reduced-motion: reduce)";

export const twoLines = (lines: number) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
  overflowWrap: "anywhere",
});

/** A cover for a book without a picture: its title and author stamped in foil on woven cloth. */
function ClothCover({ share }: { share: SpaceShare }) {
  const theme = useTheme();
  const { cloth, foil } = useMemo(() => bookCloth(theme, share.key), [theme, share.key]);
  const { black, white } = theme.palette.common;
  return (
    <Box
      sx={{
        position: "absolute",
        inset: 0,
        containerType: "inline-size",
        bgcolor: cloth,
        backgroundImage: [
          `linear-gradient(115deg, ${alpha(white, 0.08)}, transparent 45%, ${alpha(black, 0.16)})`,
          `repeating-linear-gradient(0deg, ${alpha(white, 0.025)} 0 1px, transparent 1px 3px)`,
          `repeating-linear-gradient(90deg, ${alpha(black, 0.04)} 0 1px, transparent 1px 3px)`,
        ].join(","),
        color: foil,
        fontFamily: LIBRARY_SERIF,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: "5% 5% 5% 12%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "5cqw",
          padding: "9cqw 3cqw 6cqw",
          border: `1px solid ${alpha(foil, 0.6)}`,
          boxShadow: `inset 0 0 0 2px ${cloth}, inset 0 0 0 3px ${alpha(foil, 0.28)}`,
          textAlign: "center",
          overflow: "hidden",
          // Too small to read on a catalogue line: the frame is enough there.
          "@container (max-width: 72px)": { boxShadow: "none", "& > *": { display: "none" } },
        }}
      >
        <Box component="span" sx={{ ...twoLines(5), overflowWrap: "break-word", width: "100%", fontSize: "clamp(11px, 10.5cqw, 22px)", lineHeight: 1.2, fontWeight: 600 }}>
          {share.title}
        </Box>
        <Box aria-hidden sx={{ flexShrink: 0, width: "4cqw", height: "4cqw", minWidth: 4, minHeight: 4, bgcolor: alpha(foil, 0.75), transform: "rotate(45deg)" }} />
        <Box component="span" sx={{ ...twoLines(1), width: "100%", mt: "auto", flexShrink: 0, fontSize: "clamp(9px, 7cqw, 13px)", letterSpacing: "0.04em" }}>
          {share.user}
        </Box>
      </Box>
    </Box>
  );
}

/** The place of a book that isn't there: an outline on the shelf. */
function MissingCover({ look }: { look: LibraryLook }) {
  return <Box sx={{ position: "absolute", inset: 0, border: `1px dashed ${look.quiet}`, borderRadius: "inherit", opacity: 0.55 }} />;
}

/** The picture the collection's owner chose, over the cloth, which shows until it loads or if the node can't serve it. */
function ChosenCover({ share, url }: { share: SpaceShare; url: string }) {
  const { src, onError } = useQdnImage(url);
  return (
    <>
      <ClothCover share={share} />
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onError}
          style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </>
  );
}

export interface BookCoverProps {
  share: SpaceShare;
  look: LibraryLook;
  /** The cover the collection's owner chose for this book, shown in place of the share's own picture. */
  cover?: Pick<CollectionCover, "name" | "identifier"> | null;
  /** A picture not published yet (the cover dialog's preview); wins over `cover`. */
  src?: string | null;
}

/**
 * A book's face at 2:3: the owner's chosen cover, else the share's picture,
 * else cloth; the crease down its spine, and the edge of its pages.
 */
export function BookCover({ share, look, cover, src }: BookCoverProps) {
  if (bookStatus(share) !== null) {
    return (
      <Box className="library-book" aria-hidden sx={{ position: "relative", width: "calc(100% - 4px)", aspectRatio: "2 / 3", borderRadius: "2px 3px 3px 2px", bgcolor: alpha(look.board, 0.1) }}>
        <MissingCover look={look} />
      </Box>
    );
  }
  const chosen = src ?? (cover ? coverUrl(cover) : null);
  return (
    <Box
      className="library-book"
      aria-hidden
      sx={(theme: Theme) => ({
        position: "relative",
        width: "calc(100% - 4px)",
        aspectRatio: "2 / 3",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        boxShadow: `3px 2px 10px ${alpha(theme.palette.common.black, 0.38)}`,
        borderRadius: "2px 3px 3px 2px",
        [STILL]: { transition: "none" },
        // The block of pages, seen from the side.
        "&::after": {
          content: '""',
          position: "absolute",
          top: 3,
          bottom: 3,
          left: "100%",
          width: 3,
          borderRadius: "0 1px 1px 0",
          bgcolor: look.pages,
          backgroundImage: `repeating-linear-gradient(to bottom, ${alpha(theme.palette.common.black, 0.1)} 0 1px, transparent 1px 3px)`,
          boxShadow: `inset 1px 0 1px ${alpha(theme.palette.common.black, 0.3)}`,
        },
      })}
    >
      <Box sx={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit" }}>
        {chosen ? <ChosenCover share={share} url={chosen} /> : <ShareCardArt share={share.body} fallback={<ClothCover share={share} />} />}
        <Box
          sx={(theme: Theme) => ({
            position: "absolute",
            inset: "0 auto 0 0",
            width: "9%",
            pointerEvents: "none",
            background: `linear-gradient(to right, ${alpha(theme.palette.common.black, 0.22)}, ${alpha(theme.palette.common.white, 0.12)} 45%, ${alpha(theme.palette.common.black, 0.2)} 80%, transparent)`,
          })}
        />
      </Box>
    </Box>
  );
}
