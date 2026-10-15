/**
 * Publishing a community vote: what it is (advisory, public, under the
 * voter's name) and its fee, before Hub opens. An account without a
 * registered name is told what a name is and where to get one instead, so
 * nobody reaches a Hub step that can only stop them.
 */
import { Box, Button, Typography } from '@mui/material';
import type { CommunityVoteValue } from '../../data/voteRecords';
import { NeedsName } from '../../pages/decisions/NeedsName';
import { publishCommunityVote } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { HubStepDialog } from '../common/HubStepDialog';
import { ResponsiveDialog } from '../common/ResponsiveDialog';

export interface CommunityVoteDialogProps {
  open: boolean;
  vote: CommunityVoteValue;
  /** It replaces an earlier vote. */
  change?: boolean;
  nominee: string;
  /** The nominee, as the card names them. */
  label: string;
  signer: (Signer & { name: string | null }) | null;
  onClose: () => void;
}

export function CommunityVoteDialog({
  open,
  vote,
  change = false,
  nominee,
  label,
  signer,
  onClose,
}: CommunityVoteDialogProps) {
  const word = vote === 'yes' ? 'Yes' : 'No';
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
            Nomination of {label}
          </Typography>
          <Typography>
            Your vote tells the Minter Admins how the community feels about this nomination. It’s
            advisory: they decide on chain, and nothing changes there from it.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            It is a small public record under your name ({signer?.name}) on QDN, and everyone sees
            it on the nomination. Only your newest vote counts: you can change it while the
            nomination is open, and each change is published the same way, with the same fee.
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
        const outcome = await publishCommunityVote(signer, nominee, vote, (stage) =>
          report(0, stage)
        );
        return { outcome };
      }}
      successTitle={`Voted ${word}`}
      successText={
        <Typography variant="body2">
          It shows on the nomination once QDN has it, usually within a minute or two.
        </Typography>
      }
    />
  );
}
