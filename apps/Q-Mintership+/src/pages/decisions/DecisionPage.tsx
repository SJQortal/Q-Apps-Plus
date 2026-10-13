/**
 * One decision (/decisions/<signature>): its unique, shareable link. While
 * it waits, the Decisions queue's own card (Sign for Minter Admins); once
 * decided, how it ended and who signed. Old /decisions?d=<signature> links
 * land here too (DecisionsPage), and the shell reports the path to Hub, so
 * Hub's own Copy link gives the same link.
 *
 * Reads: the transaction by its signature (data/decisionLink.ts); while it
 * waits, the Decisions queue (shared and cached), the subject's membership
 * and, for an invite, that person's nomination; once decided, its own
 * signatures and the admins' names.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { PersonChip } from '../../components/common/Person';
import { Card, Section, ToneChip } from '../../components/common/Section';
import { CardSkeleton, EmptyState, ErrorState } from '../../components/common/states';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { loadDecisionLink, type DecisionLink } from '../../data/decisionLink';
import { getMembership } from '../../data/group';
import {
  useAdmins,
  useChainNow,
  useDecisions,
  useMembers,
  useNominationsFor,
} from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import { PATHS, decisionPath, nominationPath } from '../../routes/paths';
import {
  decisionKind,
  decisionSubject,
  decisionTitle,
  otherTransactionLabel,
  type Decision,
} from '../../rules/decision';
import { OUTCOME_LABEL } from '../../rules/outcome';
import { useSession } from '../../state/session';
import type { TxRow } from '../../data/types';
import type { Signer } from '../../writes/runner';
import { DecidedCard } from './DecidedCard';
import { DecisionCard, type NominationsState, type SubjectFacts } from './DecisionCard';
import { SignDialog } from './SignDialog';
import { CommentsSection } from '../../components/comments/CommentsSection';
import { commentTarget } from '../../data/commentThread';
import { RejectDialog, type RejectMode } from './RejectDialog';
import type { LabelOf } from './targetShiftUi';
import { impactIn, riskIn, useShift } from './useShift';
import type { ConsideringRequest } from '../../components/decision/Considering';
import { ConsideringDialog } from '../../components/decision/ConsideringDialog';
import { peekQuery } from '../../data/query';
import { signerOf } from '../../state/session';
import { displayName } from '../../utils/format';

/** The section a waiting decision's card sits in (one that ended sits in "Decided"). */
const NOT_DECIDED = 'Not decided yet';

export default function DecisionPage() {
  const { signature: param = '' } = useParams();
  const signature = param.trim();
  const link = useQuery(signature ? `decisionlink:${signature}` : null, (force) =>
    loadDecisionLink(signature, { force })
  );
  const data = link.data;
  const subject = data && data.kind !== 'unknown' ? decisionSubject(data.tx) : null;
  const titleFacts =
    data && data.kind !== 'unknown' && data.kind !== 'other'
      ? { kind: decisionKind(data.tx), subject, creatorAddress: data.tx.creatorAddress ?? null }
      : null;
  const who = useDisplayName(subject ?? '', subject ? undefined : null);
  const { refetch } = link;
  const reread = useCallback(() => void refetch(), [refetch]);

  return (
    <>
      <PageHeader
        title="Decision"
        subtitle={
          titleFacts
            ? `${decisionTitle(titleFacts)}${subject ? `: ${who.label}` : ''}`
            : 'One MINTER decision'
        }
        back={PATHS.decisions}
        actions={
          signature ? <CopyLinkButton path={decisionPath(signature)} what="this decision" /> : null
        }
      />
      <PageBody>
        {!signature ? (
          <Unknown />
        ) : link.isError && !data ? (
          <ErrorState
            title="Couldn’t load this decision."
            error={link.error}
            onRetry={() => void link.refetch()}
          />
        ) : !data ? (
          <CardSkeleton lines={4} ring />
        ) : (
          <LinkView
            link={data}
            signature={signature}
            linkLoadedAt={link.updatedAt}
            reread={reread}
          />
        )}
      </PageBody>
    </>
  );
}

function Unknown() {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="No decision with this signature"
      description="Your node doesn’t know this transaction. The link may be cut short, or the transaction hasn’t reached your node yet."
      actionLabel="All decisions"
      onAction={() => navigate(PATHS.decisions)}
    />
  );
}

