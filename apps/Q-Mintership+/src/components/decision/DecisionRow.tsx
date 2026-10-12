/**
 * A compact decision: what it does, who it is about, k of n and the time
 * left, and whether you have signed. Links to the decision in the queue.
 * (The full card with Sign lives on the Decisions screen.)
 *
 * The link's name is its visible text; the ring is decorative here, so its
 * "k of n signatures" is in visually hidden words after the title.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import { KIND_LABEL, type Decision } from '../../rules/decision';
import { signerState } from '../../rules/tally';
import { decisionPath } from '../../routes/paths';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { useDisplayName } from '../../hooks/useDisplayName';
import { NameAvatar } from '../common/NameAvatar';
import { ProgressRing } from '../common/ProgressRing';
import { DecisionPhaseChip } from '../common/Section';
import { DoneChip, SigningClock } from './DecisionParts';

export function DecisionRow({
  decision: d,
  now,
  myPublicKey,
}: {
  decision: Decision;
  now: ChainNow;
  myPublicKey?: string;
}) {
  const subject = useDisplayName(d.subject ?? '', d.subject ? undefined : null);
  const pending = usePendingWrite(writeKeys.sign(d.signature));
  const mine = d.tally && myPublicKey ? signerState(d.tally, myPublicKey) : 'none';
  const signed = mine === 'signed' || mine === 'confirming' || pending?.status === 'confirming';
  const who = d.subject ? subject.label : 'an approved invite (Core doesn’t say for whom)';
  return (
    <Box
      component={RouterLink}
      to={decisionPath(d.signature)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        minHeight: 44,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        color: 'inherit',
        textDecoration: 'none',
        transition: 'background-color 160ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
      }}
    >
      <NameAvatar name={d.subject ? subject.name : null} size={36} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
          {KIND_LABEL[d.kind]}: {who}
          {d.tally ? (
            <span className="qmp-visually-hidden">
              . {d.tally.approvalCount} of {d.tally.needed} signatures.
            </span>
          ) : null}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 0.5 }}>
          {d.window && (d.phase === 'open' || d.phase === 'early') ? (
            <SigningClock now={now} height={d.window.lastUsefulSignatureHeight} plain />
          ) : (
            <DecisionPhaseChip phase={d.phase} />
          )}
          {signed ? (
            <DoneChip
              label={mine === 'signed' ? 'Signed ✓' : 'Signed ✓ (confirming…)'}
              settled={mine === 'signed'}
              size="small"
            />
          ) : null}
        </Box>
      </Box>
      {d.tally ? (
        <ProgressRing
          value={d.tally.approvalCount}
          target={d.tally.needed}
          pending={d.tally.inFlight.filter((x) => x.approval).length}
          size={48}
          decorative
        />
      ) : null}
    </Box>
  );
}
