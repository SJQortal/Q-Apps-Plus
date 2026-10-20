/**
 * Publishing a community vote, on a nomination or on a proposal to remove a
 * member, ban an account or make a Minter Admin: what it is (advisory,
 * public, under the voter's name) and its fee, before Hub opens. An account
 * without a registered name is told what a name is and where to get one
 * instead, so nobody reaches a Hub step that can only stop them.
 */
import { Box, Button, Typography } from '@mui/material';
import type { CommunityVoteValue } from '../../data/voteRecords';
import { NeedsName } from '../../pages/decisions/NeedsName';
import type { VoteTopic } from '../../rules/communityVotes';
import { publishCommunityVote, publishDecisionVote } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { withMarkedName } from '../common/markedText';

export interface CommunityVoteDialogProps {
  open: boolean;
  vote: CommunityVoteValue;
  /** It replaces an earlier vote. */
  change?: boolean;
  /** What it is on (a nomination when absent). */
  topic?: VoteTopic;
  /** The account it is about: the nominee, or the proposal's subject. */
  nominee: string;
  /** That account, as the card names them. */
  label: string;
  /** What it is, as the card's title says it ("Nomination of Ada" when absent). */
  heading?: string;
  signer: (Signer & { name: string | null }) | null;
  onClose: () => void;
}

export function CommunityVoteDialog({
  open,
  vote,
  change = false,
  topic = 'nomination',
  nominee,
  label,
  heading = `Nomination of ${label}`,
  signer,
  onClose,
}: CommunityVoteDialogProps) {
  const word = vote === 'yes' ? 'Yes' : 'No';
  const proposal = topic !== 'nomination';
  const thing = proposal ? 'proposal' : 'nomination';
  if (signer && !signer.name) {
    return (
      <ResponsiveDialog
        open={open}
        onClose={onClose}
        title={`Vote ${word}`}
        actions={
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
        }
      >
        <NeedsName
          address={signer.address}
          title="Voting needs a registered name"
          text="Your vote is a small public record published under your name, and your account has none yet."
        />
      </ResponsiveDialog>
    );
  }
  return (
    <HubStepDialog
      open={open && Boolean(signer)}
      onClose={onClose}
      title={change ? `Change your vote to ${word}` : `Vote ${word}`}
      intro={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {withMarkedName(heading, label)}
          </Typography>
          <Typography>
            Your vote tells the Minter Admins how the community feels about this {thing}.
            {proposal ? ' Yes means you’re for it, No that you’re against it.' : ''} It’s advisory:
            they decide on chain, and nothing changes there from it.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            It is a small public record under your name ({signer?.name}) on QDN, and everyone sees
            it on the {thing}. Only your newest vote counts: you can change it while the {thing} is
            open, and each change is published the same way, with the same fee.
          </Typography>
        </Box>
      }
      steps={[
        {
          action: 'PUBLISH_QDN_RESOURCE',
          title: 'Publish your vote',
          check: [
            `The name is ${signer?.name ?? ''}.`,
            'The service is JSON.',
            'The identifier starts with qmp-vote-.',
            'The fee.',
          ],
          feeTxType: 'ARBITRARY',
        },
      ]}
      run={async (report) => {
        if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const onStage = (stage: Parameters<typeof report>[1]) => report(0, stage);
        const outcome =
          topic === 'nomination'
            ? await publishCommunityVote(signer, nominee, vote, onStage)
            : await publishDecisionVote(signer, topic, nominee, vote, onStage);
        return { outcome };
      }}
      successTitle={`Voted ${word}`}
      successText={
        <Typography variant="body2">
          It shows on the {thing} once QDN has it, usually within a minute or two.
        </Typography>
      }
    />
  );
}
