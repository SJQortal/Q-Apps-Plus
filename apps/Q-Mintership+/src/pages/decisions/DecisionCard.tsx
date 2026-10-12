/**
 * One decision in full, for the Minter Admins and everyone following along:
 * what it does and to whom, who proposed it, the subject's profile (and the
 * nomination behind an invite), k of n with the time left to sign, who has
 * signed, and Sign / Signed ✓ / Signed ✓ (confirming…).
 */
import { useState } from 'react';
import { Box, Button, Checkbox, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import type { ChainNow } from '../../data/chain';
import { effectiveBlocksMinted } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { KIND_LABEL, type Decision } from '../../rules/decision';
import { useAccount } from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { AvatarStack, PersonChip, PersonInline } from '../../components/common/Person';
import { DoneChip, SigningClock } from '../../components/decision/DecisionParts';
import { ProgressRing } from '../../components/common/ProgressRing';
import { Card, DecisionPhaseChip } from '../../components/common/Section';
import { primarySoft } from '../../hub-theme';
import { formatCount, formatDate, formatRelative, plural } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import {
  banLengthText,
  canSign,
  decisionCardId,
  expiryLine,
  myAnswer,
  phaseLine,
  signedLabel,
} from './decisionUi';

export interface SubjectFacts {
  isMember: boolean;
  isAdmin: boolean;
  /** When they joined MINTER (ms), from the member list. */
  joined?: number;
  /** Their primary name when the member list has it (undefined: look it up). */
  name?: string | null;
}

export interface DecisionCardProps {
  decision: Decision;
  now: ChainNow;
  myPublicKey: string | null;
  /** Minter Admins get Sign and the bulk checkbox; everyone else reads. */
  canAct: boolean;
  /** The nomination behind an invite, when there is one. */
  nomination: Nomination | null;
  /** Admin addresses → primary names, for the signers. */
  adminNames: Map<string, string | null>;
  /** The subject's MINTER standing, or null while unknown. */
  subjectFacts: SubjectFacts | null;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (signature: string) => void;
  onSign?: (decision: Decision) => void;
  highlighted?: boolean;
}

export function DecisionCard(props: DecisionCardProps) {
  const {
    decision: d,
    now,
    myPublicKey,
    canAct,
    nomination,
    adminNames,
    subjectFacts,
    selecting,
    selected,
    onToggleSelect,
    onSign,
    highlighted,
  } = props;
  const pending = usePendingWrite(writeKeys.sign(d.signature));
  const answer = myAnswer(d, myPublicKey);
  const signable = canAct && canSign(d, answer, pending);
  const signed = canAct ? signedLabel(answer, pending) : null;
  const tally = d.tally;
  const confirming = tally ? tally.inFlight.filter((x) => x.approval) : [];
  const title = KIND_LABEL[d.kind];
  const subject = useDisplayName(
    d.subject ?? '',
    d.subject ? (nomination?.nomineeName ?? subjectFacts?.name) : null
  );
  const fullTitle = d.subject ? `${title}, ${subject.label}` : title;
  const line = phaseLine(d, now);

  return (
    <Card
      as="article"
      id={decisionCardId(d.signature)}
      tabIndex={-1}
      aria-label={fullTitle}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        outline: 'none',
        scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)',
        transition: 'box-shadow 300ms ease, background-color 300ms ease',
        ...(highlighted
          ? {
              boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
              backgroundColor: primarySoft(theme),
            }
          : {}),
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {selecting && signable ? (
          <Checkbox
            checked={Boolean(selected)}
            onChange={() => onToggleSelect?.(d.signature)}
            slotProps={{ input: { 'aria-label': `Select to sign: ${fullTitle}` } }}
            sx={{ width: 44, height: 44, ml: -1, mt: -0.5, flexShrink: 0 }}
          />
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
              {title}
            </Typography>
            <DecisionPhaseChip phase={d.phase} />
          </Box>
          {d.subject ? (
            <PersonChip
              address={d.subject}
              name={nomination?.nomineeName ?? subjectFacts?.name}
              size={40}
              secondary={<SubjectLine address={d.subject} facts={subjectFacts} kind={d.kind} />}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Core doesn’t say for whom: its answer leaves the invitee out.
            </Typography>
          )}
        </Box>
        {tally ? (
          <ProgressRing
            value={tally.approvalCount}
            target={tally.needed}
            pending={confirming.length}
            size={56}
          />
        ) : null}
      </Box>

      <KindDetails decision={d} nomination={nomination} now={now} />

      {d.creatorAddress ? (
        <Typography component="div" variant="body2" color="text.secondary">
          Proposed by{' '}
          <PersonInline address={d.creatorAddress} name={adminNames.get(d.creatorAddress)} />{' '}
          {formatRelative(d.createdAt, now.timestamp)}
          {d.blockHeight ? ` (block ${formatCount(d.blockHeight)})` : ''}.
        </Typography>
      ) : null}

      {d.window && (d.phase === 'open' || d.phase === 'early') ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <SigningClock now={now} height={d.window.lastUsefulSignatureHeight} />
          <Typography variant="body2" color="text.secondary">
            {expiryLine(d, now)}
          </Typography>
        </Box>
      ) : null}

      {tally && (tally.approvals.length || confirming.length || tally.rejections.length) ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {tally.approvals.length ? (
            <Signers
              label={`Signed by ${plural(tally.approvals.length, 'Minter Admin')}`}
              people={tally.approvals}
              names={adminNames}
            />
          ) : null}
          {confirming.length ? (
            <Signers
              label={`Confirming: ${plural(confirming.length, 'signature')} on the way`}
              people={confirming}
              names={adminNames}
              faded
            />
          ) : null}
          {tally.rejections.length ? (
            <Typography variant="body2" color="text.secondary">
              {plural(tally.rejections.length, 'rejection')} on chain.
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {line ? (
        <Typography variant="body2" color="text.secondary">
          {line}
        </Typography>
      ) : null}

      {canAct ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          {signed ? <DoneChip label={signed} settled={answer === 'signed'} /> : null}
          {pending?.status === 'sending' ? (
            <Button variant="contained" disabled sx={{ minHeight: 44 }}>
              Signing…
            </Button>
          ) : null}
          {signable ? (
            <>
              {answer === 'rejected' ? (
                <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
                  Your latest answer on chain is a rejection. Signing replaces it: only your latest
                  answer counts.
                </Typography>
              ) : null}
              {pending?.status === 'failed' ? (
                <Typography variant="body2" sx={{ flexBasis: '100%' }}>
                  Your last try hasn’t shown up yet. Wait a minute before signing again.
                </Typography>
              ) : null}
              <Button
                variant="contained"
                onClick={() => onSign?.(d)}
                aria-label={`Sign: ${fullTitle}`}
                sx={{ minHeight: 44, minWidth: 96, ml: 'auto' }}
              >
                Sign
              </Button>
            </>
          ) : null}
        </Box>
      ) : null}
    </Card>
  );
}

function SubjectLine({
  address,
  facts,
  kind,
}: {
  address: string;
  facts: SubjectFacts | null;
  kind: Decision['kind'];
}) {
  const account = useAccount(address);
  const parts: string[] = [];
  if (account.data) {
    parts.push(`Level ${account.data.level}`);
    parts.push(`${formatCount(effectiveBlocksMinted(account.data))} blocks minted`);
  }
  if (facts) {
    if (facts.isAdmin) parts.push('Minter Admin');
    else if (facts.isMember)
      parts.push(facts.joined ? `in MINTER since ${formatDate(facts.joined)}` : 'in MINTER');
    else if (kind !== 'cancelBan') parts.push('not in MINTER');
  }
  return <>{parts.length ? parts.join(' · ') : 'Loading their profile…'}</>;
}

function KindDetails({
  decision: d,
  nomination: n,
  now,
}: {
  decision: Decision;
  nomination: Nomination | null;
  now: ChainNow;
}) {
  if (d.kind === 'invite')
    return (
      <InviteDetails
        nomination={n}
        now={now}
        // Whether they accepted only matters while it can still be approved.
        showAccepted={d.phase !== 'tooLate' && d.phase !== 'expired'}
      />
    );
  if (d.kind === 'kick' || d.kind === 'ban') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {d.kind === 'ban' ? (
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 700 }}>
              Length:
            </Box>{' '}
            {banLengthText(d.banSeconds)}
          </Typography>
        ) : null}
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          <Box component="span" sx={{ fontWeight: 700 }}>
            Reason:
          </Box>{' '}
          {d.reason?.trim() ? d.reason : 'No reason given.'}
        </Typography>
      </Box>
    );
  }
  return null;
}

