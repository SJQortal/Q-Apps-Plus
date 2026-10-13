/**
 * One decision in full, for the Minter Admins and everyone following along:
 * what it does and to whom, who proposed it, the subject's profile (and the
 * nomination behind an invite), k of n with the time left to sign, who has
 * signed and who rejected (against the same target), and the admin's own
 * answer: Sign and Reject, Signed ✓ with Withdraw my signature, Rejected,
 * each "(confirming…)" until it is in a block. Next to the signers: which
 * Minter Admins are considering it, and the admin's own Considering. An
 * admin change says what it does to the target; a decision a waiting admin
 * change would tip over carries a "Target may drop to …" chip. Its public
 * comments sit behind a "Comments (n)" toggle.
 */
import { useId, useState } from 'react';
import { Box, Button, Checkbox, Skeleton, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { READY_LABEL } from '../../constants/words';
import type { ChainNow } from '../../data/chain';
import { effectiveBlocksMinted } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { decisionCommentTarget } from '../../data/commentThread';
import { decisionTitle, isOwnAdminChange, type Decision } from '../../rules/decision';
import { useAccount } from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { AvatarStack, PersonChip, PersonInline } from '../../components/common/Person';
import { CommentsSection } from '../../components/comments/CommentsSection';
import { AnswerChip, SigningClock } from '../../components/decision/DecisionParts';
import {
  ConsideringControls,
  ConsideringLine,
  type ConsideringRequest,
} from '../../components/decision/Considering';
import { useConsideringFor } from '../../hooks/useConsidering';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { decisionPath } from '../../routes/paths';
import { ProgressRing } from '../../components/common/ProgressRing';
import { Card, DecisionPhaseChip } from '../../components/common/Section';
import { primarySoft } from '../../hub-theme';
import { formatCount, formatDate, formatRelative, plural } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { usePendingAnswers } from '../../writes/optimistic';
import type { DecisionRisk, ShiftScenario } from '../../rules/targetShift';
import { TargetImpact } from './TargetImpact';
import { TargetRiskChip, TargetRiskNote } from './TargetRiskChip';
import type { LabelOf } from './targetShiftUi';
import {
  answerView,
  banEndLine,
  banLengthText,
  canReject,
  canSign,
  canWithdraw,
  decisionCardId,
  expiryLine,
  phaseLine,
  type AnswerIntent,
} from './decisionUi';

/** Phases in which a decision still collects answers (Considering shows then). */
const COLLECTING_PHASES: ReadonlySet<Decision['phase']> = new Set([
  'open',
  'early',
  'unconfirmed',
  'thresholdMet',
  'rejectedMet',
]);

const SENDING_TEXT: Record<AnswerIntent, string> = {
  sign: 'Signing…',
  reject: 'Rejecting…',
  withdraw: 'Withdrawing…',
};

export interface SubjectFacts {
  isMember: boolean;
  isAdmin: boolean;
  /** When they joined MINTER (ms), from the member list. */
  joined?: number;
  /** Their primary name when the member list has it (undefined: look it up). */
  name?: string | null;
}

export type NominationsState = 'loaded' | 'loading' | 'error';

export interface DecisionCardProps {
  decision: Decision;
  now: ChainNow;
  myPublicKey: string | null;
  /** The signed-in account (for the admin's own Considering). */
  myAddress?: string | null;
  /** Minter Admins get Sign and the bulk checkbox; everyone else reads. */
  canAct: boolean;
  /** The nomination behind an invite, when there is one. */
  nomination: Nomination | null;
  /**
   * Whether the nominations are in: until then (or after a failed read) an
   * invite without one is not called record-less. Default 'loaded'.
   */
  nominationsState?: NominationsState;
  /** Read the nominations again (after a failed read). */
  onRetryNominations?: () => void;
  /** Admin addresses → primary names, for the signers. */
  adminNames: Map<string, string | null>;
  /** The subject's MINTER standing, or null while unknown. */
  subjectFacts: SubjectFacts | null;
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (signature: string) => void;
  onSign?: (decision: Decision) => void;
  /** Reject (admins who haven't answered). */
  onReject?: (decision: Decision) => void;
  /** Withdraw my signature (admins whose signature is in a block). */
  onWithdraw?: (decision: Decision) => void;
  /** Considering, or No longer considering (admins). */
  onConsider?: (request: ConsideringRequest) => void;
  highlighted?: boolean;
  /** An admin change: what it does to the target if it passes. */
  impact?: ShiftScenario | null;
  /** A waiting admin change would tip this decision over (the chip). */
  risk?: DecisionRisk | null;
  /** Decisions' labels by signature, for the two above. */
  labelOf?: LabelOf;
  /** A "Copy link" to the decision's own page (default; its page has one in the header). */
  copyLink?: boolean;
  /** Its comments start open (on the decision's own page). */
  commentsOpen?: boolean;
}

export function DecisionCard(props: DecisionCardProps) {
  const {
    decision: d,
    now,
    myPublicKey,
    myAddress,
    canAct,
    nomination,
    nominationsState = 'loaded',
    onRetryNominations,
    adminNames,
    subjectFacts,
    selecting,
    selected,
    onToggleSelect,
    onSign,
    onReject,
    onWithdraw,
    onConsider,
    highlighted,
    impact,
    risk,
    labelOf,
    copyLink = true,
    commentsOpen = false,
  } = props;
  const [riskOpen, setRiskOpen] = useState(false);
  const riskId = useId();
  const pendingAnswers = usePendingAnswers(d.signature);
  const view = answerView(d, myPublicKey, pendingAnswers);
  const signable = canAct && canSign(d, view);
  const rejectable = canAct && canReject(d, view);
  const withdrawable = canAct && canWithdraw(d, view, now);
  const tally = d.tally;
  const confirming = tally ? tally.inFlight.filter((x) => x.approval) : [];
  const rejecting = tally ? tally.inFlight.filter((x) => !x.approval) : [];
  const withdrawn = tally ? tally.rejections.filter((x) => x.withdrew).length : 0;
  const title = decisionTitle(d);
  const subject = useDisplayName(
    d.subject ?? '',
    d.subject ? (nomination?.nomineeName ?? subjectFacts?.name) : null
  );
  const fullTitle = d.subject ? `${title}, ${subject.label}` : title;
  const line = phaseLine(d, now);
  // Considering is shown while it collects signatures; an invite's nomination carries over.
  const considering = useConsideringFor(
    {
      pendingSignature: d.signature,
      nomineeAddress: d.kind === 'invite' ? d.subject : null,
      since: nomination?.publishedAt ?? d.createdAt,
    },
    tally,
    { enabled: COLLECTING_PHASES.has(d.phase), myAddress: canAct ? myAddress : null }
  );
  const consider = (mode: ConsideringRequest['mode']) =>
    considering.publishTarget &&
    onConsider?.({
      target: considering.publishTarget,
      mode,
      label: d.subject ? `${title}: ${subject.label}` : title,
      // Only an invite has a nominee who reads it too.
      nominee: d.kind === 'invite',
    });

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
        {selecting && signable && view.shown === 'none' ? (
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
            {risk && labelOf ? (
              <TargetRiskChip
                risk={risk}
                open={riskOpen}
                onToggle={() => setRiskOpen((v) => !v)}
                controls={riskId}
              />
            ) : null}
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

      {risk && labelOf && riskOpen ? (
        <TargetRiskNote
          id={riskId}
          risk={risk}
          labelOf={labelOf}
          advice={canAct}
          withdraw={withdrawable}
        />
      ) : null}

      <KindDetails
        decision={d}
        nomination={nomination}
        nominationsState={nominationsState}
        onRetryNominations={onRetryNominations}
        now={now}
      />

      {impact && labelOf ? (
        <TargetImpact scenario={impact} labelOf={labelOf} lead="If this passes" advice={canAct} />
      ) : null}

      {d.creatorAddress ? (
        <Typography component="div" variant="body2" color="text.secondary">
          {isOwnAdminChange(d) ? (
            'Their own proposal, '
          ) : (
            <>
              Proposed by{' '}
              <PersonInline
                address={d.creatorAddress}
                name={adminNames.get(d.creatorAddress)}
              />{' '}
            </>
          )}
          {formatRelative(d.createdAt, now.timestamp)}
          {d.blockHeight ? ` (block ${formatCount(d.blockHeight)})` : ''}.
        </Typography>
      ) : null}

      {d.window && (d.phase === 'open' || d.phase === 'early') ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <SigningClock now={now} height={d.window.lastUsefulSignatureHeight} detailVisible />
          <Typography variant="body2" color="text.secondary">
            {expiryLine(d, now)}
          </Typography>
        </Box>
      ) : null}

      {tally &&
      (tally.approvals.length ||
        confirming.length ||
        tally.rejections.length ||
        rejecting.length) ? (
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
            <Signers
              label={`Rejected by ${plural(tally.rejections.length, 'Minter Admin')}${
                withdrawn ? ` (${withdrawn} withdrew a signature)` : ''
              }`}
              people={tally.rejections}
              names={adminNames}
            />
          ) : null}
          {rejecting.length ? (
            <Signers
              label={`Confirming: ${plural(rejecting.length, 'rejection')} on the way`}
              people={rejecting}
              names={adminNames}
              faded
            />
          ) : null}
          {tally.rejections.length ? (
            <Typography variant="body2" color="text.secondary">
              Rejections: {tally.rejectionCount} of the {tally.needed} that would end it (signatures
              are counted first).
            </Typography>
          ) : null}
        </Box>
      ) : null}

      <ConsideringLine people={considering.people} />

      {line ? (
        <Typography variant="body2" color="text.secondary">
          {line}
        </Typography>
      ) : null}

      {canAct ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <AnswerChip view={view} />
          {considering.mine ? (
            <ConsideringControls
              mine={considering.mine}
              label={fullTitle}
              canStart={rejectable}
              onSet={() => consider('set')}
              onClear={() => consider('clear')}
            />
          ) : null}
          {view.sending ? (
            <Button variant="contained" disabled sx={{ minHeight: 44 }}>
              {SENDING_TEXT[view.sending]}
            </Button>
          ) : null}
          {signable && view.shown === 'rejected' ? (
            <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
              Your latest answer on chain is a rejection. Signing replaces it: only your latest
              answer counts.
            </Typography>
          ) : null}
          {view.failed && (signable || rejectable || withdrawable) ? (
            <Typography variant="body2" sx={{ flexBasis: '100%' }}>
              Your last try hasn’t shown up yet. Wait a minute before trying again.
            </Typography>
          ) : null}
          {withdrawable ? (
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => onWithdraw?.(d)}
              aria-label={`Withdraw my signature (counts as a rejection): ${fullTitle}`}
              sx={{ minHeight: 44, ml: 'auto', textAlign: 'left' }}
            >
              Withdraw my signature (counts as a rejection)
            </Button>
          ) : null}
          {rejectable || signable ? (
            // Reject and Sign stay side by side, at the end, when the row wraps on phones.
            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
              {rejectable ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={() => onReject?.(d)}
                  aria-label={`Reject: ${fullTitle}`}
                  sx={{ minHeight: 44, minWidth: 96 }}
                >
                  Reject
                </Button>
              ) : null}
              {signable ? (
                <Button
                  variant="contained"
                  onClick={() => onSign?.(d)}
                  aria-label={`Sign: ${fullTitle}`}
                  sx={{ minHeight: 44, minWidth: 96 }}
                >
                  Sign
                </Button>
              ) : null}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {copyLink ? (
        <Box sx={{ display: 'flex', mt: -0.5, ml: -1 }}>
          <CopyLinkButton
            variant="text"
            path={decisionPath(d.signature)}
            what={`the decision ${fullTitle}`}
          />
        </Box>
      ) : null}

      <CommentsSection
        target={decisionCommentTarget(d, nomination)}
        label={fullTitle}
        defaultOpen={commentsOpen}
      />
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
  nominationsState,
  onRetryNominations,
  now,
}: {
  decision: Decision;
  nomination: Nomination | null;
  nominationsState: NominationsState;
  onRetryNominations?: () => void;
  now: ChainNow;
}) {
  if (d.kind === 'invite')
    return (
      <InviteDetails
        nomination={n}
        nominationsState={nominationsState}
        onRetryNominations={onRetryNominations}
        now={now}
        // Whether they accepted only matters while it can still be approved.
        showAccepted={d.phase !== 'tooLate' && d.phase !== 'expired'}
      />
    );
  if (d.kind === 'kick' || d.kind === 'ban') {
    const banEnd = banEndLine(d, now);
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
        {banEnd ? (
          <Typography variant="body2" color="text.secondary">
            {banEnd}
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
  nominationsState,
  onRetryNominations,
  now,
  showAccepted,
}: {
  nomination: Nomination | null;
  nominationsState: NominationsState;
  onRetryNominations?: () => void;
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
      ) : nominationsState === 'loading' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="text" width={160} aria-hidden />
          <Typography variant="body2" color="text.secondary">
            Looking up its nomination…
          </Typography>
        </Box>
      ) : nominationsState === 'error' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Couldn’t load the nomination behind this invite.
          </Typography>
          {onRetryNominations ? (
            <Button size="small" onClick={onRetryNominations} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          ) : null}
        </Box>
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
              ? `${READY_LABEL}: approval makes them a member at once.`
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
          <AvatarStack people={known} label={label} max={10} showNames />
        </Box>
      ) : null}
    </Box>
  );
}
