/**
 * A nomination's reason, with its links, in a frame that sets the
 * nominator's own words apart from the card's other lines. Shown in full on
 * wider screens. On phones a long
 * reason shows its first lines with "Show the whole reason" (only when it
 * is really cut off: measured); Home's compact cards keep three lines.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { accentWash } from '../../hub-theme';
import { useClamped } from '../../hooks/useClamped';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { QortalLinks } from '../common/QortalLinks';

/** Lines a reason shows on a phone before "Show the whole reason". */
const PHONE_LINES = 4;

export function ReasonFrame({
  reason,
  links,
  compact = false,
}: {
  reason: string;
  links: string[];
  /** Three lines at most, no button (compact cards). */
  compact?: boolean;
}) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const id = useId();
  const lines = compact ? 3 : phone && !open ? PHONE_LINES : null;
  const clamped = useClamped(lines ? node : null, `${reason}:${lines}`);
  const canToggle = !compact && phone && (clamped || open);
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
        ref={setNode}
        id={id}
        sx={{
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(lines
            ? {
                display: '-webkit-box',
                WebkitLineClamp: lines,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {reason}
      </Typography>
      {canToggle ? (
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          sx={{ alignSelf: 'flex-start', minHeight: 44, mt: -0.5, ml: -0.75 }}
        >
          {open ? 'Show less' : 'Show the whole reason'}
        </Button>
      ) : null}
      <QortalLinks links={links} />
    </Box>
  );
}
