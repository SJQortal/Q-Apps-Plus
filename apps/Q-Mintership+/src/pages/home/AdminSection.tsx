/**
 * Under a Minter Admin's hero: the three most urgent decisions waiting for
 * their signature, nominations still waiting for a first signature, and
 * their activity (signed k of the open decisions, approved invites nobody
 * used, the neutral integrity flag). Everything links to Decisions.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import { DecisionRow } from '../../components/decision/DecisionRow';
import { Card, Section, StatTile } from '../../components/common/Section';
import { PersonChip } from '../../components/common/Person';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { useDecisions, useNominations } from '../../hooks/useData';
import { decisionPath } from '../../routes/paths';
import { formatCount, formatRelative } from '../../utils/format';
import { adminSummary, useSendingSignature, useUnusedInvites } from './homeData';

const TOP = 3;

export function AdminSection({ publicKey }: { publicKey: string }) {
  const decisions = useDecisions(true);
  const nominations = useNominations(true);
  const unused = useUnusedInvites(true);
  const sending = useSendingSignature();

  const data = decisions.data;
  const summary = data ? adminSummary(data, publicKey, sending) : null;
  const firstSignature = nominations.data?.open.filter((n) => n.state === 'waiting') ?? [];

  return (
    <>
      <Section
        title="Waiting for your signature"
        id="home-waiting"
        action={
          summary && summary.waiting.length > TOP ? (
            <Button component={RouterLink} to={decisionPath()} sx={{ minHeight: 44 }}>
              See all {summary.waiting.length}
            </Button>
          ) : undefined
        }
      >
        {!data ? (
          decisions.isError ? (
            <ErrorState
              compact
              title="Couldn't load the decisions."
              error={decisions.error}
              onRetry={() => void decisions.refetch()}
            />
          ) : (
            <ListSkeleton count={TOP} ring label="Loading the decisions" />
          )
        ) : summary && summary.waiting.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {summary.waiting.slice(0, TOP).map((d) => (
              <DecisionRow key={d.signature} decision={d} now={data.now} myPublicKey={publicKey} />
            ))}
          </Box>
        ) : (
          <EmptyState
            title="Nothing is waiting for your signature"
            description="New nominations and proposals show up here as they arrive."
          />
        )}
        {data?.truncated ? <TruncatedNote what="the decisions" /> : null}
      </Section>

      {firstSignature.length ? (
        <Section title="Waiting for a first signature" id="home-first">
          <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              The first Minter Admin who signs creates the invite and starts the clock.
            </Typography>
            {firstSignature.slice(0, TOP).map((n) => {
              const by = n.nomination?.publisher;
              return (
                <Box
                  key={n.nominee}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                >
                  <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                    <PersonChip
                      address={n.nominee}
                      name={n.nomineeName ?? undefined}
                      secondary={
                        by
                          ? `Nominated by ${by.name} ${formatRelative(n.publishedAt)}`
                          : `Nominated ${formatRelative(n.publishedAt)}`
                      }
                    />
                  </Box>
                  <Button
                    component={RouterLink}
                    to={decisionPath()}
                    variant="outlined"
                    aria-label={`Review the nomination of ${n.nomineeName ?? n.nominee}`}
                    sx={{ minHeight: 44 }}
                  >
                    Review
                  </Button>
                </Box>
              );
            })}
            {firstSignature.length > TOP ? (
              <Typography variant="body2" color="text.secondary">
                And {firstSignature.length - TOP} more in Decisions.
              </Typography>
            ) : null}
          </Card>
        </Section>
      ) : null}

      <Section title="Your activity" id="home-activity">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1.5,
          }}
        >
          <StatTile
            value={summary ? `${summary.signed} of ${summary.open.length}` : '…'}
            label="Open decisions you've signed"
          />
          <StatTile
            value={unused.count !== null ? formatCount(unused.count) : unused.error ? '–' : '…'}
            label="Approved invites not used"
            hint={
              unused.error && unused.count === null
                ? "Couldn't load"
                : 'Old ones can be cancelled in Decisions'
            }
          />
        </Box>
        {summary && summary.unusual > 0 ? (
          <Alert
            severity="warning"
            action={
              <Button
                component={RouterLink}
                to={decisionPath()}
                color="inherit"
                sx={{ minHeight: 44 }}
              >
                Open
              </Button>
            }
          >
            <strong>Unusual approval route</strong> ({summary.unusual}). Check it with the other
            Minter Admins.
          </Alert>
        ) : null}
        {unused.truncated ? <TruncatedNote what="the member list" /> : null}
      </Section>
    </>
  );
}
