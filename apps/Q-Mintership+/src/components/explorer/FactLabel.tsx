/**
 * A fact's label, with its ⓘ just after it (Simon, 2026-10-18: "I want these
 * i (information) icons to show to the right of QORT Minted text so the QORT
 * can fit next to the amount not under it"): the value keeps its line.
 */
import { Typography } from '@mui/material';
import { InfoTip } from '../common/InfoTip';

export function FactLabel({ label, info }: { label: string; info?: string | null }) {
  // "About node online: …", "About QORT minted: …".
  const named = /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
  return (
    <Typography
      component="dt"
      variant="body2"
      color="text.secondary"
      sx={info ? { display: 'flex', alignItems: 'center', gap: 0.75 } : undefined}
    >
      {label}
      {info ? <InfoTip label={`About ${named}: ${info}`}>{info}</InfoTip> : null}
    </Typography>
  );
}
