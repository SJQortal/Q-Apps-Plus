/**
 * Old card and comment text, shown as plain paragraphs (never as HTML); their
 * qortal:// links show as QortalLinks.
 */
import { Box, Typography } from '@mui/material';
import type { LegacyText } from '../../../data/legacy';

export function LegacyTextView({ text }: { text: LegacyText }) {
  if (!text.paragraphs.length) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {text.paragraphs.map((p, i) => (
        <Typography
          key={i}
          component="p"
          sx={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere', m: 0 }}
        >
          {p}
        </Typography>
      ))}
    </Box>
  );
}
