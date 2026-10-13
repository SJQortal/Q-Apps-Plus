/**
 * A comment's text: plain text only (never HTML or markdown; React escapes
 * it), line breaks kept, long ones folded with "Read more", and its
 * `qortal://` links as buttons that open in a new Hub tab.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { commentLinks } from '../../data/commentRecords';
import { QortalLinks } from '../../pages/history/parts/LegacyText';

const FOLD_CHARS = 420;
const FOLD_LINES = 7;

export function CommentText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = text.length > FOLD_CHARS || text.split('\n').length > FOLD_LINES;
  const links = commentLinks(text);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Typography
        id={id}
        component="p"
        sx={{
          m: 0,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...(long && !open
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {text}
      </Typography>
      {long ? (
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          {open ? 'Show less' : 'Read more'}
        </Button>
      ) : null}
      <QortalLinks links={links} />
    </Box>
  );
}
