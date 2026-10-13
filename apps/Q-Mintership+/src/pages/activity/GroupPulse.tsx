/**
 * The group's pulse: members and how that changed in the window, admins and
 * signatures needed, join requests, how invites fared, open nominations,
 * and (only on request, it reads every member's account) the level spread.
 */
import { useId, useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import type { ActivityData } from '../../data/activity';
import type { NominationsData } from '../../data/nominations';
import type { NominationState } from '../../rules/nomination';
import { peekQuery } from '../../data/query';
import { levelSpreadKey } from '../../data/activity';
import { Card, Section, StatTile } from '../../components/common/Section';
import { ProgressBar } from '../../components/common/ProgressRing';
import { ErrorState } from '../../components/common/states';
import { formatCount, plural } from '../../utils/format';
import { blocksAsTime, NONE, ofTotal, percent, quarterDone, windowWords } from './format';
import { useLevelProgress, useLevelSpread } from './useActivity';

const tileGrid = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
  gap: 1.5,
} as const;

const OPEN_WORDS: Array<[NominationState, string]> = [
  ['waiting', 'waiting'],
  ['signing', 'signing'],
  ['approved', 'approved'],
  ['blocked', 'banned'],
];

function nominationHint(data: NominationsData | undefined): string | undefined {
  if (!data) return undefined;
  const parts = OPEN_WORDS.map(([state, word]) => {
    const n = data.open.filter((x) => x.state === state).length;
    return n ? `${n} ${word}` : '';
  }).filter(Boolean);
  return parts.length ? parts.join(' · ') : 'None open right now';
}

function membersHint(data: ActivityData): string {
  const { pulse } = data;
  const parts = [
    pulse.joinedKnown ? `${formatCount(pulse.joined)} joined` : '',
    pulse.leftKnown ? `${formatCount(pulse.left)} left` : '',
    pulse.kicked ? `${formatCount(pulse.kicked)} removed` : '',
    pulse.banned ? `${formatCount(pulse.banned)} banned` : '',
  ].filter(Boolean);
  return parts.length ? `${parts.join(', ')} ${windowWords(data.range.days)}` : '';
}

export function GroupPulse({
  data,
  nominations,
}: {
  data: ActivityData | undefined;
  nominations: { data: NominationsData | undefined; isError: boolean };
}) {
  return (
    <Section title="Group pulse" id="activity-pulse">
      {data ? (
        <Box sx={tileGrid}>
          <StatTile
            value={formatCount(data.memberCount)}
            label="MINTER members"
            hint={membersHint(data)}
          />
          <StatTile
            value={formatCount(data.signerCount)}
            label="Minter Admins"
            hint={`${plural(data.needed, 'signature')} needed per decision`}
          />
          <StatTile
            value={data.joinRequests === null ? NONE : formatCount(data.joinRequests)}
            label="Join requests"
            hint="Waiting for an approved invite"
          />
          <StatTile
            value={percent(data.pulse.approvalRate)}
            label="Invites approved"
            hint={
              data.pulse.approvalRate === null
                ? `None decided ${windowWords(data.range.days)}`
                : `${ofTotal(
                    data.pulse.invitesApproved,
                    data.pulse.invitesApproved +
                      data.pulse.invitesExpired +
                      data.pulse.invitesRejected
                  )} decided ${windowWords(data.range.days)}${
                    data.pulse.invitesRejected ? `, ${data.pulse.invitesRejected} rejected` : ''
                  }`
            }
          />
          <StatTile
            value={blocksAsTime(data.pulse.medianBlocksToApproval, data.now)}
            label="Invite to approval"
            hint="Median, from the invite's block"
          />
          <StatTile
            value={
              nominations.data ? (
                formatCount(nominations.data.open.length)
              ) : nominations.isError ? (
                NONE
              ) : (
                <Skeleton width={32} aria-hidden />
              )
            }
            label="Open nominations"
            hint={nominationHint(nominations.data)}
          />
        </Box>
      ) : (
        <Box sx={tileGrid} role="status" aria-label="Loading the group's pulse">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={96} />
          ))}
        </Box>
      )}
      {data && data.members.length ? <LevelSpreadCard members={data.members} /> : null}
    </Section>
  );
}

/** Opt-in: one account read per member, six at a time, then kept 30 minutes. */
function LevelSpreadCard({ members }: { members: string[] }) {
  const id = useId();
  const [open, setOpen] = useState(() => peekQuery(levelSpreadKey(members.length)) !== undefined);
  const spread = useLevelSpread(open ? members : null);
  const progress = useLevelProgress();
  const max = spread.data ? Math.max(1, ...spread.data.byLevel) : 1;

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Typography component="h3" sx={{ fontWeight: 700 }}>
            Level spread
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Reads each member's level: {formatCount(members.length)} small reads, kept for 30
            minutes.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          sx={{ minHeight: 44 }}
        >
          {open ? 'Hide' : 'Show levels'}
        </Button>
      </Box>
      {open ? (
        <Box id={id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {spread.data ? (
            <>
              <Typography variant="body2">
                <strong>
                  {ofTotal(spread.data.atLeast5, spread.data.total - spread.data.unknown)}
                </strong>{' '}
                members are level 5 or above, the level members can nominate from.
              </Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
                {spread.data.byLevel.map((count, level) => (
                  <Box
                    component="li"
                    key={level}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}
                  >
                    <Typography variant="body2" sx={{ width: 64, flexShrink: 0 }}>
                      Level {level}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 0, height: 10 }} aria-hidden>
                      <Box
                        sx={{
                          width: `${(count / max) * 100}%`,
                          minWidth: count ? 4 : 0,
                          height: '100%',
                          borderRadius: 5,
                          bgcolor: 'primary.main',
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCount(count)}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Level 0 members can mint but earn no rewards until level 1.
                {spread.data.unknown
                  ? ` ${plural(spread.data.unknown, 'account')} couldn't be read.`
                  : ''}
              </Typography>
            </>
          ) : spread.isError ? (
            <ErrorState
              compact
              title="Couldn't read the members' levels."
              error={spread.error}
              onRetry={() => void spread.refetch()}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* The exact count changes with every member read: shown, not announced. */}
              <Typography variant="body2" color="text.secondary">
                Reading levels: {ofTotal(progress.done, progress.total || members.length)} members
              </Typography>
              <ProgressBar
                value={progress.total ? progress.done / progress.total : 0}
                label="Reading members' levels"
                valueText={`${formatCount(progress.done)} of ${formatCount(progress.total || members.length)} members`}
              />
              {/* Announced at most four times: 0, 25, 50 and 75 % done. */}
              <span role="status" className="qmp-visually-hidden">
                {`Reading members' levels: ${quarterDone(progress.done, progress.total)}% done.`}
              </span>
            </Box>
          )}
        </Box>
      ) : null}
    </Card>
  );
}
