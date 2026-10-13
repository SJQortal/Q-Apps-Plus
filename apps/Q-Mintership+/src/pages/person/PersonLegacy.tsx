/**
 * A person's cards from the original app. Old cards only say who they are
 * about inside their body, so this reads the newest cards (plus any the
 * person posted themselves) and offers to look further back, 100 at a time.
 * The first look starts only once the section scrolls near the screen.
 * Every body read is kept for the session and shared with History.
 */
import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  LEGACY_SCAN_FIRST,
  LEGACY_SCAN_STEP,
  loadLegacyFor,
  type LegacyMatches,
} from '../../data/legacy';
import { useInView } from '../../hooks/useInView';
import { useQuery } from '../../hooks/useQuery';
import { ErrorState, ListSkeleton, TruncatedNote } from '../../components/common/states';
import { Section } from '../../components/common/Section';
import { formatCount } from '../../utils/format';
import { LegacyCardItem } from '../history/parts/LegacyCardItem';

export function PersonLegacy({ address, name }: { address: string; name: string | null }) {
  const [scan, setScan] = useState(LEGACY_SCAN_FIRST);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const near = useInView(node);
  const query = useQuery(
    `legacy:for:${address}:${scan}`,
    (force) => loadLegacyFor({ address, name }, scan, { force }),
    { enabled: near }
  );
  // Keep what was found while looking further back.
  const [previous, setPrevious] = useState<LegacyMatches | undefined>(undefined);
  useEffect(() => {
    if (query.data) setPrevious(query.data);
  }, [query.data]);
  const data = query.data ?? previous;
  const searching = !query.data && query.fetching;
  const who = name ?? 'this account';

  let body;
  if (!data && query.isError) {
    body = (
      <ErrorState
        compact
        title="Couldn't read the original app's cards."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!data) {
    body = <ListSkeleton count={1} label="Looking through the original app's cards" />;
  } else {
    body = (
      <>
        {data.cards.length ? (
          <Box
            component="ul"
            aria-label={`Original app cards about ${who}`}
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            {data.cards.map((card) => (
              <li key={card.identifier}>
                <LegacyCardItem row={card} card={card} />
              </li>
            ))}
          </Box>
        ) : null}
        {data.truncated ? <TruncatedNote what="the original app's cards" /> : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px', px: 0.5 }}>
            {data.cards.length ? '' : `No cards about ${who}. `}
            {data.scanned >= data.total
              ? `Looked through all ${formatCount(data.total)} cards.`
              : `Looked through the newest ${formatCount(data.scanned)} of ${formatCount(data.total)} cards${name ? ', and any they posted' : ''}.`}
          </Typography>
          {data.scanned < data.total ? (
            <Button
              variant="outlined"
              disabled={searching}
              onClick={() => setScan((n) => n + LEGACY_SCAN_STEP)}
              sx={{ minHeight: 44 }}
            >
              {searching ? 'Searching…' : 'Search older cards'}
            </Button>
          ) : null}
        </Box>
        {query.isError && data ? (
          <ErrorState
            compact
            title="Couldn't search further back."
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : null}
      </>
    );
  }

  return (
    <Section title="From the original app" id="person-original">
      <Box ref={setNode}>{body}</Box>
    </Section>
  );
}
