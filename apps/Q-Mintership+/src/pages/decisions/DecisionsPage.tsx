/**
 * Decisions: every transaction waiting for MINTER's approval (invites,
 * kicks, bans, admin changes, cancelled invites and bans), most urgent
 * first, plus the nominations no Minter Admin has signed yet.
 *
 * Minter Admins sign here, one at a time or several in a row, reject, or
 * withdraw their signature (on chain both are a rejection), say they are
 * considering a decision or a waiting nomination (a QDN record), make the first
 * signature on a nomination, propose kicks, bans, admin changes and
 * cancelled invites (each with their own signature), and clean up stale
 * invites. Doing nothing lets a decision expire. Everyone else follows
 * along read-only.
 *
 * The target moves with the admin count (rules/targetShift.ts): an admin
 * change says what it would do to every waiting decision, a decision it
 * would tip over carries a chip, Sign / Propose / Sign several need "I've
 * checked these" before Hub opens when anything would change, and a banner
 * says when the target changed since this device last looked.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PATHS, legacyDecisionPath } from '../../routes/paths';
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { useAtom, useAtomValue } from 'jotai';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { BOTTOM_NAV_HEIGHT } from '../../components/layout/BottomNav';
import { useBottomNavShown } from '../../components/layout/useBottomNav';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../hooks/useOverlayPadding';
import { DoneChip } from '../../components/decision/DecisionParts';
import {
  ConsideringControls,
  type ConsideringRequest,
} from '../../components/decision/Considering';
import { ConsideringDialog } from '../../components/decision/ConsideringDialog';
import { useConsideringFor } from '../../hooks/useConsidering';
import { NominationCard } from '../../components/nomination/NominationCard';
import { RefreshButton } from '../../components/common/RefreshButton';
import { Card, Section } from '../../components/common/Section';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import type { Nomination } from '../../data/nominations';
import { invalidate, peekQuery } from '../../data/query';
import { useNavHas } from '../../components/layout/useNavHas';
import { useDecisions, useMembers, useNominations } from '../../hooks/useData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { decisionTitle, type Decision } from '../../rules/decision';
import { hasImpact, isAdminChangeKind, projectShift } from '../../rules/targetShift';
import { approvalsNeeded, describeThreshold } from '../../rules/threshold';
import { signerOf, useSession } from '../../state/session';
import { decisionsHideAnsweredAtom } from '../../state/settings';
import { focusElement } from '../../utils/focus';
import { displayName, plural } from '../../utils/format';
import { bulkSign } from '../../writes/flows';
import {
  pendingAnswersIn,
  pendingWritesAtom,
  writeKeys,
  type PendingAnswers,
} from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';
import { BulkDialog } from './BulkDialog';
import { DecisionCard, type NominationsState, type SubjectFacts } from './DecisionCard';
import { answerView, canReject, canSign, isWaitingForMe } from './decisionUi';
import { doubleLeftOutText, doublesAsideText } from './doubleUi';
import { FirstSignatureDialog } from './FirstSignatureDialog';
import { HowSigningWorks } from './HowSigningWorks';
import { ProposeDialog } from './ProposeDialog';
import { ProposeMenu, type ProposeChoice } from './ProposeMenu';
import type { ProposeKind } from './proposeKinds';
import { RejectDialog, type RejectMode } from './RejectDialog';
import { impactIn, riskIn, useShift } from './useShift';
import { SignDialog } from './SignDialog';
import { StaleInvites } from './StaleInvites';
import { OtherPendingList } from './OtherPendingList';
import { UnusualList } from './UnusualList';
import { useSeenTargetChange } from './seenTarget';
import { TargetChangedBanner } from './TargetChangedBanner';
import { targetChangedTitle, type LabelOf } from './targetShiftUi';
import { TargetImpact } from './TargetImpact';
import { TargetShiftSection } from './TargetShiftSection';
import { useAcknowledge } from './useAcknowledge';

const COLLECTING: ReadonlySet<Decision['phase']> = new Set([
  'open',
  'early',
  'thresholdMet',
  'rejectedMet',
  'unconfirmed',
]);

const STALE_SECTION_ID = 'stale-invites';

/** A page section by its Section id, to return focus to. */
function sectionOf(id: string): HTMLElement | null {
  return document.getElementById(`${id}-title`)?.closest('section') ?? null;
}

