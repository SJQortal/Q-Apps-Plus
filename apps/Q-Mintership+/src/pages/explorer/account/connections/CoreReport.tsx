/**
 * Connections → Core's own report: Core's sponsorship report on the
 * accounts this one made reward shares to, read only when asked (it takes
 * Core 1 to 5 seconds) and kept for the session. Each number is said for
 * what Core really counts (rules/explorer/connections.ts).
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { getSponsorshipReport } from '../../../../data/explorer/sponsorship';
import { useQuery } from '../../../../hooks/useQuery';
import { peekQuery } from '../../../../data/query';
import { sponsorReportLines } from '../../../../rules/explorer/connections';

export function CoreReport({ address }: { address: string }) {
  const key = `xsponsor:${address}`;
  // Asked for before (this session): show it again at once.
  const [asked, setAsked] = useState(() => peekQuery(key) !== undefined);
  const report = useQuery(asked ? key : null, (force) => getSponsorshipReport(address, { force }));
  return (
    <Section title="Core’s own report" id="connections-core-report">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Core’s sponsorship report on the accounts this one made reward shares to. It takes Core 1
          to 5 seconds, so it is read only when you ask.
        </Typography>
        {!asked ? (
          <Button
            variant="outlined"
            onClick={() => setAsked(true)}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            Load Core’s report
          </Button>
        ) : report.isError && !report.data ? (
          <ErrorState
            compact
            title="Couldn’t load Core’s report."
            error={report.error}
            onRetry={() => void report.refetch()}
          />
        ) : !report.data ? (
          <ListSkeleton count={1} label="Loading Core’s report" />
        ) : (
          <Box component="ul" aria-label="Core’s report" sx={{ m: 0, pl: 2.5 }}>
            {sponsorReportLines(report.data).map((line) => (
              <Typography component="li" key={line} sx={{ overflowWrap: 'anywhere' }}>
                {line}
              </Typography>
            ))}
          </Box>
        )}
      </Card>
    </Section>
  );
}
