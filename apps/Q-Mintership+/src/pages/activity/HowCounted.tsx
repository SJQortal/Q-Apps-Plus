/**
 * "How this is counted": the rules behind the Activity numbers, in plain
 * words. A native <details>, so it opens with a tap or the keyboard and
 * costs no script.
 */
import { Box, Typography } from '@mui/material';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import { CHEVRON_TURN } from '../../components/common/ExpandChevron';
import type { ActivityData } from '../../data/activity';
import { formatCount } from '../../utils/format';
import { blockTimeWords } from './format';

export function HowCounted({ data }: { data: ActivityData | undefined }) {
  const range = data?.range;
  return (
    <Box
      component="details"
      sx={(theme) => ({
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: `${theme.shape.borderRadius}px`,
        bgcolor: 'background.paper',
        '& > summary': {
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 48,
          px: 2,
          cursor: 'pointer',
          fontWeight: 700,
          borderRadius: `${theme.shape.borderRadius}px`,
          '&::-webkit-details-marker': { display: 'none' },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
          '&:hover': { bgcolor: 'action.hover' },
        },
        // Turns like the Show / Hide chevrons (ExpandChevron).
        '& > summary svg': { ml: 'auto', transition: CHEVRON_TURN },
        '&[open] > summary svg': { transform: 'rotate(180deg)' },
      })}
    >
      <summary>
        How this is counted
        <ExpandMoreOutlinedIcon aria-hidden />
      </summary>
      <Box
        component="ul"
        sx={{
          m: 0,
          px: 2,
          pb: 2,
          pt: 0.5,
          pl: 4.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography component="li" variant="body2">
          Only answers on MINTER decisions count: adding someone, removing or banning them, lifting
          a ban, cancelling an invite, and making or removing a Minter Admin.
        </Typography>
        <Typography component="li" variant="body2">
          A decision is eligible for an admin when it was waiting for approvals while they were a
          Minter Admin. Admins added during the window count from the day they were added; former
          admins count until they stopped.
        </Typography>
        <Typography component="li" variant="body2">
          Participation is the share of eligible decisions they signed. Approving and rejecting are
          both signatures (each is a transaction they sign), so both count as taking part; rejecting
          after approving is a rejection. Approvals and rejections are shown apart.
        </Typography>
        <Typography component="li" variant="body2">
          Only an admin's latest signature on a decision counts, as on chain, and only if it landed
          in time.
        </Typography>
        <Typography component="li" variant="body2">
          Missed means a decision expired while they were an admin and they never signed it: only
          doing nothing is a miss. Decisions still collecting approvals count for an admin once they
          have signed.
        </Typography>
        <Typography component="li" variant="body2">
          A double is never a miss: an admin change that would have changed nothing, or the same
          change waiting twice, as marked on Decisions. Left alone, it doesn't count at all; a
          signature on it counts like any other.
        </Typography>
        <Typography component="li" variant="body2">
          Time to approve is the median from a decision's block to their approval's block, at the
          live block time{data ? ` (one block every ${blockTimeWords(data.now)} now)` : ''}.
          Decisions they proposed themselves are left out.
        </Typography>
        <Typography component="li" variant="body2">
          The window is measured in blocks, not assumed days
          {range
            ? `: this one is blocks ${formatCount(range.startBlock)} to ${formatCount(range.endBlock)}.`
            : '.'}
        </Typography>
        <Typography component="li" variant="body2">
          Votes and comments from the original Q-Mintership aren't counted: there are no polls any
          more, only approvals and rejections.
        </Typography>
      </Box>
    </Box>
  );
}
