/**
 * What an admin change does to the target, before anyone signs it: the new
 * admin seats and target, and each waiting decision it would apply at once,
 * end as rejected at once, or leave short of signatures. Shown on the
 * admin change's card, in Sign, in Propose (before Hub opens) and in Sign
 * several. When it changes any decision, Hub only opens once "I've checked
 * these" is ticked (`ack`).
 */
import { useId } from 'react';
import { Alert, Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import { formatQort } from '../../data/accounts';
import { useFee } from '../../hooks/useFee';
import type { ShiftEffect, ShiftScenario } from '../../rules/targetShift';
import { plural } from '../../utils/format';
import {
  ORDER_ADVICE,
  effectLine,
  joinAnd,
  shiftSentence,
  withdrawAdvice,
  type LabelOf,
} from './targetShiftUi';
import type { Acknowledge } from './useAcknowledge';

export interface TargetImpactProps {
  scenario: ShiftScenario;
  labelOf: LabelOf;
  /** What passes: "If this passes", "If these pass". */
  lead: string;
  /** Minter Admins also get what they can do about it. Default true. */
  advice?: boolean;
  /** The "I've checked these" box, when Hub opens next. */
  ack?: Acknowledge | null;
  /**
   * What a withdrawal has to come before ("the admin change passes", by
   * default); null when one sent now would land too late to count.
   */
  deadline?: string | null;
}

export function TargetImpact({
  scenario: s,
  labelOf,
  lead,
  advice = true,
  ack,
  deadline,
}: TargetImpactProps) {
  const fee = useFee('GROUP_APPROVAL');
  const applies = s.effects.filter((e) => e.effect === 'applies');
  const rejected = s.effects.filter((e) => e.effect === 'rejected');
  const metShort = s.effects.filter((e) => e.effect === 'needsMore' && e.wasMet);
  const othersShort = s.effects.filter((e) => e.effect === 'needsMore' && !e.wasMet);
  const flips = applies.length + rejected.length > 0;
  const affected = s.effects.length > 0;
  // Needing more is worked out at the highest count on the way.
  const rise = s.neededHigh - s.neededNow;

  // Nothing would change: one quiet line, not an alert.
  if (!affected)
    return (
      <Typography variant="body2" color="text.secondary" role="note">
        {shiftSentence(s, lead)} No waiting decision would change because of it.
      </Typography>
    );

  return (
    <Alert
      severity={flips ? 'warning' : 'info'}
      role="note"
      sx={{ '& .MuiAlert-message': { minWidth: 0, width: '100%' }, overflowWrap: 'anywhere' }}
    >
      <Typography sx={{ fontWeight: 700 }}>{shiftSentence(s, lead)}</Typography>
      {s.followOn.length ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          That includes {joinAnd(s.followOn.map(labelOf))}: it has enough approvals at the new
          target, so it would apply at once too and move the target again.
        </Typography>
      ) : null}
      <EffectList
        title="These would apply at once, in the same block or the next, with no new approval:"
        effects={applies}
        labelOf={labelOf}
      />
      <EffectList
        title="These would end as rejected at once:"
        effects={rejected}
        labelOf={labelOf}
      />
      <EffectList
        title="These have enough approvals now and would fall short if the admin change comes first:"
        effects={metShort}
        labelOf={labelOf}
      />
      {othersShort.length && rise > 0 ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {metShort.length ? 'The other ' : ''}
          {plural(othersShort.length, 'decision')} still collecting would each need{' '}
          {plural(rise, 'more approval', 'more approvals')} than now.
        </Typography>
      ) : null}
      {flips && advice ? (
        <>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {ORDER_ADVICE}
          </Typography>
          {deadline !== null ? (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {withdrawAdvice(formatQort(fee.data?.qort ?? 0.01), deadline)}
            </Typography>
          ) : null}
        </>
      ) : null}
      {ack ? <CheckedBox ack={ack} /> : null}
    </Alert>
  );
}

function EffectList({
  title,
  effects,
  labelOf,
}: {
  title: string;
  effects: ShiftEffect[];
  labelOf: LabelOf;
}) {
  if (!effects.length) return null;
  return (
    <Box sx={{ mt: 0.75 }}>
      <Typography variant="body2">{title}</Typography>
      <Box component="ul" sx={{ m: 0, pl: 2.5, typography: 'body2' }}>
        {effects.map((e) => (
          <li key={e.signature}>
            {effectLine(e, labelOf(e.signature))}
            {e.cascade ? ', once the admin change it brings along has applied' : ''}
          </li>
        ))}
      </Box>
    </Box>
  );
}

function CheckedBox({ ack }: { ack: Acknowledge }) {
  const errorId = useId();
  return (
    <Box sx={{ mt: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={ack.checked}
            onChange={(event) => ack.setChecked(event.target.checked)}
            slotProps={{
              input: {
                ref: ack.inputRef,
                'aria-describedby': ack.error ? errorId : undefined,
                'aria-invalid': ack.error || undefined,
              },
            }}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          />
        }
        label="I’ve checked these"
        sx={{ mx: 0, gap: 0.5, '& .MuiFormControlLabel-label': { fontWeight: 600 } }}
      />
      {ack.error ? (
        <Typography id={errorId} variant="body2" role="alert" sx={{ fontWeight: 700 }}>
          Tick “I’ve checked these” to go on.
        </Typography>
      ) : null}
    </Box>
  );
}
