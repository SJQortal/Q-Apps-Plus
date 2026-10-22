/**
 * Picks images for a shop logo or product photos and hands each one back as a
 * WebP data URL, compressed as the original did (quality 0.6, at most 1200 px
 * wide): shop logos and product images live inside the shop's JSON on QDN.
 *
 * A real button opens the file picker (keyboard and screen readers reach it),
 * and on desktop images can also be dropped on the area around it. Several
 * images can be picked at once, up to `max`. A file that can't be read is
 * reported through `onError` instead of leaving the picker waiting forever.
 */
import { useCallback, useState, type ReactNode } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { useDropzone } from "react-dropzone";
import Compressor from "compressorjs";

export const IMAGE_QUALITY = 0.6;
export const IMAGE_MAX_WIDTH = 1200;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unreadable")));
    reader.onerror = () => reject(reader.error ?? new Error("Unreadable"));
    reader.readAsDataURL(file);
  });
}

/** One image as a compressed WebP data URL, at most `maxWidth` px wide. */
export function compressImage(file: File, maxWidth = IMAGE_MAX_WIDTH): Promise<string> {
  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality: IMAGE_QUALITY,
      maxWidth,
      mimeType: "image/webp",
      success(result) {
        readAsDataUrl(new File([result], "name", { type: "image/webp" })).then(resolve, reject);
      },
      error(err) {
        reject(err);
      },
    });
  });
}

interface ImageUploaderProps {
  /** Called once per image, in the order picked. */
  onPick: (base64Img: string) => void;
  /** The button's text, e.g. "Add shop logo". */
  label: string;
  /** How many images may still be added (default 1). */
  max?: number;
  disabled?: boolean;
  onError?: (message: string) => void;
  /** Extra content inside the drop area, under the button. */
  children?: ReactNode;
  /** Widest the image may stay, in px (default 1200, the original's). */
  maxWidth?: number;
}

const ImageUploader = ({ onPick, label, max = 1, disabled = false, onError, children, maxWidth = IMAGE_MAX_WIDTH }: ImageUploaderProps) => {
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const files = acceptedFiles.slice(0, Math.max(0, max));
      if (files.length === 0) return;
      setBusy(true);
      let failed = 0;
      try {
        for (const file of files) {
          try {
            onPick(await compressImage(file, maxWidth));
          } catch {
            failed += 1;
          }
        }
      } finally {
        setBusy(false);
      }
      if (failed > 0) {
        onError?.(failed === 1 ? "That image couldn't be read. Try another one." : "Some images couldn't be read. Try others.");
      }
      if (acceptedFiles.length > files.length) {
        onError?.(`Only ${max} more ${max === 1 ? "image fits" : "images fit"}.`);
      }
    },
    [max, maxWidth, onPick, onError]
  );

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: max > 1,
    noClick: true,
    noKeyboard: true,
    disabled: disabled || busy || max < 1,
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 1,
        p: 1.5,
        border: 1,
        borderStyle: "dashed",
        borderColor: isDragActive ? "primary.main" : "divider",
        borderRadius: 1,
        bgcolor: isDragActive ? "action.hover" : "transparent",
        transition: "background-color 150ms ease, border-color 150ms ease",
      }}
    >
      <input {...getInputProps()} />
      <Button
        variant="outlined"
        onClick={open}
        disabled={disabled || busy || max < 1}
        startIcon={busy ? <CircularProgress size={18} /> : <AddPhotoAlternateOutlinedIcon />}
        sx={{ minHeight: 44 }}
      >
        {busy ? "Preparing…" : label}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {max > 1 ? `Up to ${max} more. ` : ""}Images are made smaller (WebP, {maxWidth} px wide) before they&apos;re published.
      </Typography>
      {children}
    </Box>
  );
};

export default ImageUploader;
