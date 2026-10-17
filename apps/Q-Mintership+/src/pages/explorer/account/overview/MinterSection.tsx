/**
 * The Overview's MINTER section: where the account stands, in the person
 * page's own sentence (pages/person/personWords.ts statusSentence, from the
 * app's status), then its MINTER profile tab, and the MINTER profile page,
 * where nominating, supporting and deciding happen (the Explorer only reads).
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import type { UseQueryResult } from '../../../../hooks/useQuery';
import { personPath } from '../../../../routes/paths';
import type { MyStatus } from '../../../../rules/status';
import { statusSentence } from '../../../person/personWords';
import { TabButton } from './TabLink';

export function MinterSection({
  address,
  status,
  memberSince,
}: {
  address: string;
  status: UseQueryResult<MyStatus>;
  memberSince: number | null;
}) {
  return (
    <Section title="MINTER" id="overview-minter">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {status.isError && !status.data ? (
          <ErrorState
            compact
            title="Couldn't load where it stands in MINTER."
            error={status.error}
            onRetry={() => void status.refetch()}
          />
        ) : !status.data ? (
          <ListSkeleton count={1} label="Loading where it stands in MINTER" />
        ) : (
          <Typography>{statusSentence(status.data, memberSince, false)}</Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Its whole MINTER story is on its MINTER profile tab; nominating, supporting and deciding
          happen on its MINTER profile page.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mx: -1 }}>
          <TabButton address={address} tab="mintership">
            MINTER profile
          </TabButton>
          <Button
            component={RouterLink}
            to={personPath(address)}
            endIcon={<ChevronRightOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Nominate, support or decide
          </Button>
        </Box>
      </Card>
    </Section>
  );
}
