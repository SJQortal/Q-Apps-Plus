/**
 * One decision in full, for the Minter Admins and everyone following along,
 * top to bottom: what it is and to whom (with k of n), who proposed it and
 * when, the subject's profile (and the nomination behind an invite), the
 * time left to approve, who approved, who rejected and who is considering it
 * in three columns (AnswerColumns) with the tie rule once anyone rejects,
 * then the admin's own answer: Approve and Reject, "You approved ✓" with
 * Reject, or "You rejected" with Approve, each "(confirming…)" until it is
 * in a block, and their own Considering. An admin change says what it does
 * to the target; a decision a waiting admin change would tip over carries a
 * "Target may drop to …" chip. Its public comments sit behind a
 * "Comments (n)" toggle, each Minter Admin's marked with their answer.
 *
 * A double (rules/double.ts) says so with a chip and a note, keeps Approve
 * and Reject as plain secondary buttons, offers no Considering and stays out
 * of Approve several.
 */
import { useId, useState } from 'react';
import { Box, Button, Checkbox, Skeleton, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { READY_LABEL } from '../../constants/words';
import type { ChainNow } from '../../data/chain';
import { effectiveBlocksMinted } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { decisionCommentTarget } from '../../data/commentThread';
import { decisionTitle, isOwnAdminChange, type Decision } from '../../rules/decision';
import { useAccount } from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { PersonChip, PersonInline } from '../../components/common/Person';
import { CommentsSection } from '../../components/comments/CommentsSection';
import { AnswerChip, SigningClock } from '../../components/decision/DecisionParts';
import { AnswerColumns, type AnswerPerson } from '../../components/decision/AnswerColumns';
import {
  ConsideringControls,
  type ConsideringRequest,
} from '../../components/decision/Considering';
import { answerBadges } from '../../components/comments/answerBadges';
import { useConsideringFor } from '../../hooks/useConsidering';
import { useClamped } from '../../hooks/useClamped';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { QortalLinks } from '../../components/common/QortalLinks';
import { decisionPath } from '../../routes/paths';
import { ProgressRing } from '../../components/common/ProgressRing';
import { Card, DecisionPhaseChip } from '../../components/common/Section';
import { primarySoft } from '../../hub-theme';
import { formatBlock, formatCount, formatDate, formatRelative } from '../../utils/format';
import { usePendingAnswers } from '../../writes/optimistic';
import type { DecisionRisk, ShiftScenario } from '../../rules/targetShift';
import { DoubleChip, DoubleNote } from './DoubleParts';
import { doubleLeftOutText } from './doubleUi';
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
  phaseLine,
  type AnswerIntent,
} from './decisionUi';
import { loadStaleInviteDetails, loadStaleInvites, staleDetailsKey } from '../../data/staleInvites';
import { useInView } from '../../hooks/useInView';
import { useQuery } from '../../hooks/useQuery';

/** Phases in which a decision still collects answers (Considering shows then). */
const COLLECTING_PHASES: ReadonlySet<Decision['phase']> = new Set([
  'open',
  'early',
  'unconfirmed',
  'thresholdMet',
  'rejectedMet',
]);

