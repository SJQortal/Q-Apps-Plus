/**
 * A video or a sound, played from the node's URL (Core serves ranges, so it
 * streams and seeks). Nothing loads before play but its first frame and
 * length. No type is given to the player: it reads the format from the
 * file itself, so a video the browser can play under another name (a
 * Matroska file holding VP9) still plays. A format it can't play says so:
 * Save File is beside it.
 */
import { useState } from 'react';
import { Box, Typography } from '@mui/material';

export const MEDIA_FAILED = {
  video:
    'This video can’t play here (its format may not be one this browser plays). Save File keeps it on your device.',
  audio:
    'This sound can’t play here (its format may not be one this browser plays). Save File keeps it on your device.',
} as const;

export function MediaView({
  src,
  kind,
  label,
}: {
  src: string;
  kind: 'video' | 'audio';
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <Typography role="status" color="text.secondary" sx={{ py: 3 }}>
        {MEDIA_FAILED[kind]}
      </Typography>
    );
  if (kind === 'audio')
    return (
      <Box sx={{ py: 2 }}>
        <audio
          controls
          preload="metadata"
          src={src}
          aria-label={label}
          onError={() => setFailed(true)}
          style={{ width: '100%' }}
        />
      </Box>
    );
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'common.black',
      }}
    >
      <video
        controls
        playsInline
        preload="metadata"
        src={src}
        aria-label={label}
        onError={() => setFailed(true)}
        style={{ display: 'block', width: '100%', height: '100%', maxHeight: '100%' }}
      />
    </Box>
  );
}
