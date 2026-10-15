/**
 * What a Minter Admin proposed for others (invites, removals, bans, admin
 * changes), from their own history: a one-line summary, then the newest few.
 * Signatures are counted on the Activity page, which reads them by window.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import type { TimelineEvent } from '../../data/timeline';
import { Section } from '../../components/common/Section';
import { PATHS } from '../../routes/paths';
import { proposalsSummary } from './personWords';
import { TimelineList } from '../history/parts/TimelineList';

const FIRST = 5;

export function AdminProposals({
  proposals,
  isAdmin,
  nowMs,
}: {
  proposals: TimelineEvent[];
  isAdmin: boolean;
  nowMs: number;
}) {
  const [all, setAll] = useState(false);
  if (!proposals.length) return null;
  const shown = all ? proposals : proposals.slice(0, FIRST);
  return (
    <Section title={isAdmin ? 'As a Minter Admin' : 'Proposals they made'} id="person-proposals">
      <Typography sx={{ px: 0.5 }}>{proposalsSummary(proposals)}</Typography>
      <TimelineList
        events={shown}
        showSubject
        showProposer={false}
        nowMs={nowMs}
        label="Their proposals, newest first"
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {proposals.length > shown.length ? (
          <Button variant="outlined" onClick={() => setAll(true)} sx={{ minHeight: 44 }}>
            Show all {proposals.length}
          </Button>
        ) : null}
        <Button component={RouterLink} to={PATHS.activity} sx={{ minHeight: 44 }}>
          Approvals and activity
        </Button>
      </Box>
    </Section>
  );
}