const SENDING_TEXT: Record<AnswerIntent, string> = {
  sign: 'Approving…',
  reject: 'Rejecting…',
  withdraw: 'Rejecting…',
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
  const double = d.double ?? null;
  // Rejected (in a block) and it can still count: they may say they are reconsidering.
  const reconsiderable = signable && view.shown === 'rejected' && view.settled;
  const tally = d.tally;
  const confirming = tally ? tally.inFlight.filter((x) => x.approval) : [];
  const rejecting = tally ? tally.inFlight.filter((x) => !x.approval) : [];
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
  const collecting = COLLECTING_PHASES.has(d.phase);
  const person = (x: { address?: string }) => ({
    address: x.address as string,
    name: x.address && adminNames.has(x.address) ? adminNames.get(x.address) : undefined,
  });
  const approvedPeople: AnswerPerson[] = tally
    ? [
        ...tally.approvals.filter((x) => x.address).map(person),
        ...confirming.filter((x) => x.address).map((x) => ({ ...person(x), confirming: true })),
      ]
    : [];
  const rejectedPeople: AnswerPerson[] = tally
    ? [
        ...tally.rejections
          .filter((x) => x.address)
          .map((x) => ({ ...person(x), hadApproved: x.withdrew })),
        ...rejecting
          .filter((x) => x.address)
          .map((x) => ({
            ...person(x),
            confirming: true,
            hadApproved: tally.approvals.some((a) => a.address === x.address),
          })),
      ]
    : [];
  const consideringPeople: AnswerPerson[] = considering.people.map((p) => ({
    address: p.address,
    name: p.name,
    note: p.note,
  }));
  const answered = approvedPeople.length + rejectedPeople.length + consideringPeople.length > 0;
  const badges = answerBadges(approvedPeople, rejectedPeople, consideringPeople);
  const consider = (mode: ConsideringRequest['mode']) =>
    considering.publishTarget &&
    onConsider?.({
      target: considering.publishTarget,
      mode,
      label: d.subject ? `${title}: ${subject.label}` : title,
      // Only an invite has a nominee who reads it too.
      nominee: d.kind === 'invite',
      again: reconsiderable,
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
        {selecting && signable && view.shown === 'none' && !double ? (
          <Checkbox
            checked={Boolean(selected)}
            onChange={() => onToggleSelect?.(d.signature)}
            slotProps={{ input: { 'aria-label': `Select to approve: ${fullTitle}` } }}
            sx={{ width: 44, height: 44, ml: -1, mt: -0.5, flexShrink: 0 }}
          />
        ) : null}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
              {title}
            </Typography>
            <DecisionPhaseChip phase={d.phase} />
            {double ? <DoubleChip decision={d} double={double} /> : null}
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

      {/* An invite from a nomination says "Nominated by" instead (its first approver is
          in Approved); one proposed directly on chain says who proposed it. */}
      {d.creatorAddress && !(d.kind === 'invite' && nomination?.nomination) ? (
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
          <span title={d.blockHeight ? `Proposed in ${formatBlock(d.blockHeight)}` : undefined}>
            {formatRelative(d.createdAt, now.timestamp)}
          </span>
          .
        </Typography>
      ) : null}

      {risk && labelOf && riskOpen ? (
        <TargetRiskNote
          id={riskId}
          risk={risk}
          labelOf={labelOf}
          advice={canAct}
          withdraw={withdrawable}
        />
      ) : null}

      {double ? (
        <DoubleNote decision={d} double={double} name={subject.label} now={now} advice={canAct} />
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

      {d.window && (d.phase === 'open' || d.phase === 'early') ? (
        <SigningClock now={now} height={d.window.lastUsefulSignatureHeight} detailVisible />
      ) : null}

      {tally && answered ? (
        <AnswerColumns
          approved={approvedPeople}
          rejected={rejectedPeople}
          considering={collecting ? consideringPeople : null}
        />
      ) : tally && collecting ? (
        <Typography variant="body2" color="text.secondary">
          No Minter Admin has answered yet.
        </Typography>
      ) : null}
      {tally && rejectedPeople.length ? (
        <Typography variant="body2" color="text.secondary">
          Rejections: {tally.rejectionCount} of the {tally.needed} that would end it. If approvals
          and rejections both reach {tally.needed}, it passes: Core counts approvals first.
        </Typography>
      ) : null}

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
              // Never on a double.
              canStart={(rejectable || reconsiderable) && !double}
              again={reconsiderable}
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
              You rejected this. Approving replaces your rejection: only your latest answer counts.
            </Typography>
          ) : null}
          {selecting && double && (signable || rejectable) && view.shown === 'none' ? (
            <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
              {doubleLeftOutText({ kind: d.kind, double })}.
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
              aria-label={`Reject: ${fullTitle}`}
              sx={{ minHeight: 44, ml: 'auto', textAlign: 'left' }}
            >
              Reject
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
                  // A double needs no signature: Sign stays, as a secondary button
                  // (never on a removal that is a double: canSign).
                  variant={double ? 'outlined' : 'contained'}
                  onClick={() => onSign?.(d)}
                  aria-label={`Approve: ${fullTitle}`}
                  sx={{ minHeight: 44, minWidth: 96 }}
                >
                  Approve
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
        answers={badges}
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
  if (d.kind === 'cancelInvite' && d.subject) return <CancelInviteDetails invitee={d.subject} />;
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

/**
 * Which invite a cancellation is about: who sent it, when the Minter Admins
 * approved it, and that it was never used (they haven't joined). Read once
 * the card nears the screen: the shared list of stored invites, then that
 * invitee's history for the approval (cached, as in the stale-invite list).
 */
function CancelInviteDetails({ invitee }: { invitee: string }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const list = useQuery(near ? 'staleinvites:list' : null, (force) => loadStaleInvites({ force }));
  const row =
    [...(list.data?.rows ?? []), ...(list.data?.memberRows ?? [])].find(
      (r) => r.invitee === invitee
    ) ?? null;
  const details = useQuery(near && row ? staleDetailsKey([row]) : null, (force) =>
    loadStaleInviteDetails(row ? [row] : [], { force })
  );
  const approved = details.data?.[0];
  const member = Boolean(list.data?.memberRows.some((r) => r.invitee === invitee));
  return (
    <Typography ref={setNode} component="div" variant="body2" color="text.secondary">
      {!list.data ? (
        list.isError ? (
          'Couldn’t read the invite it cancels on your node.'
        ) : (
          'Looking up the invite it cancels…'
        )
      ) : !row ? (
        'There is no stored invite for them any more.'
      ) : (
        <>
          Cancels the invite <PersonInline address={row.inviter} /> sent
          {approved?.approvedAt
            ? `, approved on ${formatDate(approved.approvedAt)}${
                approved.approvedHeight ? ` (${formatBlock(approved.approvedHeight)})` : ''
              }`
            : ''}
          {member ? '. They are in MINTER already.' : '. They never pressed Join.'}
        </>
      )}
    </Typography>
  );
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
  const reasonId = useId();
  const [reasonNode, setReasonNode] = useState<HTMLElement | null>(null);
  const record = n?.nomination;
  const clamped = useClamped(reasonNode, record?.record.reason ?? '');
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
            ref={setReasonNode}
            id={reasonId}
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
          {clamped || expanded ? (
            <Button
              size="small"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={reasonId}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              {expanded ? 'Show less' : 'Show the whole reason'}
            </Button>
          ) : null}
          <QortalLinks links={record.record.links} />
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
