/**
 * The fallback for anything the app cannot show in place (archives, office
 * documents, unknown types): name, type, size and a Save button.
 */
import { Box, Button, Typography } from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { formatFileSize, type AttachmentKind } from '../../utils/attachmentMeta';
import { AttachmentIcon } from './AttachmentIcon';

export function SaveCard({
  name,
  kind,
  mimeType,
  size,
  saving,
  onSave,
}: {
  name: string;
  kind: AttachmentKind;
  mimeType?: string;
  size?: number;
  saving?: boolean;
  onSave: () => void;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1,
        p: 3,
        color: 'text.secondary',
      }}
    >
      <AttachmentIcon kind={kind} sx={{ fontSize: 56, opacity: 0.75 }} />
      <Typography sx={{ fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}>{name}</Typography>
      <Typography variant="body2">
        {[mimeType, formatFileSize(size)].filter(Boolean).join(' · ')}
      </Typography>
      <Typography variant="body2">This kind of file opens outside Q-Mail.</Typography>
      <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={onSave} disabled={saving} sx={{ mt: 1, minHeight: 44 }}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </Box>
  );
}
