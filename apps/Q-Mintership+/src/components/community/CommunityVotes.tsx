/**
 * The community's Yes and No on a nomination, or on a proposal to remove a
 * member, ban an account or make a Minter Admin (advisory votes from people
 * who aren't Minter Admins), as the cards show them:
 *
 * - CommunitySummary, beside Copy link: "Community", then Yes and No, each
 *   with its count and its first voters' avatars. It opens everyone who
 *   voted, in two columns. Nothing shows until someone has voted.
 * - CommunityVoteControls, where Minter Admins have Approve and Reject: No
 *   and Yes for everyone else (the dialog says what it publishes and what it
 *   costs before Hub opens), then "You voted Yes ✓" with "Change to No",
 *   "(confirming…)" until QDN has it.
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import type { CommunityVoteValue } from '../../data/voteRecords';
import type {
  CommunityTally,
  CommunityVoter,
  MyCommunityVote,
  VoteTopic,
} from '../../rules/communityVotes';
import type { Signer } from '../../writes/runner';
import { formatCount, plural } from '../../utils/format';
import { readable } from '../../utils/readable';
import { NameAvatar } from '../common/NameAvatar';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { PeopleColumns } from '../decision/AnswerColumns';
import { LazyCommunityVoteDialog } from './LazyCommunityVoteDialog';
import { withMarkedName } from '../common/markedText';

/** Avatars shown per side beside Copy link; the rest are "+n". */
export const AVATARS_SHOWN = 3;

const WORD: Record<CommunityVoteValue, string> = { yes: 'Yes', no: 'No' };
const ICON = { yes: ThumbUpOutlinedIcon, no: ThumbDownOutlinedIcon };
const TONE = { yes: 'success', no: 'error' } as const;