function NotShownHere({ tx }: { tx: TxRow }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="This isn’t a MINTER decision"
      description={`It is a transaction of another kind (${otherTransactionLabel(tx).toLowerCase()}), so there is nothing to follow here.`}
      actionLabel="All decisions"
      onAction={() => navigate(PATHS.decisions)}
    />
  );
}

function AdminsOnly() {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="This one is listed for Minter Admins only"
      actionLabel="All decisions"
      onAction={() => navigate(PATHS.decisions)}
    />
  );
}

function LinkView({
  link,
  signature,
  linkLoadedAt,
  reread,
}: {
  link: DecisionLink;
  signature: string;
  linkLoadedAt: number;
  reread: () => void;
}) {
  const session = useSession();
  const admins = useAdmins();
  const chain = useChainNow();
  const viewerIsAdmin = Boolean(
    session.status === 'ready' && admins.data?.admins.some((a) => a.member === session.address)
  );
  if (link.kind === 'unknown') return <Unknown />;
  if (link.kind === 'other') return <NotShownHere tx={link.tx} />;
  if (link.kind === 'unusual') {
    // Listed for Minter Admins only, as in the queue.
    if (!admins.data && admins.isLoading) return <CardSkeleton lines={2} />;
    if (!viewerIsAdmin) return <AdminsOnly />;
    return (
      <Section title={NOT_DECIDED} id="decision-card">
        <UnusualView tx={link.tx} />
      </Section>
    );
  }
  if (link.kind === 'pending')
    return <PendingView tx={link.tx} signature={signature} since={linkLoadedAt} reread={reread} />;
  const adminNames = new Map<string, string | null>(
    (admins.data?.admins ?? []).map((a) => [a.member, a.primaryName ?? null])
  );
  return (
    <>
      <Section title="Decided" id="decision-card">
        {chain.data ? (
          <DecidedCard link={link} now={chain.data} adminNames={adminNames} />
        ) : (
          <CardSkeleton lines={4} />
        )}
      </Section>
      <MoreLinks tx={link.tx} />
      <Section title="Comments" id="decision-comments">
        <CommentsSection
          target={commentTarget('decision', signature, link.tx.timestamp - 60_000)}
          label="this decision"
          defaultOpen
          variant="plain"
        />
      </Section>
    </>
  );
}

function UnusualView({ tx }: { tx: TxRow }) {
  const subject = decisionSubject(tx);
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1, borderColor: 'warning.main' }}>
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {decisionTitle({
          kind: decisionKind(tx),
          subject,
          creatorAddress: tx.creatorAddress ?? null,
        })}
      </Typography>
      {subject ? <PersonChip address={subject} size={32} /> : null}
      <Alert severity="warning" role="note">
        <strong>Unusual approval route.</strong> This one can’t be signed here. Check it with the
        other Minter Admins.
      </Alert>
    </Card>
  );
}

/** Where to go from here: the nomination behind an invite, and the whole queue. */
function MoreLinks({ tx }: { tx: TxRow }) {
  const subject = decisionSubject(tx);
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {tx.type === 'GROUP_INVITE' && subject ? (
        <Button component={RouterLink} to={nominationPath(subject)} sx={{ minHeight: 44 }}>
          The nomination
        </Button>
      ) : null}
      <Button component={RouterLink} to={PATHS.decisions} sx={{ minHeight: 44 }}>
        All decisions
      </Button>
    </Box>
  );
}

