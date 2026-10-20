/**
 * For three or four accounts, every pair at a glance: "A–B: 2 recorded,
 * 1 in common", "A–C: none found", or after a failed read "A–D: couldn’t
 * read everything". A pair with something recorded jumps to its block in
 * "Recorded between them" (focus goes there too); one whose reads failed
 * jumps to where its Retry is; one with only something in common jumps to
 * In common; one with nothing is plain text.
 */
import { Box, ButtonBase, Typography } from '@mui/material';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { pairSummary, type Letter, type PairState } from '../../../rules/explorer/compare';
import { LetterBadge } from './letters';
import { pairAnchorId } from './compareView';

export interface PairGridRow {
  /** "A–B". */
  label: string;
  id: string;
  i: number;
  j: number;
  recorded: number;
  inCommon: number;
  state: PairState;
  /** Where the Retry for its failed reads is (an element id), when some failed. */
  retryAt?: string;
}

const ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minHeight: 44,
  width: '100%',
  px: 1,
  borderRadius: 1,
  textAlign: 'left',
  justifyContent: 'flex-start',
  fontSize: 15,
} as const;

export function PairGrid({
  rows,
  letters,
  accents,
}: {
  rows: readonly PairGridRow[];
  letters: readonly Letter[];
  accents: readonly string[];
}) {
  const reduced = useReducedMotion();
  const jump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  return (
    <Box
      component="nav"
      aria-label="Pairs"
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: 0.5,
      }}
    >
      <Box
        component="ul"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 0.25,
        }}
      >
        {rows.map((row) => {
          const summary = pairSummary(row.recorded, row.inCommon, row.state);
          const target = row.recorded
            ? pairAnchorId(row.id)
            : row.state === 'failed' && row.retryAt
              ? row.retryAt
              : row.inCommon
                ? 'compare-common'
                : null;
          const content = (
            <>
              <Box component="span" sx={{ display: 'inline-flex', gap: 0.25 }} aria-hidden>
                <LetterBadge letter={letters[row.i]} accent={accents[row.i]} size={22} />
                <LetterBadge letter={letters[row.j]} accent={accents[row.j]} size={22} />
              </Box>
              <span>
                <strong>{row.label}</strong>: {summary}
              </span>
            </>
          );
          return (
            <li key={row.id}>
              {target ? (
                <ButtonBase
                  onClick={() => jump(target)}
                  sx={{
                    ...ROW_SX,
                    color: 'primary.main',
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main' },
                  }}
                >
                  {content}
                </ButtonBase>
              ) : (
                <Typography component="span" sx={{ ...ROW_SX, color: 'text.secondary' }}>
                  {content}
                </Typography>
              )}
            </li>
          );
        })}
      </Box>
    </Box>
  );
}
