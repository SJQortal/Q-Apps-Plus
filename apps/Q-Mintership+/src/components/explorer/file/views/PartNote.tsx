/** The line under a file shown in part (rules/explorer/qdnFileWords.ts partLine). */
import { Typography } from '@mui/material';
import { partLine } from '../../../../rules/explorer/qdnFileWords';

export function PartNote({
  shown,
  size,
  more,
}: {
  shown: number;
  size: number | null;
  more: boolean;
}) {
  if (!more) return null;
  return (
    <Typography variant="body2" color="text.secondary" role="note">
      {partLine(shown, size)}
    </Typography>
  );
}
