/**
 * The attachment viewer: full-screen on phones, a large dialog elsewhere.
 * Shows one attachment of a message at a time with Previous/Next (buttons,
 * arrow keys, swipe), Save and Close. Bytes come from the session cache
 * (useAttachment), so re-opening costs no Qortal calls.
 *
 * Loaded lazily (see index.tsx); the PDF engine is loaded lazily again from
 * inside PdfViewer, only when a PDF is opened.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useDispatch } from 'react-redux';
import { setNotification } from '../../state/features/notificationsSlice';
import { useLayoutMode } from '../../layout/useLayoutMode';
import { ErrorState, FetchingFromPeers } from '../../layout/states';
import { attachmentDisplayName, attachmentKind, attachmentSizeHint, formatFileSize, type AttachmentRef } from '../../utils/attachmentMeta';
import { prefetchPdfJsWorker } from '../../utils/pdf/pdfJsHub';
import { useAttachment } from './useAttachment';
import { ImageViewer } from './ImageViewer';
import { TextViewer } from './TextViewer';
import { SaveCard } from './SaveCard';
import { PdfViewer } from './PdfViewer';
import { useReaderGestures } from './useReaderGestures';

export interface AttachmentPreviewProps {
  open: boolean;
  attachments: AttachmentRef[];
  /** Which attachment to show first. */
  index: number;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}