/** `/decisions`. An old `/decisions?d=<signature>` link opens that decision's own page. */
export default function DecisionsPage() {
  const { search } = useLocation();
  const target = legacyDecisionPath(search);
  if (target) return <Navigate to={target} replace />;
  return <DecisionsQueue />;
}

function DecisionsQueue() {
  const session = useSession();
  const decisionsQ = useDecisions();
  const nominationsQ = useNominations();
  const membersQ = useMembers();
  const [hideAnswered, setHideAnswered] = useAtom(decisionsHideAnsweredAtom);
  const writes = useAtomValue(pendingWritesAtom);
  // Sticky bars sit above the phone's bottom bar while it is on screen.
  const bottomBar = useBottomNavShown();
  const reduced = useReducedMotion();

  const [signTarget, setSignTarget] = useState<Decision | null>(null);
  const [considerRequest, setConsiderRequest] = useState<ConsideringRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    decision: Decision;
    mode: RejectMode;
  } | null>(null);
  const [firstTarget, setFirstTarget] = useState<Nomination | null>(null);
  const [propose, setPropose] = useState<{
    kind: ProposeKind;
    preset: { address: string; name?: string | null } | null;
  } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkList, setBulkList] = useState<Decision[] | null>(null);
  const [staleExpanded, setStaleExpanded] = useState(false);
  const proposeButton = useRef<HTMLButtonElement | null>(null);
  const hideAnsweredSwitch = useRef<HTMLInputElement | null>(null);
  // Propose → Clean up stale invites: the section takes focus, after the menu
  // (or the phone's sheet) has put it back on Propose as it closed.
  const [staleFocus, setStaleFocus] = useState(0);
  useEffect(() => {
    const section = staleFocus ? sectionOf('stale') : null;
    if (section) focusElement(section, { preventScroll: true });
  }, [staleFocus]);

  const data = decisionsQ.data;
  const ready = session.status === 'ready';
  // Stable while the account is the same, so dialogs don't re-run their checks on every render.
  const signer: Signer | null = useMemo(
    () => (ready ? { address: session.address, publicKey: session.publicKey } : null),
    [ready, session.address, session.publicKey]
  );
  const isAdmin = Boolean(
    data && signer && data.admins.admins.some((a) => a.member === signer.address)
  );
  const myKey = signer?.publicKey ?? null;
  const inNav = useNavHas('decisions');

  const needed = data ? approvalsNeeded(data.group.approvalThreshold, data.admins.adminCount) : 0;
  const totalAdmins = data?.admins.adminCount ?? 0;
  const tipHeight = data?.now.height ?? 0;
  const snapshot = useMemo(
    () => (data ? { adminCount: totalAdmins, needed, height: tipHeight } : null),
    [data, needed, totalAdmins, tipHeight]
  );
  const [targetChange, dismissTargetChange] = useSeenTargetChange(snapshot);

  // What waiting admin changes would do to the target (each, and together).
  const shift = useShift(data, membersQ.data);

  const adminNames = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const a of data?.admins.admins ?? []) map.set(a.member, a.primaryName ?? null);
    return map;
  }, [data]);
  const members = useMemo(() => {
    const map = new Map<string, { joined?: number; primaryName?: string }>();
    for (const m of membersQ.data?.members ?? []) map.set(m.member, m);
    return map;
  }, [membersQ.data]);

  const factsFor = (address: string | null): SubjectFacts | null => {
    if (!address) return null;
    if (adminNames.has(address))
      return {
        isMember: true,
        isAdmin: true,
        joined: members.get(address)?.joined,
        name: adminNames.get(address),
      };
    if (!membersQ.data) return null;
    const row = members.get(address);
    return {
      isMember: Boolean(row),
      isAdmin: false,
      joined: row?.joined,
      // Member rows carry the primary name when there is one; others are looked up.
      name: row ? (row.primaryName ?? null) : undefined,
    };
  };

  const nominationFor = (d: Decision): Nomination | null => {
    if (d.kind !== 'invite' || !nominationsQ.data) return null;
    const all = nominationsQ.data.all;
    return (
      all.find((n) => n.decision?.signature === d.signature) ??
      all.find((n) => n.nominee === d.subject && n.state === 'signing') ??
      null
    );
  };

  // Until the nominations are in, an invite is never called record-less.
  const nominationsState: NominationsState = nominationsQ.data
    ? 'loaded'
    : nominationsQ.isError
      ? 'error'
      : 'loading';
  const retryNominations = () => void nominationsQ.refetch();

  const pendingOf = (d: Decision): PendingAnswers => pendingAnswersIn(writes, d.signature);
  const viewOf = (d: Decision) => answerView(d, myKey, pendingOf(d));

  const decisions = data?.decisions ?? [];
  const collecting = decisions.filter((d) => COLLECTING.has(d.phase));
  const closed = decisions.filter((d) => !COLLECTING.has(d.phase));
  // Answered: signed or rejected (a withdrawn signature too), in a block or on its way.
  const answeredByMe = (d: Decision) => isAdmin && viewOf(d).shown !== 'none';
  const shown = isAdmin && hideAnswered ? collecting.filter((d) => !answeredByMe(d)) : collecting;
  const hiddenCount = collecting.length - shown.length;
  // Waiting for this admin: no answer yet (a rejection can still be replaced on its card).
  const signable = isAdmin ? collecting.filter((d) => isWaitingForMe(d, viewOf(d))) : [];
  // Doubles this admin hasn't answered: not waiting for them, and left out of Sign several
  // (a removal that is a double offers Reject only).
  const doubles = isAdmin
    ? collecting.filter((d) => {
        const view = viewOf(d);
        return d.double && (canSign(d, view) || canReject(d, view)) && view.shown === 'none';
      })
    : [];
  const waiting = (nominationsQ.data?.open ?? []).filter((n) => n.state === 'waiting');

  const toggleSelect = (signature: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(signature)) next.delete(signature);
      else next.add(signature);
      return next;
    });
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const selectedList = signable.filter((d) => selected.has(d.signature));

  const labelFor = (d: Decision) => {
    if (!d.subject) return `${decisionTitle(d)} (Core doesn’t say for whom)`;
    const name =
      nominationFor(d)?.nomineeName ??
      members.get(d.subject)?.primaryName ??
      adminNames.get(d.subject) ??
      peekQuery<string | null>(`name:${d.subject}`) ??
      null;
    return `${decisionTitle(d)}: ${displayName(name, d.subject)}`;
  };

  const bySignature = useMemo(
    () => new Map((data?.decisions ?? []).map((d) => [d.signature, d])),
    [data]
  );
  const labelOf: LabelOf = (signature) => {
    const d = bySignature.get(signature);
    return d ? labelFor(d) : 'A waiting decision';
  };
  const impactOf = (d: Decision) => impactIn(shift, d);
  const riskOf = (d: Decision) => riskIn(shift, d);
  const projectImpact = useCallback(
    (kind: ProposeKind, subject: string) =>
      shift && (kind === 'addAdmin' || kind === 'removeAdmin')
        ? projectShift(shift.state, shift.list, [{ kind, subject }])
        : null,
    [shift]
  );

  // Sign several: the admin changes picked, and what they would do together.
  const bulkChanges = useMemo(
    () => (bulkList ?? []).filter((d) => isAdminChangeKind(d.kind)),
    [bulkList]
  );
  const bulkImpact = useMemo(
    () =>
      shift && bulkChanges.length
        ? projectShift(
            shift.state,
            shift.list,
            bulkChanges.map((d) => ({
              signature: d.signature,
              kind: d.kind as 'addAdmin' | 'removeAdmin',
              subject: d.subject,
            })),
            bulkChanges.length > 1 ? 'all' : 'one'
          )
        : null,
    [shift, bulkChanges]
  );
  const bulkMustCheck = hasImpact(bulkImpact);
  const bulkAck = useAcknowledge(
    bulkList && bulkImpact ? bulkList.map((d) => d.signature).join(',') : null
  );

  const refresh = () => {
    void decisionsQ.refetch();
    void nominationsQ.refetch();
    invalidate('staleinvites:');
  };

  const chooseProposal = (choice: ProposeChoice) => {
    if (choice === 'stale') {
      setStaleExpanded(true);
      setStaleFocus((n) => n + 1);
      document
        .getElementById(STALE_SECTION_ID)
        ?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    setPropose({ kind: choice, preset: null });
  };

  const fetching = decisionsQ.fetching || nominationsQ.fetching;

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle={
          data ? `Each needs ${needed} signatures` : 'Everything waiting for the Minter Admins'
        }
        // Only Minter Admins have Decisions in their navigation; others arrive from a link.
        back={inNav ? undefined : PATHS.nominations}
        actions={
          <>
            <RefreshButton onClick={refresh} fetching={fetching} />
            {isAdmin ? <ProposeMenu onChoose={chooseProposal} buttonRef={proposeButton} /> : null}
          </>
        }
      />
      <PageBody>
        {/* There from the start: says once that the target changed (the note below isn't live). */}
        <span role="status" className="qmp-visually-hidden">
          {targetChange ? targetChangedTitle(targetChange.from.needed, targetChange.to.needed) : ''}
        </span>
        {decisionsQ.isLoading && !data ? (
          <ListSkeleton count={4} ring label="Loading decisions" />
        ) : decisionsQ.isError && !data ? (
          <ErrorState
            title="Couldn’t load the decisions."
            error={decisionsQ.error}
            onRetry={() => void decisionsQ.refetch()}
          />
        ) : data ? (
          <>
            {targetChange ? (
              <TargetChangedBanner
                change={targetChange}
                decisions={data.decisions}
                threshold={data.group.approvalThreshold}
                now={data.now}
                maximumBlockDelay={data.group.maximumBlockDelay}
                labelOf={labelOf}
                isAdmin={isAdmin}
                onDismiss={dismissTargetChange}
              />
            ) : null}

            {isAdmin ? (
              <Card sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
                  {signable.length
                    ? `${plural(signable.length, 'decision')} waiting for your signature`
                    : 'Nothing waiting for your signature'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Each needs {plural(needed, 'signature')}:{' '}
                  {describeThreshold(data.group.approvalThreshold)}, counting all {totalAdmins}{' '}
                  admin seats. Sign the ones you agree with. Reject the ones you don’t, or let them
                  expire: {plural(needed, 'rejection')} end one as rejected.
                </Typography>
                {doubles.length ? (
                  <Typography variant="body2" color="text.secondary">
                    {doublesAsideText(doubles.length)}
                  </Typography>
                ) : null}
              </Card>
            ) : (
              <Alert severity="info" role="note">
                Only Minter Admins sign decisions. Here you can follow each one: who proposed it,
                who has signed or rejected it, and how long is left. Each needs {needed} Minter
                Admin signatures.
              </Alert>
            )}

            {isAdmin && collecting.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideAnswered}
                      onChange={(e) => setHideAnswered(e.target.checked)}
                      slotProps={{ input: { ref: hideAnsweredSwitch } }}
                    />
                  }
                  label="Hide what I answered"
                  sx={{ minHeight: 44, mr: 'auto' }}
                />
                {selecting || signable.length > 1 ? (
                  <Button
                    variant={selecting ? 'text' : 'outlined'}
                    onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                    sx={{ minHeight: 44 }}
                  >
                    {selecting ? 'Cancel selection' : 'Sign several'}
                  </Button>
                ) : null}
              </Box>
            ) : null}

            {collecting.length || waiting.length || closed.length ? null : (
              <EmptyState
                title="Nothing waiting for signatures"
                description="New nominations and proposals show up here as soon as they are on chain."
              />
            )}

            {shift ? (
              <TargetShiftSection
                scenarios={shift.scenarios}
                decisions={decisions}
                now={data.now}
                labelOf={labelOf}
                advice={isAdmin}
              />
            ) : null}

            {collecting.length ? (
              <Section title={`Collecting signatures · ${collecting.length}`} id="collecting">
                {shown.map((d) => (
                  <DecisionCard
                    key={d.signature}
                    decision={d}
                    now={data.now}
                    myPublicKey={myKey}
                    myAddress={signer?.address ?? null}
                    canAct={isAdmin}
                    nomination={nominationFor(d)}
                    nominationsState={nominationsState}
                    onRetryNominations={retryNominations}
                    adminNames={adminNames}
                    subjectFacts={factsFor(d.subject)}
                    onConsider={setConsiderRequest}
                    selecting={selecting}
                    selected={selected.has(d.signature)}
                    onToggleSelect={toggleSelect}
                    onSign={setSignTarget}
                    onReject={(decision) => setRejectTarget({ decision, mode: 'reject' })}
                    onWithdraw={(decision) => setRejectTarget({ decision, mode: 'withdraw' })}
                    impact={impactOf(d)}
                    risk={riskOf(d)}
                    labelOf={labelOf}
                  />
                ))}
                {hiddenCount ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {plural(hiddenCount, 'decision')} you answered{' '}
                      {hiddenCount === 1 ? 'is' : 'are'} hidden.
                    </Typography>
                    <Button
                      onClick={() => {
                        // This button goes with the note: focus to the switch it turned off.
                        hideAnsweredSwitch.current?.focus();
                        setHideAnswered(false);
                      }}
                      sx={{ minHeight: 44 }}
                    >
                      Show the ones I answered
                    </Button>
                  </Box>
                ) : null}
              </Section>
            ) : null}

            {selecting ? (
              <SelectionBar
                selected={selectedList.length}
                total={signable.length}
                aboveNav={bottomBar}
                onToggleAll={() =>
                  setSelected(
                    selectedList.length === signable.length
                      ? new Set()
                      : new Set(signable.map((d) => d.signature))
                  )
                }
                onSign={() => setBulkList(selectedList)}
              />
            ) : null}

            {waiting.length || nominationsQ.isLoading || nominationsQ.isError ? (
              <Section
                title={`Waiting for a Minter Admin${waiting.length ? ` · ${waiting.length}` : ''}`}
                id="waiting"
              >
                {nominationsQ.isLoading && !nominationsQ.data ? <CardSkeleton lines={3} /> : null}
                {nominationsQ.isError && !nominationsQ.data ? (
                  <ErrorState
                    compact
                    title="Couldn’t load the nominations."
                    error={nominationsQ.error}
                    onRetry={() => void nominationsQ.refetch()}
                  />
                ) : null}
                {waiting.length ? (
                  <Typography variant="body2" color="text.secondary">
                    Nominated, but no Minter Admin has signed yet. The first signature puts the
                    nomination on chain and starts the clock.
                  </Typography>
                ) : null}
                {waiting.map((n) => (
                  <NominationCard
                    key={n.nominee}
                    nomination={n}
                    now={data.now}
                    compact
                    comments
                    actions={
                      isAdmin ? (
                        <>
                          <WaitingConsidering
                            nomination={n}
                            myAddress={signer?.address ?? null}
                            onConsider={setConsiderRequest}
                          />
                          <FirstSignatureAction nomination={n} onStart={() => setFirstTarget(n)} />
                        </>
                      ) : null
                    }
                  />
                ))}
              </Section>
            ) : null}

            {closed.length ? (
              <Section title={`Too late to sign · ${closed.length}`} id="closed">
                {closed.map((d) => (
                  <DecisionCard
                    key={d.signature}
                    decision={d}
                    now={data.now}
                    myPublicKey={myKey}
                    canAct={isAdmin}
                    nomination={nominationFor(d)}
                    nominationsState={nominationsState}
                    onRetryNominations={retryNominations}
                    adminNames={adminNames}
                    subjectFacts={factsFor(d.subject)}
                    impact={impactOf(d)}
                    risk={riskOf(d)}
                    labelOf={labelOf}
                  />
                ))}
              </Section>
            ) : null}

            {isAdmin && data.unusual.length ? (
              <Section title="Unusual approval route" id="unusual">
                <UnusualList decisions={data.unusual} now={data.now} />
              </Section>
            ) : null}

            {isAdmin && data.others.length ? (
              <Section title="Other transactions waiting for Minter Admins" id="others">
                <OtherPendingList items={data.others} now={data.now} />
              </Section>
            ) : null}

            {isAdmin && signer ? (
              <Box
                id={STALE_SECTION_ID}
                sx={{ scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)' }}
              >
                <Section title="Clean up stale invites" id="stale">
                  <StaleInvites
                    signer={signer}
                    facts={{
                      needed,
                      maximumBlockDelay: data.group.maximumBlockDelay,
                      msPerBlock: data.now.msPerBlock,
                    }}
                    decisions={decisions}
                    now={data.now}
                    adminNames={adminNames}
                    expanded={staleExpanded}
                    onExpandedChange={setStaleExpanded}
                  />
                </Section>
              </Box>
            ) : null}

            <HowSigningWorks
              group={data.group}
              now={data.now}
              needed={needed}
              totalAdmins={totalAdmins}
              signers={data.admins.signers.length}
            />

            {data.truncated ? <TruncatedNote what="the decisions" /> : null}
          </>
        ) : null}
      </PageBody>

      <SignDialog
        decision={signTarget}
        signer={signer}
        onClose={() => setSignTarget(null)}
        impact={signTarget ? impactOf(signTarget) : null}
        labelOf={labelOf}
      />
      <ConsideringDialog
        request={considerRequest}
        signer={signerOf(session)}
        onClose={() => setConsiderRequest(null)}
      />
      <RejectDialog
        decision={rejectTarget?.decision ?? null}
        mode={rejectTarget?.mode ?? 'reject'}
        signer={signer}
        onClose={() => setRejectTarget(null)}
      />
      {data ? (
        <FirstSignatureDialog
          nomination={firstTarget}
          signer={signer}
          facts={{
            needed,
            totalAdmins,
            maximumBlockDelay: data.group.maximumBlockDelay,
            msPerBlock: data.now.msPerBlock,
          }}
          onClose={() => setFirstTarget(null)}
          returnFocus={() => sectionOf('waiting') ?? sectionOf('collecting')}
        />
      ) : null}
      {data ? (
        <ProposeDialog
          kind={propose?.kind ?? null}
          preset={propose?.preset ?? null}
          signer={signer}
          ctx={{
            needed,
            totalAdmins,
            maximumBlockDelay: data.group.maximumBlockDelay,
            msPerBlock: data.now.msPerBlock,
            signers: data.admins.signers,
            projectImpact,
            labelOf,
          }}
          onClose={() => setPropose(null)}
          onSwitch={(kind, person) => setPropose({ kind, preset: person })}
          returnFocus={() => proposeButton.current}
        />
      ) : null}
      <BulkDialog
        open={bulkList !== null}
        onClose={() => setBulkList(null)}
        title="Sign several"
        intro={
          <>
            <Typography>
              Signs {plural(bulkList?.length ?? 0, 'decision')}, one after another. Each signature
              counts once it is in a block.
            </Typography>
            {bulkImpact ? (
              <Box sx={{ mt: 1.5 }}>
                <TargetImpact
                  scenario={bulkImpact}
                  labelOf={labelOf}
                  lead={
                    bulkChanges.length > 1
                      ? `If the ${bulkChanges.length} admin changes you picked pass`
                      : `If ${labelOf(bulkChanges[0].signature)} passes`
                  }
                  ack={bulkMustCheck ? bulkAck : null}
                />
              </Box>
            ) : null}
          </>
        }
        beforeStart={bulkMustCheck ? bulkAck.confirm : undefined}
        action="SIGN_TRANSACTION"
        feeTxType="GROUP_APPROVAL"
        items={(bulkList ?? []).map((d) => ({ key: d.signature, label: labelFor(d) }))}
        leftOut={doubles.map((d) => ({
          key: d.signature,
          label: labelFor(d),
          reason: d.double ? doubleLeftOutText({ kind: d.kind, double: d.double }) : '',
        }))}
        confirmLabel="Continue to Hub"
        run={(report) =>
          signer && bulkList
            ? bulkSign(
                signer,
                bulkList.map((d) => d.signature),
                report
              )
            : Promise.resolve([])
        }
        onFinished={stopSelecting}
        // The "Sign several" bar that opened it is gone once the run is over.
        returnFocus={() => sectionOf('collecting')}
      />
    </>
  );
}

