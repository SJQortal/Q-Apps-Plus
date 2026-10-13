/**
 * "Target may drop to 8" on a decision a waiting admin change would tip
 * over: a chip-shaped button (44 px, with aria-expanded) in the card's
 * title row, and its explanation, which opens under the card's header one
 * tap away: which change, the new target, what Core would do, and for
 * Minter Admins what they can do about it. Nothing is hover-only.
 */
import { Box, Button, Typography } from '@mui/material';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { formatQort } from '../../data/accounts';
import { useFee } from '../../hooks/useFee';
import type { DecisionRisk } from '../../rules/targetShift';
import { readable } from '../../utils/readable';
import {
  ORDER_ADVICE,
  riskChipLabel,
  riskExplanation,
  withdrawAdvice,
  type LabelOf,
} from './targetShiftUi';

export function TargetRiskChip({
  risk,
  open,
  onToggle,
  controls,
}: {
  risk: DecisionRisk;
  open: boolean;
  onToggle: () => void;
  /** The id of the explanation (TargetRiskNote). */
  controls: string;
}) {
  const drop = risk.effect.neededThen < risk.effect.neededNow;
  const tone = risk.effect.effect === 'needsMore' ? 'info' : 'warning';
  const Icon = drop ? TrendingDownOutlinedIcon : TrendingUpOutlinedIcon;
  return (
    <Button
      variant="outlined"
      size="small"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      startIcon={<Icon aria-hidden />}
      sx={{
        minHeight: 44,
        borderRadius: 22,
        px: 1.5,
        textTransform: 'none',
        fontWeight: 700,
        color: readable(tone),
        borderColor: `${tone}.main`,
      }}
    >
      {riskChipLabel(risk)}
    </Button>
  );
}

/** The chip's explanation, under the card's header while the chip is open. */
export function TargetRiskNote({
  id,
  risk,
  labelOf,
  advice,
}: {
  id: string;
  risk: DecisionRisk;
  labelOf: LabelOf;
  /** Minter Admins also get what they can do about it. */
  advice: boolean;
}) {
  const fee = useFee('GROUP_APPROVAL');
  const flips = risk.effect.effect !== 'needsMore';
  return (
    <Box
      id={id}
      sx={{
        p: 1.5,
        border: 1,
        borderColor: flips ? 'warning.main' : 'divider',
        borderRadius: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        overflowWrap: 'anywhere',
      }}
    >
      {riskExplanation(risk, labelOf).map((line) => (
        <Typography key={line} variant="body2">
          {line}
        </Typography>
      ))}
      {flips && advice ? (
        <>
          <Typography variant="body2">{ORDER_ADVICE}</Typography>
          <Typography variant="body2">
            {withdrawAdvice(formatQort(fee.data?.qort ?? 0.01))}
          </Typography>
        </>
      ) : null}
    </Box>
  );
}
