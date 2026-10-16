/**
 * Overview's "Direct links": the first three things recorded between this
 * account and others (the same findings, in the same order, as Connections →
 * Recorded between them), one line each, and "All connections (n)" to that
 * tab. When the data checked has none, one line says so; a part that
 * couldn't be read is named, with Retry, and never counted as none found.
 * When the links read stopped at its ceiling, a line says so.
 *
 * It reads the same keys as the Connections tab (links, payments each way,
 * asset transfers; the links and asset reads are heavy), once it nears the
 * screen, so opening the tab afterwards costs nothing more.
 */
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Link, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Section } from '../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { TxSentence } from '../../../components/explorer/TxSentence';
import { useInView } from '../../../hooks/useInView';
import { explorerAccountPath } from '../../../routes/paths';
import { formatCount } from '../../../utils/format';
import { useConnections, useRecorded } from './connections/useConnections';
import { tabIdOf } from './tabIds';
import { LINKS_CAPPED_NOTE, unreadWords, whenLine } from './connections/words';
import { FIELD_BLOCK_SX } from '../../../components/explorer/fieldBlock';
import { RewardShareNote } from '../../../components/explorer/RewardShareNote';
import { DirectionMark } from '../../../components/explorer/DirectionMark';
import { directionRules, type Flow } from '../../../components/explorer/directionTone';

export interface DirectLinksPreviewProps {
  address: string;
}

/** Payments one way: received from it incoming, sent to it outgoing. */
function flowOf(kind: string): Flow | undefined {
  return kind === 'paidBy' ? 'in' : kind === 'paidTo' ? 'out' : undefined;
}

/** How many lines the preview shows. */
const PREVIEW = 3;

export function DirectLinksPreview({ address }: DirectLinksPreviewProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const data = useConnections(address, near);
  const recorded = useRecorded(data);
  const location = useLocation();
  const { failed } = data;
  const firstError = failed.length ? data[failed[0]].error : undefined;
  const capped = data.links.data?.truncated === true;
  // Partial: a part couldn't be read, isn't in yet, or was read only in part.
  const partial = failed.length > 0 || !data.settled || capped;
  const cappedNote = capped ? (
    <Typography variant="body2" color="text.secondary">
      {LINKS_CAPPED_NOTE}
    </Typography>
  ) : null;
  const unread = failed.length ? (
    <ErrorState
      compact
      title={`Couldn’t read ${unreadWords(failed)}.`}
      error={firstError}
      onRetry={data.retryFailed}
    />
  ) : null;
  const allLink = (
    <Link
      component={RouterLink}
      to={explorerAccountPath(address, 'connections')}
      replace
      // Keeps what the page was opened with, as the tabs do.
      state={location.state}
      onClick={() =>
        // The Overview goes; the tab it opened takes the focus.
        requestAnimationFrame(() => document.getElementById(tabIdOf('connections'))?.focus())
      }
      sx={{
        alignSelf: 'flex-start',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 44,
        fontWeight: 600,
      }}
    >
      {recorded.length
        ? `All connections (${formatCount(recorded.length)}${partial ? '+' : ''})`
        : 'All connections'}
      <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
    </Link>
  );

  let body: React.ReactNode;
  if (!data.settled && recorded.length < PREVIEW)
    body = <ListSkeleton count={1} label="Loading its direct links" />;
  else if (!recorded.length)
    body = unread ? (
      <>
        {unread}
        {allLink}
      </>
    ) : (
      <>
        <Typography color="text.secondary">No direct links found in the data checked.</Typography>
        {cappedNote}
      </>
    );
  else
    body = (
      <>
        <Box
          component="ul"
          aria-label="Direct links"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {recorded.slice(0, PREVIEW).map((finding) => (
            <Box
              component="li"
              key={finding.key}
              data-direction={flowOf(finding.kind)}
              sx={(theme) => ({ ...FIELD_BLOCK_SX, ...directionRules(theme) })}
            >
              {/* A div: the people in the sentence are chips. */}
              <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
                {flowOf(finding.kind) ? (
                  <DirectionMark flow={flowOf(finding.kind) as Flow} />
                ) : null}
                <TxSentence parts={finding.parts} />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {whenLine(finding)}
              </Typography>
            </Box>
          ))}
        </Box>
        {/* A sponsor or another account minting with it: what reward shares were. */}
        {recorded
          .slice(0, PREVIEW)
          .some(
            (f) => f.kind === 'sponsor' || f.kind === 'mintingWith' || f.kind === 'sponsees'
          ) ? (
          <RewardShareNote />
        ) : null}
        {cappedNote}
        {unread}
        {allLink}
      </>
    );

  return (
    <Box ref={setNode} sx={{ minWidth: 0 }}>
      <Section title="Direct links" id="overview-direct-links">
        {body}
      </Section>
    </Box>
  );
}
