/**
 * The attachments of a message as cards, with "Download all" when there are
 * several, and the preview dialog they open.
 */
import { useMemo, useState } from 'react';
import { Box, Button, LinearProgress, Typography } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useDispatch } from 'react-redux';
import { setNotification } from '../../state/features/notificationsSlice';
import type { AttachmentRef } from '../../utils/attachmentMeta';
import { AttachmentCard } from './AttachmentCard';
import { AttachmentPreview } from './index';
import { useDownloadAll } from './useDownloadAll';

export interface AttachmentListProps {
  attachments: unknown;
  compact?: boolean;
  /** Hide the Download-all control (when the reader's action row has Save all). */
  hideDownloadAll?: boolean;
}

/** Keep only references the readers can use (identifier, name and service are required: data contract §6). */
export function usableAttachments(value: unknown): AttachmentRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is AttachmentRef => Boolean(a) && typeof a === 'object' && typeof a.identifier === 'string' && typeof a.name === 'string' && typeof a.service === 'string'
  );
}

export function AttachmentList({ attachments, compact, hideDownloadAll }: AttachmentListProps) {
  const dispatch = useDispatch();
  const list = useMemo(() => usableAttachments(attachments), [attachments]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const downloadAll = useDownloadAll(list);

  if (!list.length) return null;

  const runDownloadAll = async () => {
    const result = await downloadAll.run();
    if (result.failed.length) {
      dispatch(setNotification({ msg: `Could not save: ${result.failed.join(', ')}`, alertType: 'error' }));
    } else if (result.saved > 0) {
      dispatch(setNotification({ msg: `Saved ${result.saved} file${result.saved === 1 ? '' : 's'}`, alertType: 'success' }));
    }
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: compact ? '1fr' : { xs: '1fr', md: list.length > 1 ? 'repeat(2, minmax(0, 1fr))' : '1fr' },
        }}
      >
        {list.map((attachment, index) => (
          <AttachmentCard key={`${attachment.identifier}-${index}`} attachment={attachment} compact={compact} onOpen={() => setOpenIndex(index)} />
        ))}
      </Box>
      {list.length > 1 && !hideDownloadAll && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {downloadAll.progress.active ? (
            <>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Typography variant="body2" color="text.secondary">
                  Saving {downloadAll.progress.current} of {downloadAll.progress.total}…
                </Typography>
                <LinearProgress variant="determinate" value={(100 * (downloadAll.progress.current - 1)) / Math.max(1, downloadAll.progress.total)} sx={{ borderRadius: 2, mt: 0.5 }} />
              </Box>
              <Button size="small" onClick={downloadAll.cancel} sx={{ minHeight: 44 }}>
                Cancel
              </Button>
            </>
          ) : (
            <Button size="small" variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={() => void runDownloadAll()} sx={{ minHeight: 44 }}>
              Download all ({list.length})
            </Button>
          )}
        </Box>
      )}
      <AttachmentPreview open={openIndex !== null} attachments={list} index={openIndex ?? 0} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
    </Box>
  );
}
