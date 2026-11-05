/**
 * The product form's videos and files (Simon, 2026-10-25: buttons under the
 * pictures, each shown as on the product page, with an X to take it out):
 * Add a video and Add a PDF or file open the same dialogs the description
 * editor had (richtext/AddMediaDialogs.tsx); a video can get a thumbnail.
 * They're stored in the description as before (richtext/embeds.ts
 * joinDescription), so the product page and the original app read them.
 * Loaded with the product form only.
 */
import { useState } from "react";
import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import VideoLibraryOutlinedIcon from "@mui/icons-material/VideoLibraryOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import { embedLabel, type QortalEmbed, type VideoEmbed } from "./embeds";
import { AddFileDialog, AddVideoDialog, VideoThumbnailDialog } from "./AddMediaDialogs";
import { qtubeDocumentOf } from "./qortalSources";
import { QortalVideo } from "./QortalVideo";
import { QortalFile } from "./QortalFile";

export default function MediaFields({
  embeds,
  onChange,
  name,
  productTitle,
  shopTitle,
  disabled = false,
}: {
  embeds: QortalEmbed[];
  onChange: (embeds: QortalEmbed[]) => void;
  /** The name the shop publishes under (for uploads). */
  name: string | null | undefined;
  productTitle: string;
  shopTitle?: string;
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<"video" | "file" | null>(null);
  const [thumbFor, setThumbFor] = useState<{ index: number; embed: VideoEmbed } | null>(null);
  const add = (more: QortalEmbed[]) => {
    setDialog(null);
    onChange([...embeds, ...more]);
  };
  const remove = (index: number) => onChange(embeds.filter((_, i) => i !== index));
  const videos = embeds.map((embed, index) => ({ embed, index })).filter((x) => x.embed.kind === "video");
  const files = embeds.map((embed, index) => ({ embed, index })).filter((x) => x.embed.kind === "file");

  const removeButton = (embed: QortalEmbed, index: number) => (
    <Tooltip title="Remove">
      <IconButton
        aria-label={`Remove ${embedLabel(embed)}`}
        onClick={() => remove(index)}
        disabled={disabled}
        sx={{ position: "absolute", top: 6, right: 6, zIndex: 1, width: 36, height: 36, bgcolor: "background.paper", border: 1, borderColor: "divider", boxShadow: 2, "&:hover": { bgcolor: "background.default" } }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button variant="outlined" startIcon={<VideoLibraryOutlinedIcon />} onClick={() => setDialog("video")} disabled={disabled} sx={{ minHeight: 44 }}>
          Add a video
        </Button>
        <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} onClick={() => setDialog("file")} disabled={disabled} sx={{ minHeight: 44 }}>
          Add a PDF or file
        </Button>
      </Box>
      {videos.length > 0 && (
        <Box component="ul" aria-label="Videos" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {videos.map(({ embed, index }) => (
            <Box component="li" key={`${embed.name}/${embed.identifier}/${index}`} sx={{ position: "relative", display: "flex", flexDirection: "column", gap: 0.5 }}>
              {removeButton(embed, index)}
              <QortalVideo embed={embed as VideoEmbed} />
              <Button
                size="small"
                startIcon={<ImageOutlinedIcon />}
                onClick={() => setThumbFor({ index, embed: embed as VideoEmbed })}
                disabled={disabled}
                sx={{ alignSelf: "flex-start", minHeight: 40 }}
              >
                {(embed as VideoEmbed).thumbnail || qtubeDocumentOf(embed as VideoEmbed) ? "Change the thumbnail" : "Add a thumbnail"}
              </Button>
            </Box>
          ))}
        </Box>
      )}
      {files.length > 0 && (
        <Box component="ul" aria-label="Attachments" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {files.map(({ embed, index }) => (
            <Box component="li" key={`${embed.name}/${embed.identifier}/${index}`} sx={{ position: "relative", pr: 5 }}>
              {removeButton(embed, index)}
              <QortalFile embed={embed as Extract<QortalEmbed, { kind: "file" }>} />
            </Box>
          ))}
        </Box>
      )}
      {embeds.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          Buyers see them under the pictures, as here.
        </Typography>
      )}
      {dialog === "video" && <AddVideoDialog open onClose={() => setDialog(null)} onAdd={(embed) => add([embed])} name={name} productTitle={productTitle} shopTitle={shopTitle} />}
      {dialog === "file" && <AddFileDialog open onClose={() => setDialog(null)} onAdd={add} name={name} shopTitle={shopTitle} />}
      {thumbFor && (
        <VideoThumbnailDialog
          embed={thumbFor.embed}
          name={name}
          onClose={() => setThumbFor(null)}
          onSave={(embed) => {
            onChange(embeds.map((e, i) => (i === thumbFor.index ? embed : e)));
            setThumbFor(null);
          }}
        />
      )}
    </Box>
  );
}
