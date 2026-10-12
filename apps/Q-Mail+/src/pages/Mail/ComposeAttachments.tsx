/**
 * The files attached in the composer, as tiles in rows: a thumbnail for
 * images and an icon for other kinds, the name and size, and a remove button.
 * A tap on a tile previews the file from this device (LocalAttachmentPreview,
 * its own chunk), before anything is sent. On a phone the tiles are smaller
 * and sit in one row that scrolls sideways, so the editor stays in view.
 * Removing one moves focus to the next file (or to "Attach files").
 */
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { lazyNamed } from "../../components/common/lazyNamed";
import { AttachmentIcon } from "../../components/AttachmentPreview/AttachmentIcon";
import { attachmentKind, formatFileSize } from "../../utils/attachmentMeta";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { useLandscapeFrame } from "../../utils/hubFrame";

const LocalAttachmentPreview = lazyNamed(() => import("./LocalAttachmentPreview"), "LocalAttachmentPreview");

export interface ComposeAttachment {
  file: File;
  extension?: string;
  forwardKey?: string;
}

const kindOf = (file: File) => attachmentKind({ originalFilename: file.name, type: file.type || null });

/** An image file's thumbnail URL while the tile is shown. */
function useThumbnail(file: File): string {
  const url = useMemo(() => (kindOf(file) === "image" ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function Tile({
  item,
  small,
  onPreview,
  onRemove,
}: {
  item: ComposeAttachment;
  small: boolean;
  onPreview: () => void;
  onRemove: () => void;
}) {
  const { file, extension, forwardKey } = item;
  const thumbnail = useThumbnail(file);
  const kind = kindOf(file);
  const detailsId = useId();
  const details = [formatFileSize(file.size), forwardKey ? "forwarded" : ""].filter(Boolean).join(" · ");
  return (
    <Box
      role="listitem"
      sx={theme => ({
        position: "relative",
        minWidth: 0,
        ...(small ? { flex: "0 0 128px", scrollSnapAlign: "start" } : {}),
        borderRadius: 2,
        border: `1px solid ${extension ? theme.palette.divider : theme.palette.error.main}`,
        backgroundColor: theme.palette.background.paper,
        overflow: "hidden",
      })}
    >
      <ButtonBase
        onClick={onPreview}
        aria-label={`Preview ${file.name}`}
        // The size, "forwarded" or the missing-extension warning is read too.
        aria-describedby={detailsId}
        data-tile-preview=""
        sx={theme => ({
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          textAlign: "left",
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
          "&:hover .tile-media": { opacity: 0.9 },
        })}
      >
        <Box
          className="tile-media"
          aria-hidden
          sx={{
            height: small ? 64 : 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "action.hover",
            color: "text.secondary",
            transition: "opacity 150ms ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          {thumbnail ? (
            <Box component="img" src={thumbnail} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <AttachmentIcon kind={kind} sx={{ fontSize: 36 }} />
          )}
        </Box>
        <Box sx={{ px: 1.25, py: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.875rem",
              fontWeight: 600,
              lineHeight: 1.3,
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {file.name}
          </Typography>
          <Typography id={detailsId} variant="body2" color={extension ? "text.secondary" : "error"} sx={{ fontSize: "0.875rem" }}>
            {extension ? details : "No file extension"}
          </Typography>
        </Box>
      </ButtonBase>
      <IconButton
        aria-label={`Remove attachment ${file.name}`}
        onClick={onRemove}
        sx={theme => ({
          position: "absolute",
          top: 0,
          right: 0,
          width: 44,
          height: 44,
          color: theme.palette.text.primary,
          // A disc behind the X keeps it readable over a photo.
          "&::before": {
            content: '""',
            position: "absolute",
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: theme.palette.background.paper,
            opacity: 0.85,
          },
          "& svg": { position: "relative" },
        })}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export function ComposeAttachments({
  attachments,
  onRemove,
}: {
  attachments: ComposeAttachment[];
  onRemove: (index: number) => void;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const phone = useLayoutMode() === "phone";
  const landscape = useLandscapeFrame();
  const small = phone || landscape;
  const listRef = useRef<HTMLDivElement | null>(null);
  // After a removal: the tile now at that place, else the one before, else "Attach files".
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    const at = focusAt.current;
    if (at === null) return;
    focusAt.current = null;
    const tiles = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-tile-preview]") || []);
    const target = tiles[Math.min(at, tiles.length - 1)] || document.querySelector<HTMLElement>("[data-attach-files]");
    target?.focus();
  }, [attachments.length]);
  if (!attachments.length) return null;
  return (
    <>
      <Box
        ref={listRef}
        role="list"
        aria-label="Attachments"
        sx={
          small
            ? {
                display: "flex",
                gap: 1,
                overflowX: "auto",
                overscrollBehaviorX: "contain",
                scrollSnapType: "x proximity",
                width: "100%",
                pb: 0.5,
              }
            : { display: "grid", gap: 1, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))", width: "100%" }
        }
      >
        {attachments.map((item, index) => (
          <Tile
            key={`${item.file?.name || "attachment"}-${item.file?.size || 0}-${index}`}
            item={item}
            small={small}
            onPreview={() => setPreviewIndex(index)}
            onRemove={() => {
              focusAt.current = index;
              onRemove(index);
            }}
          />
        ))}
      </Box>
      {previewIndex !== null && (
        <Suspense fallback={null}>
          <LocalAttachmentPreview
            files={attachments.map(item => item.file)}
            index={previewIndex}
            onClose={() => setPreviewIndex(null)}
          />
        </Suspense>
      )}
    </>
  );
}
