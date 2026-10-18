import { useRef } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { ShareThumbnailState } from "./useShareThumbnail";

/**
 * The share's thumbnail in the Share and Update forms: what lists and
 * collection grids show for it. Made on the device; published with the
 * share (one more small fee) only on Publish.
 */
export function ThumbnailPicker({ thumb }: { thumb: ShareThumbnailState }) {
  const input = useRef<HTMLInputElement>(null);
  // Something to remove: one on QDN, or a new one that would go out.
  const has = thumb.choice.kind === "existing" || thumb.publishesNew;
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }} aria-label="Thumbnail" role="group">
      <Box
        aria-hidden
        sx={{
          width: 96,
          height: 72,
          flexShrink: 0,
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "action.hover",
          color: "text.secondary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {thumb.previewUrl ? (
          <img src={thumb.previewUrl} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
        ) : thumb.busy || (thumb.choice.kind === "auto" && /^Making/.test(thumb.label)) ? (
          <CircularProgress size={20} />
        ) : (
          <ImageOutlinedIcon />
        )}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, alignItems: "flex-start" }}>
        <Typography component="p" sx={{ fontWeight: 600 }}>
          Thumbnail
        </Typography>
        <Typography variant="body2" color="text.secondary" role={thumb.problem ? "alert" : undefined}>
          {thumb.problem ?? thumb.label}
        </Typography>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          data-testid="thumbnail-input"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = "";
            if (picked) void thumb.choose(picked);
          }}
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddPhotoAlternateOutlinedIcon />}
            onClick={() => input.current?.click()}
            disabled={thumb.busy}
            aria-label="Choose image for the thumbnail"
            sx={{ minHeight: 44 }}
          >
            Choose image
          </Button>
          {thumb.suggestion && (
            <Button
              size="small"
              onClick={() => thumb.suggestion && void thumb.fromFile(thumb.suggestion)}
              disabled={thumb.busy}
              title={thumb.suggestion.name}
              sx={{ minHeight: 44, maxWidth: 240, textTransform: "none", justifyContent: "flex-start" }}
            >
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Use {thumb.suggestion.name}
              </Box>
            </Button>
          )}
          {has && (
            <Button
              color="inherit"
              size="small"
              startIcon={<DeleteOutlinedIcon />}
              onClick={thumb.remove}
              disabled={thumb.busy}
              aria-label="Remove thumbnail"
              sx={{ minHeight: 44 }}
            >
              Remove
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
