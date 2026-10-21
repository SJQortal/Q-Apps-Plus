/** Small pieces of the QORT summaries (qortSummaries.tsx). */
import { Box } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { readableOnTint } from '../../../../utils/readable';

/** Green or red as text on a field block (its tint is at most 6% of the text colour). */
const onBlock = (tone: 'success' | 'error') => (theme: Theme) =>
  readableOnTint(theme, theme.palette[tone].main, 0.06);

/** "27,217 / 0": what came in, in green, and what went out, in red. */
export function InOut({ into, out }: { into: string; out: string }) {
  return (
    <span>
      <Box component="span" sx={{ color: onBlock('success') }}>
        {into}
      </Box>
      {' / '}
      <Box component="span" sx={{ color: onBlock('error') }}>
        {out}
      </Box>
    </span>
  );
}
