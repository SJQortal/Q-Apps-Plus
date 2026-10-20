/**
 * The nominee's own nomination, on top of Decisions whatever the view, with
 * Accept or Join now (NomineeAction); and, for everyone who can't propose a
 * nomination, why not, said politely (NominateNote).
 */
import { Alert, Box, Button, Typography } from '@mui/material';
import { FeeNote } from '../../components/common/FeeNote';
import { Card, Section } from '../../components/common/Section';
import { NominationCard } from '../../components/nomination/NominationCard';
import { NomineeAction } from '../../components/nomination/NomineeAction';
import type { NominationsData } from '../../data/nominations';
import type { MyStatus } from '../../rules/status';
import { approvalsNeeded } from '../../rules/threshold';
import { signIn, type Session } from '../../state/session';
import { formatCount } from '../../utils/format';
import type { Signer } from '../../writes/runner';
import type { OwnNominationFacts } from './ownNominationFacts';

export function OwnNomination({
  facts,
  data,
  signer,
}: {
  facts: OwnNominationFacts;
  data: NominationsData;
  signer: Signer | null;
}) {
  const { own, step } = facts;
  return (
    <Section title="Your nomination" id="mine">
      {own ? (
        <NominationCard
          nomination={own}
          now={data.decisions.now}
          comments
          forNominee
          actions={
            <NomineeAction
              step={step}
              signer={signer}
              needed={
                own.decision?.tally?.needed ??
                approvalsNeeded(
                  data.decisions.group.approvalThreshold,
                  data.decisions.admins.adminCount
                )
              }
              askWho={own.nomination?.publisher.name ?? null}
            />
          }
        />
      ) : (
        <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 700 }}>You were approved for MINTER</Typography>
          <Typography variant="body2" color="text.secondary">
            One step left: join to become a member.
          </Typography>
          <Box>
            <NomineeAction step={step} signer={signer} />
          </Box>
        </Card>
      )}
      {step === 'accept' ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          Accept now, so that once enough Minter Admins approve you become a member at once. It
          sends a join request (<FeeNote txType="JOIN_GROUP" prefix="fee" />
          ).
        </Typography>
      ) : null}
    </Section>
  );
}

/** Why there is no Propose nomination button, said politely (nothing for those who can, or for nominees). */
export function NominateNote({
  session,
  status,
  hidden,
}: {
  session: Session;
  status: MyStatus | undefined;
  hidden: boolean;
}) {
  if (hidden) return null;
  if (session.status === 'outside') {
    return (
      <Alert severity="info" variant="outlined">
        Open Q-Mintership+ in Qortal Hub or GO to propose a nomination or add your support.
      </Alert>
    );
  }
  if (session.status === 'signedOut' || session.status === 'error') {
    return (
      <Alert
        severity="info"
        variant="outlined"
        action={
          <Button color="inherit" onClick={() => void signIn()} sx={{ minHeight: 44 }}>
            Sign in
          </Button>
        }
      >
        Sign in to propose a nomination or add your support.
      </Alert>
    );
  }
  if (!status || status.canNominate || status.kind === 'nominated') return null;
  const toLevel5 = status.isMember && status.level < 5 ? status.progress.blocksToTarget : 0;
  return (
    <Alert severity="info" variant="outlined">
      {status.nominateBlock}
      {toLevel5 > 0 ? ` ${formatCount(toLevel5)} more blocks minted to reach level 5.` : ''}
    </Alert>
  );
}