function InviteDetails({
  nomination: n,
  now,
  showAccepted,
}: {
  nomination: Nomination | null;
  now: ChainNow;
  showAccepted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const record = n?.nomination;
  const supporters = n?.supporters.map((s) => s.publisher) ?? [];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {record ? (
        <>
          <Typography component="div" variant="body2" color="text.secondary">
            Nominated by{' '}
            <PersonInline address={record.publisher.address} name={record.publisher.name} />{' '}
            {formatRelative(record.publishedAt, now.timestamp)}
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
          <Typography
            sx={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              ...(expanded
                ? {}
                : {
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }),
            }}
          >
            {record.record.reason}
          </Typography>
          {record.record.reason.length > 160 || record.record.links.length ? (
            <Button
              size="small"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              {expanded ? 'Show less' : 'Show the whole nomination'}
            </Button>
          ) : null}
          {expanded && record.record.links.length ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {record.record.links.map((link) => (
                <Button
                  key={link}
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewOutlinedIcon />}
                  onClick={() => void openQortalLink(link)}
                  sx={{ minHeight: 44, textTransform: 'none', maxWidth: '100%' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {link.replace(/^qortal:\/\//i, '')}
                  </span>
                </Button>
              ))}
            </Box>
          ) : null}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Proposed directly on chain, without a nomination record.
        </Typography>
      )}
      {n && showAccepted ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}
        >
          {n.hasJoinRequest ? (
            <CheckCircleOutlineOutlinedIcon
              aria-hidden
              sx={{ fontSize: 18, color: 'success.main' }}
            />
          ) : null}
          <span>
            {n.hasJoinRequest
              ? 'Has accepted: approval makes them a member at once.'
              : 'Hasn’t accepted yet: after approval they still need to press Join now.'}
          </span>
        </Typography>
      ) : null}
    </Box>
  );
}

function Signers({
  label,
  people,
  names,
  faded,
}: {
  label: string;
  people: Array<{ address?: string }>;
  names: Map<string, string | null>;
  faded?: boolean;
}) {
  const known = people
    .filter((p): p is { address: string } => Boolean(p.address))
    .map((p) => ({
      address: p.address,
      name: names.has(p.address) ? names.get(p.address) : undefined,
    }));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {known.length ? (
        <Box sx={{ opacity: faded ? 0.7 : 1 }}>
          <AvatarStack people={known} label={label} max={10} />
        </Box>
      ) : null}
    </Box>
  );
}