/** Still collecting signatures: the queue's own card, live, with Sign for Minter Admins. */
function PendingView({
  tx,
  signature,
  since,
  reread,
}: {
  tx: TxRow;
  signature: string;
  /** When the link was read: a queue read after it that no longer lists it means it was decided. */
  since: number;
  reread: () => void;
}) {
  const session = useSession();
  const queue = useDecisions();
  const subject = decisionSubject(tx);
  const isInvite = tx.type === 'GROUP_INVITE';
  const nominations = useNominationsFor(isInvite ? subject : null);
  const membership = useQuery(subject ? `membership:${subject}` : null, (force) =>
    getMembership(subject as string, { force })
  );
  const [signTarget, setSignTarget] = useState<Decision | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ decision: Decision; mode: RejectMode } | null>(
    null
  );
  const [considerRequest, setConsiderRequest] = useState<ConsideringRequest | null>(null);
  const ready = session.status === 'ready';
  const signer: Signer | null = useMemo(
    () => (ready ? { address: session.address, publicKey: session.publicKey } : null),
    [ready, session.address, session.publicKey]
  );

  const data = queue.data;
  // The member list (the shared, cached read) only matters to a waiting addition.
  const membersQ = useMembers(Boolean(data?.decisions.some((d) => d.kind === 'addAdmin')));
  // An admin change's impact, and the chip on a decision an admin change would tip over.
  const shift = useShift(data, membersQ.data);
  const decision = data?.decisions.find((d) => d.signature === signature) ?? null;
  const gone = Boolean(data && !decision && data.loadedAt > since);
  // The queue no longer lists it: read it again, to show how it ended.
  useEffect(() => {
    if (gone) reread();
  }, [gone, reread]);

  if (!data) {
    if (queue.isError)
      return (
        <ErrorState
          title="Couldn’t load the decisions."
          error={queue.error}
          onRetry={() => void queue.refetch()}
        />
      );
    return <CardSkeleton lines={4} ring />;
  }
  if (!decision)
    return (
      <Section title={NOT_DECIDED} id="decision-card">
        <NotInQueue tx={tx} />
      </Section>
    );

  const isAdmin = Boolean(signer && data.admins.admins.some((a) => a.member === signer.address));
  const adminNames = new Map<string, string | null>(
    data.admins.admins.map((a) => [a.member, a.primaryName ?? null])
  );
  const labelOf: LabelOf = (sig) => {
    const d = data.decisions.find((x) => x.signature === sig);
    if (!d) return 'A waiting decision';
    if (!d.subject) return `${decisionTitle(d)} (Core doesn’t say for whom)`;
    const name = adminNames.get(d.subject) ?? peekQuery<string | null>(`name:${d.subject}`) ?? null;
    return `${decisionTitle(d)}: ${displayName(name, d.subject)}`;
  };
  const list = nominations.data ?? [];
  const nomination = isInvite
    ? (list.find((n) => n.decision?.signature === signature) ??
      list.find((n) => n.state === 'signing') ??
      null)
    : null;
  const nominationsState: NominationsState = !isInvite
    ? 'loaded'
    : nominations.data
      ? 'loaded'
      : nominations.isError
        ? 'error'
        : 'loading';
  const facts: SubjectFacts | null = subject
    ? adminNames.has(subject)
      ? { isMember: true, isAdmin: true, name: adminNames.get(subject) }
      : membership.data
        ? { isMember: membership.data.isMember, isAdmin: membership.data.isAdmin }
        : null
    : null;

  return (
    <>
      <Section title={NOT_DECIDED} id="decision-card">
        <DecisionCard
          decision={decision}
          now={data.now}
          myPublicKey={signer?.publicKey ?? null}
          myAddress={signer?.address ?? null}
          canAct={isAdmin}
          nomination={nomination}
          nominationsState={nominationsState}
          onRetryNominations={() => void nominations.refetch()}
          adminNames={adminNames}
          subjectFacts={facts}
          onSign={setSignTarget}
          onReject={(d) => setRejectTarget({ decision: d, mode: 'reject' })}
          onWithdraw={(d) => setRejectTarget({ decision: d, mode: 'withdraw' })}
          onConsider={setConsiderRequest}
          impact={impactIn(shift, decision)}
          risk={riskIn(shift, decision)}
          labelOf={labelOf}
          copyLink={false}
          commentsOpen
        />
      </Section>
      <MoreLinks tx={tx} />
      <SignDialog
        decision={signTarget}
        signer={signer}
        onClose={() => setSignTarget(null)}
        impact={signTarget ? impactIn(shift, signTarget) : null}
        labelOf={labelOf}
      />
      <RejectDialog
        decision={rejectTarget?.decision ?? null}
        mode={rejectTarget?.mode ?? 'reject'}
        signer={signer}
        onClose={() => setRejectTarget(null)}
      />
      <ConsideringDialog
        request={considerRequest}
        signer={signerOf(session)}
        onClose={() => setConsiderRequest(null)}
      />
    </>
  );
}

/** Waiting, but the node's queue doesn't list it yet (it was sent a moment ago). */
function NotInQueue({ tx }: { tx: TxRow }) {
  const subject = decisionSubject(tx);
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
          {decisionTitle({
            kind: decisionKind(tx),
            subject,
            creatorAddress: tx.creatorAddress ?? null,
          })}
        </Typography>
        <ToneChip size="small" color="primary" label={OUTCOME_LABEL.pending} />
      </Box>
      {subject ? <PersonChip address={subject} size={40} /> : null}
      <Typography variant="body2" color="text.secondary">
        Your node’s queue doesn’t list it yet, so its signatures and clock aren’t shown. It usually
        appears within a minute or two.
      </Typography>
    </Card>
  );
}
