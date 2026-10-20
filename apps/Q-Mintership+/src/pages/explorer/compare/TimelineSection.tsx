/**
 * Compare → Timeline together: the firsts of every compared account in one
 * list, oldest first: where its first QORT came from, its first own
 * transaction, its primary name, its self-share, a level moved, its join
 * request, joining MINTER, a nomination. Each line has its letter, what
 * happened, its block (a link to the transaction) or its date; between
 * lines, how far apart they are ("5 blocks later"). A list, not a chart:
 * it reads the same on a phone.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
import { Section } from '../../../components/common/Section';
import { TxSentence } from '../../../components/explorer/TxSentence';
import { explorerTxPath } from '../../../routes/paths';
import { eventWhen, gapWords, type TimelineEvent } from '../../../rules/explorer/compare';
import { formatDate } from '../../../utils/format';
import { LetterBadge } from './letters';
import { SteppedList, Waiting } from './parts';
import type { CompareData } from './useCompareData';

function EventLine({
  event,
  previous,
  accent,
}: {
  event: TimelineEvent;
  previous: TimelineEvent | null;
  accent: string;
}) {
  const when = eventWhen(event);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
      {previous ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 4.5 }}>
          {gapWords(previous, event)}
        </Typography>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <LetterBadge letter={event.letter} accent={accent} size={28} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
            <span className="qmp-visually-hidden">: </span>
            <TxSentence parts={event.parts} />
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.75 }}
          >
            {event.signature ? (
              <Link
                component={RouterLink}
                to={explorerTxPath(event.signature)}
                aria-label={`${when}: open the transaction`}
                sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
              >
                {when}
              </Link>
            ) : (
              <span>{when}</span>
            )}
            {event.height !== null ? (
              <>
                <span aria-hidden>·</span>
                <span>{formatDate(event.timestamp)}</span>
              </>
            ) : null}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function TimelineSection({
  data,
  accents,
  reading,
}: {
  data: CompareData;
  accents: readonly string[];
  /** Its reads haven't all come in yet. */
  reading: boolean;
}) {
  const events = data.timeline;
  const accentOf = (address: string) => accents[data.addresses.indexOf(address)] ?? accents[0];
  if (!events.length && !reading) return null;
  return (
    <Section title="Timeline together" id="compare-timeline">
      {events.length ? (
        <SteppedList
          ordered
          items={events}
          label="Timeline together"
          keyOf={(event) => event.key}
          render={(event, i) => (
            <EventLine
              event={event}
              previous={i > 0 ? events[i - 1] : null}
              accent={accentOf(event.address)}
            />
          )}
        />
      ) : null}
      {reading ? (
        <Waiting announce="Reading the timeline…">
          Reading first transactions, self-shares, names and MINTER history for the timeline…
        </Waiting>
      ) : null}
    </Section>
  );
}
