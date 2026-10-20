/**
 * History → From the original app: Q-Mintership's nomination cards and
 * Minter Admin proposals, newest first, 20 at a time. The list of cards is
 * a few cheap searches; each card's body is read only when its row shows.
 */
import { useState } from 'react';
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { LEGACY_PAGE_SIZE, loadLegacyIndex, type LegacyBoard } from '../../data/legacy';
import { useQuery } from '../../hooks/useQuery';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { Card, Section } from '../../components/common/Section';
import { ORIGINAL_APP_LINK, openOriginalApp } from '../../utils/links';
import { formatCount, sentenceStart } from '../../utils/format';
import { LegacyCardItem } from './parts/LegacyCardItem';
import { ORIGINAL_APP_NAME, ORIGINAL_WORDS } from '../../constants/plus';

type Filter = 'all' | Exclude<LegacyBoard, 'admin'>;

export function LegacyBoards({ isAdmin }: { isAdmin: boolean }) {
  const index = useQuery('legacy:index', (force) => loadLegacyIndex({ force }));
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(LEGACY_PAGE_SIZE);
  const cards = (index.data?.cards ?? []).filter((c) => filter === 'all' || c.board === filter);

  let body;
  if (index.isError && !index.data) {
    body = (
      <ErrorState
        title={`Couldn't load ${ORIGINAL_WORDS.app}'s cards.`}
        error={index.error}
        onRetry={() => void index.refetch()}
      />
    );
  } else if (!index.data) {
    body = <ListSkeleton count={3} label={`Loading ${ORIGINAL_WORDS.app}'s cards`} />;
  } else if (!cards.length) {
    body = (
      <EmptyState
        title="No cards here."
        description={`Your node didn't find any cards from ${ORIGINAL_WORDS.app} of this kind.`}
      />
    );
  } else {
    body = (
      <>
        <Box
          component="ul"
          aria-label={`Cards from ${ORIGINAL_WORDS.app}, newest first`}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {cards.slice(0, shown).map((row) => (
            <li key={row.identifier}>
              <LegacyCardItem row={row} />
            </li>
          ))}
        </Box>
        {index.data.truncated ? <TruncatedNote what={`${ORIGINAL_WORDS.app}'s cards`} /> : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 200px' }}>
            Showing {formatCount(Math.min(shown, cards.length))} of {formatCount(cards.length)}{' '}
            cards.
          </Typography>
          {cards.length > shown ? (
            <Button
              variant="outlined"
              onClick={() => setShown((n) => n + LEGACY_PAGE_SIZE)}
              sx={{ minHeight: 44 }}
            >
              Load more
            </Button>
          ) : null}
        </Box>
      </>
    );
  }

  return (
    <Section title={`From ${ORIGINAL_WORDS.app}`} id="history-original">
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        {ORIGINAL_APP_NAME}&apos;s nomination board and Minter Admin proposals, kept read-only with
        their poll results and comments. New nominations happen in Nominations.
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, value: Filter | null) => {
          if (value) {
            setFilter(value);
            setShown(LEGACY_PAGE_SIZE);
          }
        }}
        aria-label="Which cards to show"
        sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { minHeight: 44, px: 1.5 } }}
      >
        <ToggleButton value="all">All</ToggleButton>
        <ToggleButton value="minter">Nominations</ToggleButton>
        <ToggleButton value="ar">Admin proposals</ToggleButton>
      </ToggleButtonGroup>
      {body}
      {isAdmin ? (
        <Card sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <LockOutlinedIcon aria-hidden sx={{ color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ flex: '1 1 220px' }}>
            {sentenceStart(ORIGINAL_WORDS.adminBoard)} was encrypted to Minter Admins, so it
            isn&apos;t shown here.
            {ORIGINAL_APP_LINK ? ` You can still read it in ${ORIGINAL_WORDS.app}.` : null}
          </Typography>
          {ORIGINAL_APP_LINK ? (
            <Button
              variant="outlined"
              endIcon={<OpenInNewOutlinedIcon />}
              onClick={() => void openOriginalApp()}
              sx={{ minHeight: 44 }}
            >
              Open {ORIGINAL_WORDS.app}
            </Button>
          ) : null}
        </Card>
      ) : null}
    </Section>
  );
}
