/**
 * A Minter Admin's Home: "N Minter Admin polls are waiting for your vote",
 * linking to Decisions. Only from what Decisions (or a poll's page) already
 * read this session: Home reads and decrypts nothing for it, and says
 * nothing until then. Loaded on demand, so Home's first load stays as it was.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import { Card } from '../../components/common/Section';
import { PATHS } from '../../routes/paths';
import { usePendingPollWrites } from '../../state/adminPolls';
import { waitingText } from '../decisions/adminPollUi';
import { useReadAdminPolls, waitingForMyVote } from '../decisions/useAdminPolls';

export default function PollsWaiting({ address }: { address: string }) {
  const views = useReadAdminPolls(address);
  const pending = usePendingPollWrites();
  const waiting = waitingForMyVote(views, pending.votes);
  if (!waiting.length) return null;
  return (
    <Card
      role="note"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 1 }}
    >
      <HowToVoteOutlinedIcon aria-hidden sx={{ color: 'text.secondary' }} />
      <Typography sx={{ flex: '1 1 200px', fontWeight: 600 }}>
        {waitingText(waiting.length)}
      </Typography>
      <Button component={RouterLink} to={PATHS.decisions} variant="outlined" sx={{ minHeight: 44 }}>
        Open Decisions
      </Button>
    </Card>
  );
}
