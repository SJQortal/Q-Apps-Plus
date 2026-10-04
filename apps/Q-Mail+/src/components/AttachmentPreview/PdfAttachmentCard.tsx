/**
 * A PDF attachment, laid out like a file on a Q-Share+ share page: the kind
 * icon, a filename that wraps, "PDF · size", then the download control
 * (Download → progress → Save) beside "Open PDF".
 *
 * "Open PDF" fetches and decrypts the attachment once (session cache, see
 * useAttachment) and hands the bytes to Hub's own PDF reader
 * (SHOW_PDF_READER, utils/pdf/hubPdfReader). While the file is still on its
 * way the button says "Opens when ready" and the progress shows beside it;
 * it opens by itself when ready. Where Hub has no reader (an older Hub, or
 * not in Hub) the bundled pdf.js viewer opens instead (`onOpenInApp`).
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Box, Button, CircularProgress, LinearProgress, Typography, useTheme } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import { useDispatch } from 'react-redux';
import { setNotification } from '../../state/features/notificationsSlice';
import { useLayoutMode } from '../../layout/useLayoutMode';
import { attachmentDisplayName, attachmentSizeHint, formatFileSize, type AttachmentRef } from '../../utils/attachmentMeta';
import { PDF_NOT_A_PDF, PDF_OPEN_MAX_BYTES, PDF_TOO_LARGE, openPdfInHub } from '../../utils/pdf/hubPdfReader';
import { useAttachment } from './useAttachment';

export interface PdfAttachmentCardProps {
  attachment: AttachmentRef;
  /** Opens the bundled viewer (the preview dialog) when Hub's reader is missing. */
  onOpenInApp: () => void;
  compact?: boolean;
}

/** Q-Share+'s download wording for a Core resource status. */
export function pdfDownloadStatusText(status: string, percent: number | undefined, decrypting: boolean): string {
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  if (decrypting) return 'Decrypting…';
  switch (status) {
    case 'DOWNLOADED':
    case 'BUILDING':
      return 'Building file…';
    case 'MISSING_DATA':
      return `Waiting for peers… ${pct}%`;
    case 'FAILED':
      return `Stalled, retrying… ${pct}%`;
    default:
      return `Fetching from peers… ${pct}%`;
  }
}

function errorText(error: any): string {
  if (typeof error === 'string') return error;
  if (typeof error?.error === 'string') return error.error;
  return error?.message || 'The file could not be saved.';
}

export function PdfAttachmentCard({ attachment, onOpenInApp, compact }: PdfAttachmentCardProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const phone = useLayoutMode() === 'phone';
  const state = useAttachment(attachment);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const opening = useRef(false);
  const onOpenInAppRef = useRef(onOpenInApp);
  onOpenInAppRef.current = onOpenInApp;

  const name = attachmentDisplayName(attachment);
  const size = state.entry?.size ?? attachmentSizeHint(attachment);
  const tooLarge = (size ?? 0) > PDF_OPEN_MAX_BYTES;
  const { phase, entry } = state;

  // Opens once the bytes are here: at once when they were cached, or when
  // the fetch started by the tap finishes. One open at a time.
  useEffect(() => {
    if (!pending) return;
    if (phase === 'error') {
      setPending(false);
      return;
    }
    if (!entry || opening.current) return;
    opening.current = true;
    void openPdfInHub(entry.blob).then((result) => {
      opening.current = false;
      setPending(false);
      if (result === 'unavailable') onOpenInAppRef.current();
      else if (result === 'too-large') setMessage(PDF_TOO_LARGE);
      else if (result === 'not-pdf') setMessage(PDF_NOT_A_PDF);
    });
  }, [pending, phase, entry]);

  const fetchNow = () => {
    if (phase === 'error') state.retry();
    else state.start();
  };

  const openPdf = (event: MouseEvent) => {
    event.stopPropagation();
    setMessage(null);
    setPending(true);
    if (!entry) fetchNow();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await state.save();
    } catch (error) {
      dispatch(setNotification({ msg: errorText(error), alertType: 'error' }));
    } finally {
      setSaving(false);
    }
  };

  const bigButton = { minHeight: phone ? 48 : 44, width: phone ? '100%' : 'auto', flexShrink: 0 };
  const stalled = state.status === 'MISSING_DATA' || state.status === 'FAILED';

  let download: React.ReactNode;
  if (phase === 'idle') {
    download = (
      <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={fetchNow} aria-label={`Download ${name}`} sx={bigButton}>
        Download
      </Button>
    );
  } else if (phase === 'ready') {
    download = (
      <Button
        variant="contained"
        startIcon={<SaveAltOutlinedIcon />}
        onClick={() => void save()}
        disabled={saving}
        aria-label={`Save ${name}`}
        sx={bigButton}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    );
  } else if (phase === 'error') {
    download = (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
        <Typography variant="body2" color="error" role="status" sx={{ overflowWrap: 'anywhere' }}>
          {state.error || 'This file could not be opened.'}
        </Typography>
        <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={fetchNow} sx={{ minHeight: 44 }}>
          Try again
        </Button>
      </Box>
    );
  } else {
    const decrypting = phase === 'decrypting';
    const building = decrypting || state.status === 'DOWNLOADED' || state.status === 'BUILDING';
    const known = typeof state.percent === 'number' && state.percent > 0;
    download = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', minWidth: 0 }}>
        <LinearProgress
          variant={building || !known ? 'indeterminate' : 'determinate'}
          value={state.percent ?? 0}
          aria-label={`${name} download progress`}
          sx={{ borderRadius: 1, height: 6 }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
            {pdfDownloadStatusText(state.status, state.percent, decrypting)}
          </Typography>
          {stalled && (
            <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={state.retry} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  const busy = pending && phase !== 'error';
  let open: React.ReactNode;
  if (tooLarge) {
    open = (
      <Typography variant="body2" color="text.secondary" sx={{ width: bigButton.width, alignSelf: 'center' }}>
        {PDF_TOO_LARGE}
      </Typography>
    );
  } else {
    open = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: bigButton.width, flexShrink: 0 }}>
        <Button
          variant="outlined"
          startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfOutlinedIcon />}
          onClick={openPdf}
          disabled={busy}
          aria-label={`Open PDF ${name}`}
          sx={bigButton}
        >
          {!busy ? 'Open PDF' : entry ? 'Opening…' : 'Opens when ready'}
        </Button>
        {message && (
          <Typography variant="body2" color="text.secondary" role="status">
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 1 : 1.5,
        width: '100%',
        minWidth: 0,
        p: compact ? 1.25 : { xs: 1.5, sm: 2 },
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1.5,
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <PictureAsPdfOutlinedIcon />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="p" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {['PDF', formatFileSize(size)].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: phone ? 'column' : 'row',
          alignItems: phone ? 'stretch' : 'center',
          // A half-width card in the two-column grid puts Open PDF under the download control.
          flexWrap: 'wrap',
          gap: 1,
          minWidth: 0,
        }}
      >
        <Box sx={{ flex: '1 1 160px', minWidth: 0, display: 'flex' }}>{download}</Box>
        {open}
      </Box>
    </Box>
  );
}
