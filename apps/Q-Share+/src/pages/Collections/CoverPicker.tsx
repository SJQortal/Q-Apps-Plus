import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { COVER_SERVICE, newCoverIdentifier, type CollectionCover as Cover, type NewCover } from "../../utils/collections";
import { makeCoverFile } from "../../utils/coverImage";
import { CollectionCover } from "./CollectionCover";

/** What a dialog does with the cover on save. */
export type CoverChoice = { kind: "keep" } | { kind: "remove" } | { kind: "new"; file: File; url: string };

export const KEEP_COVER: CoverChoice = { kind: "keep" };

/**
 * The cover to store and the image to publish with it, for a save by `name`:
 * `cover` is undefined to keep the current one and null to remove it.
 */
export function coverChange(choice: CoverChoice, name: string): { cover: Cover | null | undefined; covers: NewCover[] } {
  if (choice.kind === "remove") return { cover: null, covers: [] };
  if (choice.kind === "keep") return { cover: undefined, covers: [] };
  const identifier = newCoverIdentifier();
  return { cover: { service: COVER_SERVICE, name, identifier }, covers: [{ identifier, file: choice.file }] };
}

interface CoverPickerProps {
  /** The cover on QDN now. */
  current?: Cover;
  choice: CoverChoice;
  onChange: (choice: CoverChoice) => void;
  kind: "collection" | "folder";
  disabled?: boolean;
}

/**
 * Pick, change or remove a cover. The image is cut to a square and made
 * small on the device (utils/coverImage.ts) and only published on save.
 */
export function CoverPicker({ current, choice, onChange, kind, disabled }: CoverPickerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const previewUrl = choice.kind === "new" ? choice.url : null;

  // The preview's object URL lives as long as it is the choice.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setWorking(true);
    try {
      const cover = await makeCoverFile(file);
      onChange({ kind: "new", file: cover, url: URL.createObjectURL(cover) });
    } catch {
      setProblem("Couldn't use that image. Try a JPEG, PNG or WebP.");
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  };

  const shown = choice.kind === "remove" ? null : choice.kind === "new" ? null : current;
  const hasCover = choice.kind === "new" || (choice.kind === "keep" && Boolean(current));

  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
      <CollectionCover cover={shown} src={previewUrl} kind={kind} size={88} />
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0, alignItems: "flex-start" }}>
        <Typography component="p" sx={{ fontWeight: 600 }}>
          Cover
        </Typography>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          data-testid="cover-input"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={working ? <CircularProgress size={16} color="inherit" /> : <AddPhotoAlternateOutlinedIcon />}
            onClick={() => input.current?.click()}
            disabled={disabled || working}
            aria-label={`${hasCover ? "Change image" : "Choose image"} for the cover`}
            sx={{ minHeight: 44 }}
          >
            {hasCover ? "Change image" : "Choose image"}
          </Button>
          {hasCover ? (
            <Button
              color="inherit"
              size="small"
              startIcon={<DeleteOutlinedIcon />}
              onClick={() => onChange(current ? { kind: "remove" } : KEEP_COVER)}
              disabled={disabled || working}
              aria-label="Remove cover"
              sx={{ minHeight: 44 }}
            >
              Remove
            </Button>
          ) : null}
        </Box>
        <Typography variant="body2" color="text.secondary" role={problem ? "alert" : undefined}>
          {problem ?? "Shown square. Published with the collection, for one more small QDN fee."}
        </Typography>
      </Box>
    </Box>
  );
}
