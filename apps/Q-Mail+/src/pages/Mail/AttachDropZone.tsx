/**
 * The composers' attach control (new mail and new group threads): an
 * "Attach files" button that opens the file picker, in a row that takes
 * dropped files and lights up while files are dragged over it.
 */
import { Box, Button, Typography } from "@mui/material";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import type { DropzoneState } from "react-dropzone";
import { primarySoft } from "../../hub-theme";

export function AttachDropZone({ dropzone, count }: { dropzone: DropzoneState; count: number }) {
  const { getRootProps, getInputProps, isDragActive, open } = dropzone;
  return (
    <Box
      {...getRootProps()}
      sx={theme => ({
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.5,
        p: 0.75,
        mx: -0.75,
        borderRadius: 2,
        border: `1px dashed ${isDragActive ? theme.palette.primary.main : "transparent"}`,
        backgroundColor: isDragActive ? primarySoft(theme) : "transparent",
        transition: "background-color 150ms ease, border-color 150ms ease",
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      })}
    >
      <input {...getInputProps()} />
      <Button
        variant="outlined"
        startIcon={<AttachFileOutlinedIcon />}
        onClick={open}
        data-attach-files=""
        sx={{ minHeight: 44, borderRadius: 999, px: 2, textTransform: "none", fontWeight: 600 }}
      >
        {count ? "Attach more" : "Attach files"}
      </Button>
      {/* Dropping files needs a mouse: no hint on touch screens, a phone held sideways included. */}
      <Typography
        variant="body2"
        sx={{ color: "var(--qmail-compose-muted)", display: "none", "@media (hover: hover) and (pointer: fine)": { display: "block" } }}
      >
        {isDragActive ? "Drop to attach" : "or drop files here"}
      </Typography>
    </Box>
  );
}