function PdfFromBlob({ blob, title }: { blob: Blob; title: string }) {
  const [data, setData] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    blob
      .arrayBuffer()
      .then((buffer) => {
        if (!cancelled) setData(buffer);
      })
      .catch(() => {
        if (!cancelled) setError('This PDF could not be read.');
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);
  if (error) return <ErrorState title="PDF preview failed" message={error} />;
  if (!data) return <FetchingFromPeers status="BUILDING" />;
  return <PdfViewer data={data} title={title} />;
}

export function AttachmentPreviewDialog({ open, attachments, index, onIndexChange, onClose }: AttachmentPreviewProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const phone = useLayoutMode() === 'phone';
  const [current, setCurrent] = useState(index);
  const [saving, setSaving] = useState(false);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) setCurrent(Math.min(Math.max(0, index), Math.max(0, attachments.length - 1)));
  }, [open, index, attachments.length]);

  const ref = attachments[current] || null;
  const attachment = useAttachment(open ? ref : null, { auto: true });
  const kind = useMemo(() => attachmentKind(ref, attachment.entry?.mimeType), [ref, attachment.entry?.mimeType]);
  const name = attachmentDisplayName(ref);
  const size = attachment.entry?.size ?? attachmentSizeHint(ref);
  const count = attachments.length;
  const canPrev = current > 0;
  const canNext = current < count - 1;

  // Start pulling the PDF engine while the bytes are still arriving.
  useEffect(() => {
    if (open && kind === 'pdf') prefetchPdfJsWorker();
  }, [open, kind]);

  const go = useCallback(
    (step: 1 | -1) => {
      setCurrent((c) => {
        const next = Math.min(Math.max(0, c + step), Math.max(0, count - 1));
        if (next !== c) onIndexChange?.(next);
        return next;
      });
    },
    [count, onIndexChange]
  );

  useEffect(() => {
    if (!open || kind === 'pdf') return; // the PDF reader uses the arrows for pages
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' && canNext) go(1);
      else if (event.key === 'ArrowLeft' && canPrev) go(-1);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, kind, canNext, canPrev, go]);

  // Swipe between attachments on the non-zoomable viewers (images handle their own).
  useReaderGestures(kind === 'image' || kind === 'pdf' ? null : stageNode, {
    onSwipe: (direction) => {
      if (direction > 0 && canNext) go(1);
      else if (direction < 0 && canPrev) go(-1);
    },
  });

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await attachment.save();
    } catch (error: any) {
      const msg = typeof error === 'string' ? error : typeof error?.error === 'string' ? error.error : error?.message || 'The file could not be saved.';
      dispatch(setNotification({ msg, alertType: 'error' }));
    } finally {
      setSaving(false);
    }
  };

  const entry = attachment.entry;
  const stalled = attachment.status === 'MISSING_DATA' || attachment.status === 'FAILED';

  let body: React.ReactNode;
  if (!ref) {
    body = <ErrorState title="Nothing to show" />;
  } else if (attachment.phase === 'error') {
    body = <ErrorState title="This file could not be opened" message={attachment.error || undefined} onRetry={attachment.retry} />;
  } else if (!entry) {
    body = (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 480, width: '100%', mx: 'auto' }}>
        <FetchingFromPeers
          status={attachment.phase === 'decrypting' ? 'BUILDING' : attachment.status}
          percentLoaded={attachment.percent}
          onRetry={stalled ? attachment.retry : undefined}
        />
      </Box>
    );
  } else if (kind === 'image') {
    body = (
      <ImageViewer
        src={entry.url}
        alt={name}
        onSwipe={(direction) => {
          if (direction > 0 && canNext) go(1);
          else if (direction < 0 && canPrev) go(-1);
        }}
      />
    );
  } else if (kind === 'text') {
    body = <TextViewer blob={entry.blob} title={name} />;
  } else if (kind === 'audio') {
    body = (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 2 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere', textAlign: 'center' }}>{name}</Typography>
        <audio controls src={entry.url} style={{ width: '100%', maxWidth: 560 }} aria-label={name} />
      </Box>
    );
  } else if (kind === 'video') {
    body = (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: theme.palette.common.black, borderRadius: 2 }}>
        <video controls playsInline src={entry.url} style={{ maxWidth: '100%', maxHeight: '100%', width: '100%', display: 'block' }} aria-label={name} />
      </Box>
    );
  } else if (kind === 'pdf') {
    body = <PdfFromBlob blob={entry.blob} title={name} />;
  } else {
    body = <SaveCard name={name} kind={kind} mimeType={entry.mimeType} size={entry.size} saving={saving} onSave={() => void save()} />;
  }

  const sizeLabel = formatFileSize(size);
  const subtitle = [count > 1 ? `${current + 1} of ${count}` : '', sizeLabel].filter(Boolean).join(' · ');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={phone}
      aria-labelledby="attachment-preview-title"
      slotProps={{ paper: { sx: phone ? undefined : { height: 'calc(100% - 64px)' } } }}
    >
      <DialogTitle
        id="attachment-preview-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: phone ? 0.75 : 1.5, pl: phone ? 2 : 3, pr: phone ? 0.5 : 2 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" noWrap sx={{ display: 'block', fontWeight: 700, fontSize: phone ? '1rem' : '1.1rem' }}>
            {name}
          </Typography>
          {subtitle && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {count > 1 && (
          <>
            <IconButton aria-label="Previous attachment" disabled={!canPrev} onClick={() => go(-1)} sx={{ minWidth: 44, minHeight: 44 }}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton aria-label="Next attachment" disabled={!canNext} onClick={() => go(1)} sx={{ minWidth: 44, minHeight: 44 }}>
              <ChevronRightIcon />
            </IconButton>
          </>
        )}
        {phone && (
          <>
            <IconButton aria-label="Save" title="Save" onClick={() => void save()} disabled={saving || !entry} sx={{ minWidth: 44, minHeight: 44 }}>
              <DownloadOutlinedIcon />
            </IconButton>
            <IconButton aria-label="Close preview" title="Close" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
              <CloseIcon />
            </IconButton>
          </>
        )}
      </DialogTitle>
      <DialogContent
        ref={setStageNode}
        sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', px: phone ? 1 : 3, pb: phone ? 1 : 2, pt: 0 }}
      >
        {body}
      </DialogContent>
      {!phone && (
        <DialogActions>
          <Button onClick={() => void save()} disabled={saving || !entry} startIcon={<DownloadOutlinedIcon />} sx={{ minHeight: 44 }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default AttachmentPreviewDialog;