/** The "Sign several" bar: sticky at the bottom, its height kept clear for focus. */
function SelectionBar({
  selected,
  total,
  aboveNav,
  onToggleAll,
  onSign,
}: {
  selected: number;
  total: number;
  /** The phone's bottom bar is on screen: sit above it. */
  aboveNav: boolean;
  onToggleAll: () => void;
  onSign: () => void;
}) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  // Its height plus its gap from the bottom (16 px, or 8 above the bottom bar).
  usePublishOverlay(bar, BOTTOM_BAR_VAR, { gap: aboveNav ? 8 : 16 });
  return (
    <Box
      ref={setBar}
      role="region"
      aria-label="Sign several"
      sx={(theme) => ({
        position: 'sticky',
        bottom: aboveNav ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom) + 8px)` : 16,
        zIndex: theme.zIndex.appBar - 2,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'primary.main',
        bgcolor: 'background.paper',
        boxShadow: theme.shadows[6],
      })}
    >
      <Typography sx={{ fontWeight: 600, mr: 'auto' }} role="status">
        {selected} of {total} selected
      </Typography>
      <Button onClick={onToggleAll} sx={{ minHeight: 44 }}>
        {selected === total ? 'Clear' : 'Select all'}
      </Button>
      <Button variant="contained" disabled={!selected} onClick={onSign} sx={{ minHeight: 44 }}>
        Sign {selected || ''}
      </Button>
    </Box>
  );
}

/** An admin's Considering on a nomination still waiting for its first signature. */
function WaitingConsidering({
  nomination: n,
  myAddress,
  onConsider,
}: {
  nomination: Nomination;
  myAddress: string | null;
  onConsider: (request: ConsideringRequest) => void;
}) {
  const { mine, publishTarget } = useConsideringFor(
    { nomineeAddress: n.nominee, since: n.publishedAt },
    null,
    { myAddress }
  );
  if (!mine || !publishTarget) return null;
  const label = `Nomination of ${displayName(n.nomineeName, n.nominee)}`;
  return (
    <ConsideringControls
      mine={mine}
      label={label}
      canStart
      onSet={() => onConsider({ target: publishTarget, mode: 'set', label, nominee: true })}
      onClear={() => onConsider({ target: publishTarget, mode: 'clear', label, nominee: true })}
    />
  );
}

function FirstSignatureAction({
  nomination: n,
  onStart,
}: {
  nomination: Nomination;
  onStart: () => void;
}) {
  const writes = useAtomValue(pendingWritesAtom);
  const pending = writes[writeKeys.invite(n.nominee)];
  if (pending?.status === 'confirming')
    return <DoneChip label="On chain ✓ (confirming…)" settled={false} />;
  return (
    <Button
      variant="contained"
      onClick={onStart}
      disabled={pending?.status === 'sending'}
      aria-label={`First signature: ${displayName(n.nomineeName, n.nominee)}`}
      sx={{ minHeight: 44 }}
    >
      First signature
    </Button>
  );
}
