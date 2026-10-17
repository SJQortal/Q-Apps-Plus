/**
 * Where an account stands in MINTER, in the app's own words (statusSentence,
 * from the app's status logic: nothing is worked out here), with its facts
 * and what the viewer can do for it (the profile's actions); then its
 * nomination in full (the open one or the latest), its rounds in brief, and
 * a link to the nomination's own page.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { isOpenState } from '../../../../rules/nomination';
import { nominationPath } from '../../../../routes/paths';
import { formatCount, formatDate } from '../../../../utils/format';
import { statusSentence } from '../../../person/personWords';
import type { MinterStory } from './useMinterStory';
import { nominationLine, roundsLine } from './mintershipWords';
import { Note } from './parts';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={FIELD_BLOCK_SX}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function StandingSection({
  story,
  self = false,
  actions = null,
}: {
  story: MinterStory;
  /** The signed-in account's own profile: said to "you". */
  self?: boolean;
  /** What the viewer can do for it (the profile's actions), under its facts. */
  actions?: ReactNode;
}) {
  const { status, since } = story;
  const person = status.data;
  let body;
  if (!person && status.isError) {
    body = (
      <ErrorState
        compact
        title="Couldn't load where they stand in MINTER."
        error={status.error}
        onRetry={() => void status.refetch()}
      />
    );
  } else if (!person || (person.isMember && !story.events)) {
    body = <ListSkeleton count={1} label="Loading where they stand in MINTER" />;
  } else {
    const next = person.progress;
    body = (
      <>
        <Typography sx={{ px: 0.5 }}>{statusSentence(person, since, self)}</Typography>
        <Box
          component="dl"
          aria-label="MINTER facts"
          sx={{
            m: 0,
            display: 'grid',
            gap: 1,
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          <Fact label="Level" value={String(person.level)} />
          <Fact label="Blocks minted" value={formatCount(person.blocksMinted)} />
          {next.nextLevelAt !== null && next.blocksToNextLevel !== null ? (
            <Fact
              label={`To level ${person.level + 1}`}
              value={`${formatCount(next.blocksToNextLevel)} blocks`}
            />
          ) : (
            <Fact label="To the next level" value="Top level" />
          )}
          {person.isMember && since ? (
            <Fact label="In MINTER since" value={formatDate(since)} />
          ) : null}
          {person.hasJoinRequest && !person.isMember ? (
            <Fact label="Join request" value="Sent" />
          ) : null}
        </Box>
        {actions}
      </>
    );
  }
  const settings = story.settingsFailed;
  return (
    <Section title="MINTER status" id="explorer-mintership-status">
      {body}
      {settings ? (
        <ErrorState
          compact
          title={settings.title}
          error={settings.error}
          onRetry={settings.retry}
        />
      ) : null}
    </Section>
  );
}

/**
 * Their nomination, when they have rounds or nomination records: the open
 * one or the latest in full (`card`, the profile's), its rounds in brief.
 */
export function NominationSummary({
  address,
  story,
  card = null,
}: {
  address: string;
  story: MinterStory;
  card?: ReactNode;
}) {
  const { rounds, current, nominations } = story;
  const has = Boolean(current) || Boolean(rounds?.length);
  if (!has) return null;
  const line = rounds ? roundsLine(rounds) : null;
  const open = Boolean(current && isOpenState(current.state));
  return (
    <Section
      title={current && !open ? 'Latest nomination' : 'Nomination'}
      id="explorer-mintership-nomination"
    >
      {card ??
        (current ? <Note>{nominationLine(current.state, isOpenState(current.state))}</Note> : null)}
      {line ? <Note>{line}</Note> : null}
      {nominations.isError && !nominations.data ? (
        <ErrorState
          compact
          title="Couldn't load their nomination records."
          error={nominations.error}
          onRetry={() => void nominations.refetch()}
        />
      ) : null}
      <Box>
        <Button component={RouterLink} to={nominationPath(address)} sx={{ minHeight: 44 }}>
          Open the nomination
        </Button>
      </Box>
    </Section>
  );
}
