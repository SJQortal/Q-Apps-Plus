/**
 * Overview's "Direct links": the first three things recorded between this
 * account and others (the same findings, in the same order, as Connections →
 * Recorded between them), one line each, and "All connections (n)" to that
 * tab. When the data checked has none, one line says so.
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
import { whenLine } from './connections/words';

export interface DirectLinksPreviewProps {
  address: string;
}

/** How many lines the preview shows. */
const PREVIEW = 3;

export function DirectLinksPreview({ address }: DirectLinksPreviewProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const data = useConnections(address, near);
  const recorded = useRecorded(data);
  const location = useLocation();
  const failed = data.links.isError && !data.links.data;

  let body: React.ReactNode;
  if (failed)
    body = (
      <ErrorState
        compact
        title="Couldn’t read its links."
        error={data.links.error}
        onRetry={() => void data.links.refetch()}
      />
    );
  else if (!data.settled && recorded.length < PREVIEW)
    body = <ListSkeleton count={1} label="Loading its direct links" />;
  else if (!recorded.length)
    body = (
      <Typography color="text.secondary">No direct links found in the data checked.</Typography>
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
            <Box component="li" key={finding.key} sx={{ minWidth: 0 }}>
              {/* A div: the people in the sentence are chips. */}
              <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
                <TxSentence parts={finding.parts} />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {whenLine(finding)}
              </Typography>
            </Box>
          ))}
        </Box>
        <Link
          component={RouterLink}
          to={explorerAccountPath(address, 'connections')}
          replace
          // Keeps what the page was opened with, as the tabs do.
          state={location.state}
          sx={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            minHeight: 44,
            fontWeight: 600,
          }}
        >
          All connections ({formatCount(recorded.length)}
          {data.settled ? '' : '+'})
          <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
        </Link>
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
