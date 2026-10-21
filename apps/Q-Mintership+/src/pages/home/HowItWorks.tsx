/**
 * The joining process in five plain steps, for everyone outside MINTER,
 * with today's numbers: the signatures needed and the signing window at
 * the measured block time. A join request already open counts as accepting
 * (it's the same join request).
 */
import { Typography } from '@mui/material';
import { formatQort } from '../../data/accounts';
import { NOMINATOR_MIN_LEVEL } from '../../data/constants';
import { Card, Section } from '../../components/common/Section';
import { useChainNow, useGroupInfo } from '../../hooks/useData';
import { useFee } from '../../hooks/useFee';
import { formatDuration } from '../../utils/format';
import { Num } from './Hero';
import { Step, StepList } from './Steps';

export function HowItWorks({ needed }: { needed: number | null }) {
  const group = useGroupInfo();
  const now = useChainNow();
  const fee = useFee('JOIN_GROUP');
  const windowText =
    group.data && now.data
      ? formatDuration(group.data.maximumBlockDelay * now.data.msPerBlock, { precise: true })
      : null;
  return (
    <Section title="How joining MINTER works" id="home-how">
      <Card>
        <StepList label="How joining MINTER works">
          <Step n={1} title="Someone nominates you">
            Nominators, MINTER members at level {NOMINATOR_MIN_LEVEL} or above and Minter Admins,
            choose community members who&rsquo;d make good minters. They publish a short nomination
            saying why; others can add their support.
          </Step>
          <Step n={2} title="You accept">
            Accepting sends a join request (a <Num>{formatQort(fee.data?.qort ?? 0.01)}</Num> fee),
            so you join the moment you&rsquo;re approved. If your account already has one open,
            there&rsquo;s nothing to accept.
          </Step>
          <Step n={3} title="A Minter Admin approves first">
            That starts the clock: Minter Admins then have{' '}
            {windowText ? <Num>about {windowText}</Num> : 'about eight and a half days'} to approve.
          </Step>
          <Step n={4} title="Other Minter Admins approve">
            {needed ? (
              <>
                <Num>{needed}</Num> approvals are needed today.
              </>
            ) : (
              'Enough Minter Admins approve.'
            )}{' '}
            Each Minter Admin approves, rejects, or lets it run out.
          </Step>
          <Step n={5} title="You're in">
            With enough approvals you&rsquo;re in at once if you accepted (your join request is in),
            or you press Join now if not. If time runs out, you can simply be nominated again.
          </Step>
        </StepList>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Before a Minter Admin approves, a nomination stays open for one approval window, then
          moves to History.
        </Typography>
      </Card>
    </Section>
  );
}
