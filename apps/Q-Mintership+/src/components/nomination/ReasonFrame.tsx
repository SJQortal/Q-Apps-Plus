/**
 * A nomination's reason, with its links, in a subtle frame that sets the
 * nominator's own words apart from the card's other lines. Shown in full;
 * a compact card (Home) keeps it to three lines.
 */
import { Box, Typography } from '@mui/material';
import { accentWash } from '../../hub-theme';
import { QortalLinks } from '../common/QortalLinks';

export function ReasonFrame({
  reason,
  links,
  compact = false,
}: {
  reason: string;
  links: string[];
  /** Three lines at most (compact cards). */
  compact?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minWidth: 0,
        px: { xs: 1.25, sm: 1.5 },
        py: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: accentWash(theme, 0.04),
      })}
    >
      <Typography
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(compact
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {reason}
      </Typography>
      <QortalLinks links={links} />
    </Box>
  );
}
