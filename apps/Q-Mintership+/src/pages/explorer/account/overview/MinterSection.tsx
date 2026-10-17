/**
 * The Overview's MINTER section: where the account stands, in the app's own
 * sentence (pages/person/personWords.ts statusSentence, from the app's
 * status), then its Minter Profile tab, where nominating, supporting and
 * deciding happen too.
 */
import { Box, Typography } from '@mui/material';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import type { UseQueryResult } from '../../../../hooks/useQuery';
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
          Its whole MINTER story is on its Minter Profile, where you can also nominate, support or
          decide.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mx: -1 }}>
          <TabButton address={address} tab="mintership">
            Minter Profile
          </TabButton>
        </Box>
      </Card>
    </Section>
  );
}
