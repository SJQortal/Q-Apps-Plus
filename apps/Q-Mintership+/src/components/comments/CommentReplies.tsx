/**
 * The replies under a comment, set apart so they read as answers to it:
 * indented past its avatar (a little on phones), on a light tint, with an
 * accent rail down the side. Each reply quotes the comment it answers
 * (CommentItem's ReplyQuote). The reply being written goes in
 * `ReplyComposerBox`, lined up with them.
 */
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { accentWash } from '../../hub-theme';

/** Past the parent's 28 px avatar and its gap, so replies hang from its text. */
const INDENT = { xs: 0.5, sm: 4.75 };

export function CommentReplies({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Box
      component="ul"
      aria-label={`Replies to ${name}`}
      sx={(theme) => ({
        listStyle: 'none',
        m: 0,
        mt: 1,
        ml: INDENT,
        p: 0,
        pl: { xs: 1.25, sm: 1.75 },
        pr: { xs: 0.75, sm: 1.25 },
        borderLeft: 3,
        borderColor: accentWash(theme, 0.55),
        bgcolor: accentWash(theme, 0.05),
        borderRadius: `0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0`,
        '& > li + li': { borderTop: 1, borderColor: 'divider' },
      })}
    >
      {children}
    </Box>
  );
}

export function ReplyComposerBox({ children }: { children: ReactNode }) {
  return <Box sx={{ ml: INDENT, pl: { xs: 1.25, sm: 1.75 }, pt: 1 }}>{children}</Box>;
}
