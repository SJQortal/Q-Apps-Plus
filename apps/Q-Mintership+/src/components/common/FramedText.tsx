/**
 * Someone's own words set apart from a card's other lines, in a framed
 * box (an accent border on a light tint): a nomination's reason with its
 * links, a Minter Admin poll's details. Shown in full on wider screens. On
 * phones a long text shows its first lines with a button (only when it is
 * really cut off: measured); compact cards keep three lines, no button.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { accentWash } from '../../hub-theme';
import { useClamped } from '../../hooks/useClamped';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { QortalLinks } from './QortalLinks';

/** Lines a text shows on a phone before its button. */
const PHONE_LINES = 4;

export function FramedText({
  text,
  links = [],
  moreLabel = 'Show more',
  compact = false,
}: {
  text: string;
  /** qortal:// links shown under the text, inside the frame. */
  links?: string[];
  /** The phone button's words: "Show the whole reason", "Show more". */
  moreLabel?: string;
  /** Three lines at most, no button (compact cards). */
  compact?: boolean;
}) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const id = useId();
  const lines = compact ? 3 : phone && !open ? PHONE_LINES : null;
  const clamped = useClamped(lines ? node : null, `${text}:${lines}`);
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
        borderColor: accentWash(theme, 0.45),
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: accentWash(theme, 0.08),
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
        {text}
      </Typography>
      {canToggle ? (
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          sx={{ alignSelf: 'flex-start', minHeight: 44, mt: -0.5, ml: -0.75 }}
        >
          {open ? 'Show less' : moreLabel}
        </Button>
      ) : null}
      {links.length ? <QortalLinks links={links} /> : null}
    </Box>
  );
}
