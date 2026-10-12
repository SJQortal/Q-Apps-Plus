/**
 * Old card and comment text, shown as plain paragraphs (never as HTML), and
 * their qortal:// links as buttons that open in a new Hub tab.
 */
import { Box, Button, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import type { LegacyText } from '../../../data/legacy';
import { openQortalLink } from '../../../utils/links';

export function LegacyTextView({ text, clamp }: { text: LegacyText; clamp?: number }) {
  if (!text.paragraphs.length) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        ...(clamp
          ? {
              display: '-webkit-box',
              WebkitLineClamp: clamp,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }
          : {}),
      }}
    >
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

export function QortalLinks({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0 }}>
      {links.map((link) => (
        <Button
          key={link}
          size="small"
          variant="outlined"
          endIcon={<OpenInNewOutlinedIcon />}
          onClick={() => void openQortalLink(link)}
          sx={{
            minHeight: 44,
            textTransform: 'none',
            maxWidth: '100%',
            justifyContent: 'flex-start',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.replace(/^qortal:\/\//i, '')}
          </span>
        </Button>
      ))}
    </Box>
  );
}
