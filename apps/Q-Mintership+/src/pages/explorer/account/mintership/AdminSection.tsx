/**
 * "As a Minter Admin": what they proposed for others (from their own MINTER
 * history, in the person page's words), Activity's figures for them when
 * the Activity page has already read a window this session (this never
 * starts that read: it is the whole group's), and their answers on request.
 */
import { firstAlikeLines } from '../../../history/parts/alikeEvents';
import { useSyncExternalStore } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { activityKey, type ActivityData } from '../../../../data/activity';
import { getQueryState, subscribeQuery } from '../../../../data/query';
import type { TimelineEvent } from '../../../../data/timeline';
import type { ActivityWindow } from '../../../../state/settings';
import { PATHS } from '../../../../routes/paths';
import { TimelineList } from '../../../history/parts/TimelineList';
import { proposalsSummary } from '../../../person/personWords';
import { AnswersPanel } from './AnswersPanel';
import { activityLine, activitySource } from './mintershipWords';
import { Note, SubHeading } from './parts';
import { useViewState } from '../../../../hooks/useViewState';

const FIRST = 5;
/** Activity's windows, the one the screen prefers first. */
const WINDOWS: ActivityWindow[] = [30, 60, 90, 180];

const ACTIVITY_KEYS = WINDOWS.map((days) => activityKey({ days }));

function subscribeActivity(listener: () => void): () => void {
  const offs = ACTIVITY_KEYS.map((key) => subscribeQuery(key, listener));
  return () => offs.forEach((off) => off());
}

/** The first Activity window already in the store (30 days first), without ever loading one. */
function cachedActivity(): ActivityData | undefined {
  for (const key of ACTIVITY_KEYS) {
    const data = getQueryState<ActivityData>(key).data;
    if (data) return data;
  }
  return undefined;
}

function ActivityFigures({ address }: { address: string }) {
  const found = useSyncExternalStore(subscribeActivity, cachedActivity);
  const row = found
    ? [...found.report.current, ...found.report.former].find((r) => r.address === address)
    : undefined;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <SubHeading>Approvals and activity</SubHeading>
      {found ? (
        <Note>
          {activitySource(found.range.days ?? WINDOWS[0])}{' '}
          {row ? activityLine(row) : 'It lists no figures for them in that window.'}
        </Note>
      ) : (
        <Note>Activity counts each Minter Admin’s approvals, rejections and misses by window.</Note>
      )}
      <Box>
        <Button component={RouterLink} to={PATHS.activity} sx={{ minHeight: 44, ml: -1 }}>
          Minter Admin Activity
        </Button>
      </Box>
    </Box>
  );
}

export function AdminSection({
  address,
  proposals,
  isAdmin,
  wasAdmin,
  nowMs,
}: {
  address: string;
  proposals: TimelineEvent[];
  isAdmin: boolean;
  wasAdmin: boolean;
  nowMs: number;
}) {
  const [all, setAll] = useViewState('admin:all', false);
  // The first lines, whole: proposals of one kind made the same day are one line.
  const shown = all ? proposals : firstAlikeLines(proposals, FIRST);
  const admin = isAdmin || wasAdmin;
  return (
    <Section
      title={admin ? 'As a Minter Admin' : 'Proposals they made'}
      id="explorer-mintership-admin"
    >
      <SubHeading>Proposals</SubHeading>
      {proposals.length ? (
        <>
          <Note>{proposalsSummary(proposals)}</Note>
          <TimelineList
            groupAlike
            events={shown}
            showSubject
            showProposer={false}
            nowMs={nowMs}
            label="Their proposals, newest first"
          />
          {proposals.length > shown.length || all ? (
            <Box>
              {/* One button that stays: the focus stays on it. */}
              <Button
                variant="outlined"
                onClick={() => setAll((open) => !open)}
                aria-expanded={all}
                sx={{ minHeight: 44 }}
              >
                {all ? 'Show fewer' : `Show all ${proposals.length}`}
              </Button>
            </Box>
          ) : null}
        </>
      ) : (
        <Note>No proposals for others in their MINTER history.</Note>
      )}
      {admin ? <ActivityFigures address={address} /> : null}
      <SubHeading>Answers</SubHeading>
      <AnswersPanel address={address} />
    </Section>
  );
}