function Side({ vote, voters }: { vote: CommunityVoteValue; voters: CommunityVoter[] }) {
  const Icon = ICON[vote];
  const shown = voters.slice(0, AVATARS_SHOWN);
  const more = voters.length - shown.length;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Icon aria-hidden sx={{ fontSize: 18, color: readable(TONE[vote]) }} />
      <span>{formatCount(voters.length)}</span>
      {shown.length ? (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
          {shown.map((v, i) => (
            <Box
              key={v.address}
              component="span"
              sx={(theme) => ({
                display: 'inline-flex',
                borderRadius: '50%',
                ml: i ? -0.75 : 0,
                boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
              })}
            >
              <NameAvatar name={v.name} size={22} />
            </Box>
          ))}
          {more > 0 ? (
            <Box component="span" sx={{ ml: 0.5, fontSize: 12, color: 'text.secondary' }}>
              +{formatCount(more)}
            </Box>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

/** "Community 👍 3 👎 1" with the first voters' avatars; opens who voted what. */
export function CommunitySummary({
  tally,
  label,
  heading = `Nomination of ${label}`,
}: {
  tally: CommunityTally;
  /** The nominee (or the proposal's subject), as the card names them. */
  label: string;
  /** What it is, as the card's title says it ("Nomination of Ada" when absent). */
  heading?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!tally.yes.length && !tally.no.length) return null;
  const person = (v: CommunityVoter) => ({ address: v.address, name: v.name });
  return (
    <>
      <Button
        variant="text"
        color="inherit"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        sx={{ minHeight: 44, px: 1, fontWeight: 400 }}
      >
        {/* Seen: the word, the icons, counts and avatars. Heard: one plain sentence. */}
        <Box
          component="span"
          aria-hidden
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}
        >
          <Box component="span" sx={{ fontWeight: 700 }}>
            Community
          </Box>
          <Side vote="yes" voters={tally.yes} />
          <Side vote="no" voters={tally.no} />
        </Box>
        <Box component="span" sx={visuallyHidden}>
          {`Community votes: ${formatCount(tally.yes.length)} Yes, ${formatCount(tally.no.length)} No`}
        </Box>
      </Button>
      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Community votes"
        actions={
          <Button onClick={() => setOpen(false)} sx={{ minHeight: 44 }}>
            Close
          </Button>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            {withMarkedName(heading, label)}
          </Typography>
          <PeopleColumns
            headingLevel="h3"
            columns={[
              {
                key: 'yes',
                title: 'Yes',
                listLabel: (n) => `Voted Yes: ${plural(n, 'person', 'people')}`,
                icon: <ThumbUpOutlinedIcon aria-hidden />,
                tone: 'success',
                people: tally.yes.map(person),
                emptyText: 'Nobody yet',
              },
              {
                key: 'no',
                title: 'No',
                listLabel: (n) => `Voted No: ${plural(n, 'person', 'people')}`,
                icon: <ThumbDownOutlinedIcon aria-hidden />,
                tone: 'error',
                people: tally.no.map(person),
                emptyText: 'Nobody yet',
              },
            ]}
          />
          <Typography variant="body2" color="text.secondary">
            Advisory votes from people who aren’t Minter Admins, so the admins can weigh the
            community’s view. One vote per account, its newest, counted from the start of this
            nomination. The Minter Admins decide on chain.
          </Typography>
        </Box>
      </ResponsiveDialog>
    </>
  );
}

/** No and Yes for someone who isn't a Minter Admin, then their vote with "Change to …". */
export function CommunityVoteControls({
  topic = 'nomination',
  nominee,
  label,
  heading,
  mine,
  signer,
}: {
  /** What it is on (a nomination when absent). */
  topic?: VoteTopic;
  /** The account it is about: the nominee, or the proposal's subject. */
  nominee: string;
  /** That account, as the card names them. */
  label: string;
  /** What it is, as the card's title says it ("Nomination of Ada" when absent). */
  heading?: string;
  mine: MyCommunityVote;
  signer: Signer & { name: string | null };
}) {
  // The dialog keeps the vote it opened with while the card refreshes under it.
  const [dialog, setDialog] = useState<{
    vote: CommunityVoteValue;
    change: boolean;
    open: boolean;
  } | null>(null);
  const ask = (vote: CommunityVoteValue, change: boolean) =>
    setDialog({ vote, change, open: true });
  // What the buttons' names say it is on: the nominee, or the whole proposal.
  const on = heading ?? label;

  let content;
  if (mine.sending) {
    content = (
      <Button variant="outlined" disabled sx={{ minHeight: 44 }}>
        Voting…
      </Button>
    );
  } else if (mine.vote) {
    const Icon = ICON[mine.vote];
    const other: CommunityVoteValue = mine.vote === 'yes' ? 'no' : 'yes';
    content = (
      <>
        <Typography
          variant="body2"
          role={mine.settled ? undefined : 'status'}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
        >
          <Icon aria-hidden sx={{ fontSize: 18, color: readable(TONE[mine.vote]) }} />
          You voted {WORD[mine.vote]} ✓{mine.settled ? '' : ' (confirming…)'}
        </Typography>
        <Button
          variant="text"
          color="inherit"
          onClick={() => ask(other, true)}
          disabled={mine.busy}
          aria-label={`Change to ${WORD[other]}: your vote on ${on}`}
          sx={{ minHeight: 44 }}
        >
          Change to {WORD[other]}
        </Button>
      </>
    );
  } else {
    content = (
      <Box role="group" aria-label={`Your vote on ${on}`} sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<ThumbDownOutlinedIcon />}
          onClick={() => ask('no', false)}
          disabled={mine.busy}
          aria-label={`Vote No: ${on}`}
          sx={{ minHeight: 44, minWidth: 88 }}
        >
          No
        </Button>
        <Button
          variant="outlined"
          startIcon={<ThumbUpOutlinedIcon />}
          onClick={() => ask('yes', false)}
          disabled={mine.busy}
          aria-label={`Vote Yes: ${on}`}
          sx={{ minHeight: 44, minWidth: 88 }}
        >
          Yes
        </Button>
      </Box>
    );
  }

  return (
    <>
      {content}
      {dialog ? (
        <LazyCommunityVoteDialog
          open={dialog.open}
          vote={dialog.vote}
          change={dialog.change}
          topic={topic}
          nominee={nominee}
          label={label}
          heading={heading}
          signer={signer}
          onClose={() => setDialog((d) => (d ? { ...d, open: false } : d))}
        />
      ) : null}
    </>
  );
}
