import React, { useEffect, useState } from "react";
import { Badge, Box, Button, IconButton, LinearProgress, List, ListItem, ListItemButton, Popover, Tooltip, Typography } from "@mui/material";
import DownloadingOutlinedIcon from "@mui/icons-material/DownloadingOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SaveAltOutlinedIcon from "@mui/icons-material/SaveAltOutlined";
import { saveFromNode } from "./FileElement";
import { errorMessage, isHubDecline } from "../../utils/hubErrors";
import { setNotification } from "../../state/features/notificationsSlice";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../../state/store";
import { clearFinishedDownloads, removeDownload } from "../../state/features/globalSlice";
import { OPEN_DOWNLOADS_EVENT } from "../layout/BottomNav/events";
import { BottomSheet } from "./mobile/BottomSheet";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { downloadPhase, downloadStatusText } from "../../wrappers/DownloadWrapper";
import { sharePath } from "../../utils/qortalLinks";
import { fileKind, fileKindIconElement } from "../../utils/fileKind";

/**
 * The downloads button in the top bar: a badge with how many files are still
 * arriving, and a list (a bottom sheet on phones, a popover on desktop) that
 * links each file back to its share. The phone bottom bar opens the same view
 * through OPEN_DOWNLOADS_EVENT.
 */
interface DownloadTaskManagerProps {
  /** Render only the list (the phone bottom bar has its own Downloads item). */
  hideButton?: boolean;
}

export const DownloadTaskManager: React.FC<DownloadTaskManagerProps> = ({ hideButton = false }) => {
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const saveItem = async (download: any) => {
    const props = download?.properties ?? {};
    const identifier: string = download?.identifier;
    setSavingId(identifier);
    try {
      await saveFromNode(
        { service: props.service || download?.service || "FILE", name: props.name || download?.name, identifier },
        { filename: props.filename, mimeType: props.mimeType || props.mimetype }
      );
    } catch (error) {
      if (!isHubDecline(error)) dispatch(setNotification({ msg: errorMessage(error, "Could not save the file"), alertType: "error" }));
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    const onOpenRequest = (e: Event) => {
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener(OPEN_DOWNLOADS_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_DOWNLOADS_EVENT, onOpenRequest);
  }, []);

  const entries: any[] = Object.values(downloads ?? {});
  const inProgress = entries.filter((d) => {
    const phase = downloadPhase(d?.status?.status, true);
    return phase !== "ready" && phase !== "failed";
  }).length;
  const finished = entries.filter((d) => d?.status?.status === "READY").length;
  const label = `Downloads, ${inProgress} in progress`;

  const close = () => {
    setOpen(false);
    setAnchorEl(null);
  };

  const list =
    entries.length === 0 ? (
      <Typography role="status" variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
        No downloads yet
      </Typography>
    ) : (
      <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {entries.map((download) => {
          const props = download?.properties ?? {};
          const status: string | undefined = download?.status?.status;
          const percent = Math.max(0, Math.min(100, Math.round(download?.status?.percentLoaded ?? 0)));
          const phase = downloadPhase(status, true);
          const filename: string = props.filename || download?.identifier;
          const kind = fileKind(props.mimeType || props.mimetype, filename);
          const shareId = props.jsonId;
          const publisher = props.name || download?.name;
          // Only rows without a running poller can be removed; a live poller would re-add the entry.
          const removable = phase === "ready" || phase === "failed";
          // The actions sit in the row beside the text, not in MUI's secondaryAction,
          // whose fixed right padding let the Save button cover the progress bar.
          return (
            <ListItem
              key={download?.identifier}
              disablePadding
              sx={{ borderRadius: 2, border: 1, borderColor: "divider", alignItems: "stretch" }}
            >
              <ListItemButton
                onClick={() => {
                  if (shareId && publisher) navigate(sharePath(publisher, shareId));
                  close();
                }}
                aria-label={`${filename}: ${downloadStatusText(status, percent)}`}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "center",
                  gap: 0.75,
                  minWidth: 0,
                  minHeight: 56,
                  borderRadius: 2,
                  ...(removable && { borderTopRightRadius: 0, borderBottomRightRadius: 0 }),
                  px: 1.5,
                  py: 1,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  {fileKindIconElement(kind, { fontSize: "small", sx: { color: "text.secondary", flexShrink: 0 } })}
                  <Typography sx={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{filename}</Typography>
                </Box>
                {/* A finished row says "Ready to save"; a full bar adds nothing. */}
                {phase !== "ready" && (
                  <LinearProgress
                    variant={phase === "building" ? "indeterminate" : "determinate"}
                    value={percent}
                    color={phase === "failed" ? "error" : "primary"}
                    aria-label={`${filename} download progress`}
                    sx={{ borderRadius: 1, height: 5 }}
                  />
                )}
                <Typography variant="caption" color={phase === "failed" ? "error" : "text.secondary"} sx={{ fontSize: 13 }}>
                  {downloadStatusText(status, percent)}
                </Typography>
              </ListItemButton>
              {removable && (
                <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, pr: 0.5 }}>
                  {phase === "ready" && (
                    <IconButton
                      aria-label={`Save ${filename}`}
                      onClick={() => saveItem(download)}
                      disabled={savingId === download?.identifier}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <SaveAltOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    aria-label={`Remove ${filename} from the list`}
                    onClick={() => dispatch(removeDownload(download.identifier))}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </ListItem>
          );
        })}
      </List>
    );

  const clearButton =
    finished > 0 ? (
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          variant="text"
          size="small"
          onClick={() => dispatch(clearFinishedDownloads())}
          sx={{ minHeight: 44, width: phone ? "100%" : "auto" }}
        >
          Clear finished
        </Button>
      </Box>
    ) : null;

  return (
    <>
      {hideButton ? null : (
      <Tooltip title="Downloads">
        <IconButton
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => {
            setAnchorEl(e.currentTarget);
            setOpen(true);
          }}
          sx={{ color: "text.primary", minWidth: 44, minHeight: 44 }}
        >
          <Badge badgeContent={inProgress} color="primary" overlap="circular">
            {/* Idle shows the plain download icon, like the bottom bar: a check mark did not read as Downloads. */}
            {inProgress > 0 ? <DownloadingOutlinedIcon className="download-icon" /> : <DownloadOutlinedIcon />}
          </Badge>
        </IconButton>
      </Tooltip>
      )}
      {phone ? (
        <BottomSheet open={open} onClose={close} title="Downloads">
          {list}
          {clearButton}
        </BottomSheet>
      ) : (
        <Popover
          id="download-popover"
          open={open}
          anchorEl={anchorEl}
          onClose={close}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box sx={{ width: 320, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(var(--qshare-app-height, 100dvh) * 0.6)", overflowY: "auto", p: 1.5 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
              Downloads
            </Typography>
            {list}
            {clearButton}
          </Box>
        </Popover>
      )}
    </>
  );
};
