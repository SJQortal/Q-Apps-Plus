/**
 * One nomination, as everyone sees it: the nominee, who nominated and who
 * supports (with their notes), the reason and links, and where it stands
 * (waiting for a Minter Admin, k of n signatures with the countdown,
 * approved, or how it ended). Screens add their own buttons through
 * `actions`.
 */
import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import type { NominationState } from '../../rules/nomination';
import { useDisplayName } from '../../hooks/useDisplayName';
import { formatDuration, formatRelative } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { Countdown } from '../common/Countdown';
import { PersonChip, PersonInline } from '../common/Person';
import { ProgressRing } from '../common/ProgressRing';
import { Card, NominationStateChip } from '../common/Section';
import { readable } from '../../utils/readable';

export interface NominationCardProps {
  nomination: Nomination;
  now: ChainNow;
  actions?: ReactNode;
  /** Shorter: the reason is clamped, links and supporters' notes are hidden. */
  compact?: boolean;
  /** Leave out the nominee line (on the nominee's own page). */
  hideNominee?: boolean;
  /** When a decided nomination ended (ms), for "Expired 3 days ago". */
  endedAt?: number | null;
}

const ENDED_TEXT: Partial<Record<NominationState, string>> = {
  joined: 'Joined MINTER',
  expired: 'Expired',
  rejected: 'Rejected',
  lapsed: 'Closed with no Minter Admin signature',
};

export function NominationCard({
  nomination: n,
  now,
  actions,
  compact,
  hideNominee,
  endedAt,
}: NominationCardProps) {
  const tally = n.decision?.tally ?? null;
  const window = n.decision?.window ?? null;
  const by = n.nomination?.publisher;
  const supporters = n.supporters.map((s) => s.publisher);
  const notes = compact
    ? []
    : n.supporters.flatMap((s) =>
        'note' in s.record && s.record.note ? [{ who: s.publisher, note: s.record.note }] : []
      );
  const ended = ENDED_TEXT[n.state];
  // No name in the record or the member list (a chain-only nomination): look it up.
  const nominee = useDisplayName(n.nominee, n.nomineeName ?? undefined);
  return (
    <Card
      as="article"
      aria-label={`Nomination of ${nominee.label}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {hideNominee ? null : <PersonChip address={n.nominee} name={nominee.name} size={40} />}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <NominationStateChip state={n.state} />
            {n.hasJoinRequest && (n.state === 'waiting' || n.state === 'signing') ? (
              <Typography
                variant="body2"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: readable('success'),
                }}
              >
                <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
                Accepted
              </Typography>
            ) : null}
          </Box>
        </Box>
        {tally && n.state === 'signing' ? (
          <ProgressRing
            value={tally.approvalCount}
            target={tally.needed}
            pending={tally.inFlight.filter((d) => d.approval).length}
          />
        ) : null}
      </Box>

      {by ? (
        <Typography component="div" variant="body2" color="text.secondary">
          Nominated by <PersonInline address={by.address} name={by.name} />{' '}
          {formatRelative(n.publishedAt, now.timestamp)}
          {supporters.length ? (
            <>
              , also supported by{' '}
              {supporters.map((p, i) => (
                <span key={p.address}>
                  {i > 0 ? (i === supporters.length - 1 ? ' and ' : ', ') : ''}
                  <PersonInline address={p.address} name={p.name} />
                </span>
              ))}
            </>
          ) : null}
          .
        </Typography>
      ) : n.decision?.creatorAddress ? (
        <Typography component="div" variant="body2" color="text.secondary">
          Proposed on chain by Minter Admin <PersonInline address={n.decision.creatorAddress} />{' '}
          {formatRelative(n.publishedAt, now.timestamp)}.
        </Typography>
      ) : null}

      {n.nomination?.record.reason ? (
        <Typography
          sx={{
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
            ...(compact
              ? {
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {n.nomination.record.reason}
        </Typography>
      ) : null}

      {!compact && n.nomination?.record.links.length ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {n.nomination.record.links.map((link) => (
            <Button
              key={link}
              size="small"
              variant="outlined"
              endIcon={<OpenInNewOutlinedIcon />}
              onClick={() => void openQortalLink(link)}
              sx={{
                minHeight: 44,
                textTransform: 'none',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                justifyContent: 'flex-start',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {link.replace(/^qortal:\/\//i, '')}
              </span>
            </Button>
          ))}
        </Box>
      ) : null}

      {notes.length ? (
        <Box
          component="ul"
          aria-label="Supporters' notes"
          sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {notes.map(({ who, note }) => (
            <Box
              component="li"
              key={who.address}
              sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider', minWidth: 0 }}
            >
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontStyle: 'italic' }}
              >
                “{note}”
              </Typography>
              <Typography component="div" variant="body2" color="text.secondary">
                <PersonInline address={who.address} name={who.name} />
              </Typography>
            </Box>
          ))}
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        {n.state === 'signing' && window ? (
          <Countdown
            now={now}
            height={window.lastUsefulSignatureHeight}
            suffix="left to sign"
            doneText="Signing time is over"
          />
        ) : null}
        {n.state === 'signing' && !window ? (
          <Typography variant="body2" color="text.secondary">
            On its way into a block; the clock starts then.
          </Typography>
        ) : null}
        {n.state === 'waiting' && n.waitingEndsAt ? (
          <Typography variant="body2" color="text.secondary">
            Waiting for a Minter Admin’s first signature:{' '}
            {formatDuration(n.waitingEndsAt - now.timestamp)} left.
          </Typography>
        ) : null}
        {n.state === 'approved' ? (
          <Typography variant="body2" color="text.secondary">
            Approved. They only need to press Join now to become a member.
          </Typography>
        ) : null}
        {ended ? (
          <Typography variant="body2" color="text.secondary">
            {ended}
            {endedAt ? ` ${formatRelative(endedAt, now.timestamp)}` : ''}.
          </Typography>
        ) : null}
        {actions ? (
          <Box sx={{ ml: 'auto', display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>
        ) : null}
      </Box>
    </Card>
  );
}
