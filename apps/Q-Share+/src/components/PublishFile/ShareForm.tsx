import { useEffect, useRef, type RefObject } from "react";
import {
  Alert,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { useDropzone } from "react-dropzone";
import { useDispatch } from "react-redux";
import { allCategoryData } from "../../constants/Categories/1stCategories";
import { maxSize } from "../../constants/Misc";
import { setNotification } from "../../state/features/notificationsSlice";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { fileKind, fileKindIconElement, fileKindLabel } from "../../utils/fileKind";
import { formatBytes } from "../../utils/formatBytes";
import { TITLE_MAX_LENGTH } from "../../utils/publishPayload";
import { CategoryList, type CategoryListRef } from "../common/CategoryList/CategoryList";
import { TextEditor } from "../common/TextEditor/TextEditor";
import { MAX_FILES, MAX_FILE_SIZE_LABEL, totalDraftSize } from "./shareDraft";
import type { ShareDraft } from "./useShareDraft";

interface ShareFormProps {
  draft: ShareDraft;
  categoryListRef: RefObject<CategoryListRef | null>;
  /** Category ids to start with (editing, or a draft that was closed and reopened). */
  initialCategories?: string[];
}

/**
 * The fields of the Share and Update dialogs: drop zone, file list, title,
 * category and description. State lives in `useShareDraft` in the parent, so
 * closing the dialog keeps what was typed.
 */
export function ShareForm({ draft, categoryListRef, initialCategories }: ShareFormProps) {
  const phone = usePhoneLayout();
  const dispatch = useDispatch();
  const problemsRef = useRef<HTMLDivElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxFiles: MAX_FILES,
    maxSize,
    multiple: true,
    // The File System Access API picker does not open inside the GO Android
    // WebView; the classic <input type="file"> works everywhere.
    useFsAccessApi: false,
    noKeyboard: false,
    onDrop: (accepted, rejected) => {
      const tooLarge = draft.addFiles(accepted, rejected);
      if (tooLarge) {
        dispatch(setNotification({ msg: `Files must be under ${MAX_FILE_SIZE_LABEL}`, alertType: "error" }));
      }
    },
  });

  useEffect(() => {
    const el = problemsRef.current;
    if (draft.problems.length > 0 && typeof el?.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [draft.problems]);

  const fileCount = draft.files.length;
  const titleMissing = draft.attempted && !draft.title.trim();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box
        {...getRootProps({
          // react-dropzone makes the root focusable and opens the picker on
          // Enter and Space; the role and label make it read as a button.
          role: "button",
          "aria-label": "Add files",
        })}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          minHeight: 112,
          px: 2,
          py: 3,
          textAlign: "center",
          cursor: "pointer",
          border: "2px dashed",
          borderColor: isDragActive ? "primary.main" : "divider",
          borderRadius: 2,
          bgcolor: isDragActive ? "action.hover" : "background.paper",
          color: "text.secondary",
          transition: "border-color 150ms ease, background-color 150ms ease",
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          "&:hover": { borderColor: "text.secondary" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
        }}
      >
        <input {...getInputProps()} data-testid="share-file-input" />
        <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography sx={{ color: "text.primary", fontWeight: 600 }}>
          {phone ? "Tap to choose files" : "Drag and drop files here, or click to choose"}
        </Typography>
        <Typography variant="body2">
          Up to {MAX_FILES} files, {MAX_FILE_SIZE_LABEL} each
        </Typography>
      </Box>

      {draft.warnings.length > 0 && (
        <Alert severity="warning" onClose={draft.clearWarnings}>
          {draft.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </Alert>
      )}

      {fileCount > 0 && (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}>
          <List disablePadding aria-label="Files to share">
            {draft.files.map((item) => {
              const kind = fileKind(item.mimetype, item.name);
              return (
                <ListItem
                  key={item.key}
                  divider
                  sx={{ minHeight: 56, pr: 8 }}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => draft.removeFile(item.key)}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <CloseOutlinedIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
                    {fileKindIconElement(kind, { titleAccess: fileKindLabel(kind) })}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.name}
                    secondary={item.existing ? `${formatBytes(item.size)} · already on QDN` : formatBytes(item.size)}
                    slotProps={{
                      primary: { noWrap: true, title: item.name, sx: { fontSize: 15 } },
                      secondary: { sx: { fontSize: 13 } },
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
          <Typography variant="body2" sx={{ px: 2, py: 1, color: "text.secondary" }}>
            {fileCount} {fileCount === 1 ? "file" : "files"} · {formatBytes(totalDraftSize(draft.files))}
          </Typography>
        </Box>
      )}

      <TextField
        name="title"
        label="Title"
        value={draft.title}
        onChange={(e) => draft.setTitle(e.target.value)}
        required
        fullWidth
        error={titleMissing}
        helperText={titleMissing ? "Enter a title" : `${draft.title.length}/${TITLE_MAX_LENGTH}`}
        slotProps={{
          htmlInput: { maxLength: TITLE_MAX_LENGTH, autoComplete: "off" },
          formHelperText: { sx: { textAlign: titleMissing ? "left" : "right", mx: 0 } },
        }}
      />

      <CategoryList
        categoryData={allCategoryData}
        ref={categoryListRef}
        initialCategories={initialCategories}
        columns={phone ? 1 : 3}
      />

      <Box>
        <Typography component="p" id="share-description-label" sx={{ mb: 1, fontWeight: 600 }}>
          Description
        </Typography>
        <TextEditor
          inlineContent={draft.description}
          setInlineContent={draft.setDescription}
          placeholder="Describe what you are sharing"
        />
      </Box>

      {draft.problems.length > 0 && (
        <Alert ref={problemsRef} severity="error" role="alert">
          {draft.problems.map((p) => (
            <div key={p}>{p}</div>
          ))}
        </Alert>
      )}
    </Box>
  );
}
