/** Small pieces of the QORT summaries (qortSummaries.tsx). */
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { InfoTip } from '../../../../components/common/InfoTip';
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

export function Value({
  children,
  info,
  label,
}: {
  children: ReactNode;
  info?: string;
  label: string;
}) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {children}
      {info ? <InfoTip label={`About ${label}: ${info}`}>{info}</InfoTip> : null}
    </Box>
  );
}
