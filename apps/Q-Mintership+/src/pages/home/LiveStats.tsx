/**
 * MINTER today, for visitors who aren't signed in: members, Minter Admins,
 * the signatures a decision needs right now, and open nominations. The
 * first three come from two small reads; open nominations from the shared
 * nominations data (the same read the Nominations page uses).
 */
import { Box, Skeleton, Typography } from '@mui/material';
import { ErrorState, TruncatedNote } from '../../components/common/states';
import { Section, StatTile } from '../../components/common/Section';
import { useNominations } from '../../hooks/useData';
import { formatCount } from '../../utils/format';
import type { NeededSignatures } from './homeData';

function Value({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? (
    <Skeleton variant="text" width={48} aria-hidden />
  ) : (
    <>{formatCount(value)}</>
  );
}

export function LiveStats({ needed }: { needed: NeededSignatures }) {
  const nominations = useNominations(true);
  if (needed.error && needed.needed === null) {
    return (
      <Section title="MINTER today" id="home-stats">
        <ErrorState
          compact
          title="Couldn't load MINTER's numbers."
          error={needed.error}
          onRetry={needed.refetch}
        />
      </Section>
    );
  }
  return (
    <Section title="MINTER today" id="home-stats">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <StatTile value={<Value value={needed.memberCount} />} label="Members" />
        <StatTile
          value={<Value value={needed.signers} />}
          label="Minter Admins"
          hint="Who can sign"
        />
        <StatTile
          value={<Value value={needed.needed} />}
          label="Signatures needed"
          hint={
            needed.percent !== null && needed.adminSeats !== null
              ? `${needed.percent}% of ${needed.adminSeats} admin seats`
              : undefined
          }
        />
        <StatTile
          value={
            nominations.isError && !nominations.data ? (
              '–'
            ) : (
              <Value value={nominations.data?.open.length} />
            )
          }
          label="Open nominations"
          hint={nominations.isError && !nominations.data ? "Couldn't load" : undefined}
        />
      </Box>
      {needed.adminSeats !== null &&
      needed.signers !== null &&
      needed.adminSeats > needed.signers ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          MINTER has {needed.adminSeats} admin seats: one is the group&rsquo;s null owner, which
          counts towards the threshold but can&rsquo;t sign.
        </Typography>
      ) : null}
      {nominations.data?.truncated ? <TruncatedNote what="the nominations" /> : null}
    </Section>
  );
}
