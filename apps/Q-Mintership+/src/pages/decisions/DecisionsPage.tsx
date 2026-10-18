/**
 * Decisions: MINTER's nominations and everything waiting for the Minter
 * Admins, in one place (Simon, 2026-10-17: "merge the Nominations tab into
 * Decisions"), in three tabs (decisionsViews.ts): All Decisions, Nominations
 * (NominationsPanel.tsx) and Ready to mint; then a tab for each kind of
 * decision with something open (Simon, 2026-10-18: Removals, Declines, Bans,
 * New MAs, Remove MAs, Lift ban, Cancel invite, Clean invites, Ask MAs),
 * each All Decisions narrowed to that kind (`?show=<kind>`). A Minter Admin opens on
 * Decisions, everyone else on Nominations; a swipe sideways on a touch
 * screen opens the next or the previous one. The nominee's own nomination
 * sits above the tabs, with Accept or Join now. Propose, in the header (the
 * floating button on phones), starts with Propose nomination; level 5+
 * members who aren't Minter Admins get Propose nomination alone. How
 * nominations ended is in History.
 *
 * The Decisions tab: every transaction waiting for MINTER's approval
 * (invites, kicks, bans, admin changes, cancelled invites and bans), by type
 * (a section per kind of change, with chips that jump to each: the default)
 * or most urgent first (the choice stays on this device), plus the
 * nominations no Minter Admin has approved yet.
 *
 * Minter Admins sign here, one at a time or several in a row, reject, or
 * withdraw their signature (on chain both are a rejection), say they are
 * considering a decision or a waiting nomination (a QDN record), make the first
 * signature on a nomination, propose kicks, bans, admin changes and
 * cancelled invites (each with their own signature), and clean up stale
 * invites. Doing nothing lets a decision expire. Everyone else follows
 * along, comments, and votes Yes or No (advisory, a QDN record) on
 * nominations, removals, bans and new Minter Admins, as on Nominations.
 *
 * The target moves with the admin count (rules/targetShift.ts): an admin
 * change says what it would do to every waiting decision, a decision it
 * would tip over carries a chip, Sign / Propose / Sign several need "I've
 * checked these" before Hub opens when anything would change, and a banner
 * above the tabs says when the target changed since this device last looked.
 *
 * Minter Admins also ask each other advisory questions here (Propose → Ask
 * the Minter Admins) and vote on them under "Minter Admin polls": encrypted
 * to the Minter Admins, and loaded only for them.
 */
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { PATHS, legacyDecisionPath } from '../../routes/paths';
import { appParam } from '../../routes/hubLocation';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import { useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { useAtom, useAtomValue } from 'jotai';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { BOTTOM_NAV_HEIGHT } from '../../components/layout/BottomNav';
import { FabClearance, PageFab } from '../../components/layout/PageFab';
import { useBottomNavShown } from '../../components/layout/useBottomNav';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../hooks/useOverlayPadding';
import { DoneChip } from '../../components/decision/DecisionParts';
import {
  ConsideringControls,
  type ConsideringRequest,
} from '../../components/decision/Considering';
import { ConsideringDialog } from '../../components/decision/ConsideringDialog';
import { useConsideringFor } from '../../hooks/useConsidering';
import { useChangedSinceMount } from '../../hooks/useChangedSinceMount';
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
import { retryPollDecrypts } from '../../data/adminPollKeys';
import type { Nomination } from '../../data/nominations';
import { invalidate, peekQuery } from '../../data/query';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { useDecisions, useMembers, useMyStatus, useNominations } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTopInViewOnSwitch } from '../../hooks/useScrollTopOnNewPage';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useKeyboardOpen, useLandscapeFrame, useShortFrame } from '../../utils/hubFrame';
import { NominationsPanel } from '../nominations/NominationsPanel';
import { OwnNomination } from '../nominations/OwnNomination';
import { ownNominationOf } from '../nominations/ownNominationFacts';
import { useReadyToMint } from '../nominations/useReadyToMint';
import { decisionTitle, type Decision } from '../../rules/decision';
import { hasImpact, isAdminChangeKind, projectShift } from '../../rules/targetShift';
import { approvalsNeeded, describeThreshold } from '../../rules/threshold';
import { signerOf, useSession } from '../../state/session';
import {
  decisionsHideAnsweredAtom,
  decisionsOrderAtom,
  type DecisionsOrder,
} from '../../state/settings';
import {
  decisionGroup,
  decisionGroupId,
  groupDecisions,
  type DecisionGroup,
} from './decisionGroups';
import { SECTION_ICON, sectionAccent, type SectionAccent } from './sectionAccents';
import { focusElement } from '../../utils/focus';
import { displayName, formatCount, plural } from '../../utils/format';
import type { ChainNow } from '../../data/chain';
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
import { DecisionsTabs } from './DecisionsTabs';
import {
  DECISIONS_PANEL_ID,
  DECISIONS_KINDS,
  DECISIONS_VIEWS,
  decisionsKindOf,
  decisionsTabId,
  decisionsViewPath,
  defaultDecisionsView,
  isDecisionKind,
  parseDecisionsKind,
  parseDecisionsView,
  type DecisionsKind,
  type DecisionsView,
} from './decisionsViews';
import { useAdminPolls } from './useAdminPolls';
import { useQuery } from '../../hooks/useQuery';
import { loadStaleInvites } from '../../data/staleInvites';
import { answerView, canReject, canSign, decisionCardId, isWaitingForMe } from './decisionUi';
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

// Minter Admins only: nobody else downloads the polls' code or reads them.
const AdminPollsSection = lazy(() => import('./AdminPollsSection'));
const AskAdminsDialog = lazy(() => import('./AskAdminsDialog'));

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
  const { status, isError: statusFailed } = useMyStatus();
  const decisionsQ = useDecisions();
  const nominationsQ = useNominations();
  const membersQ = useMembers();
  // Ready to mint follows the nominations' reads, with no GETs of its own (useReadyToMint).
  const readyQ = useReadyToMint(nominationsQ.data?.loadedAt);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // A kind's tab: All Decisions narrowed to it (Simon, 2026-10-18).
  const kind: DecisionsKind | null = parseDecisionsKind(appParam(params, 'show'));
  // The tab: `?show=`, else the account's own (Nominations when its status can't be read).
  const view: DecisionsView | null = kind
    ? 'decisions'
    : (parseDecisionsView(appParam(params, 'show')) ??
      (status ? defaultDecisionsView(status.isAdmin) : statusFailed ? 'nominations' : null));
  const tabKey: DecisionsView | DecisionsKind | null = kind ?? view;
  // What a kind's tab keeps of All Decisions: its decisions, or only its section.
  const decisionTab = isDecisionKind(kind);
  const showsDecisions = !kind || decisionTab;
  const ofKind = (d: { kind: string; decline?: unknown }) => !kind || decisionsKindOf(d) === kind;
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const shortFrame = useShortFrame();
  const keyboardOpen = useKeyboardOpen();
  const [hideAnswered, setHideAnswered] = useAtom(decisionsHideAnsweredAtom);
  const [order, setOrder] = useAtom(decisionsOrderAtom);
  const writes = useAtomValue(pendingWritesAtom);
  // Sticky bars sit above the phone's bottom bar while it is on screen.
  const bottomBar = useBottomNavShown();
  const reduced = useReducedMotion();
  const theme = useTheme();
  const accentOf = (key: SectionAccent) => sectionAccent(theme, key);

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
  const [asking, setAsking] = useState(false);
  // What opened Ask: null for Propose's menu, else the polls section's own button.
  const askFrom = useRef<HTMLElement | null>(null);
  const proposeButton = useRef<HTMLButtonElement | null>(null);
  const hideAnsweredSwitch = useRef<HTMLInputElement | null>(null);
  // The decision Sign, Reject or Withdraw was opened on, for where focus goes
  // when the dialog closes (a ref: the dialog's target is already cleared then).
  const answering = useRef<string | null>(null);
  // Its card, or the section when the card is gone ("Hide already voted on").
  const backToQueue = () =>
    (answering.current ? document.getElementById(decisionCardId(answering.current)) : null) ??
    sectionOf('collecting');
  const answer = (decision: Decision, mode: RejectMode | 'sign') => {
    answering.current = decision.signature;
    if (mode === 'sign') setSignTarget(decision);
    else setRejectTarget({ decision, mode });
  };
  // Propose → Clean up stale invites: the section comes into view and takes focus (on the
  // Decisions tab, opened first when another one is on screen), after the menu (or the
  // phone's sheet) has put it back on Propose as it closed.
  const [staleFocus, setStaleFocus] = useState(0);
  const staleFocused = useRef(0);
  useEffect(() => {
    if (staleFocus === staleFocused.current || view !== 'decisions') return;
    const section = sectionOf('stale');
    if (!section) return;
    staleFocused.current = staleFocus;
    document
      .getElementById(STALE_SECTION_ID)
      ?.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    focusElement(section, { preventScroll: true });
  }, [staleFocus, view, reduced]);

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
  // The name a Minter Admin poll is published under.
  const pollAuthor = useMemo(
    () => (signer ? { ...signer, name: session.name } : null),
    [signer, session.name]
  );
  const myKey = signer?.publicKey ?? null;
  const me = signer?.address ?? '';
  // For the Clean invites and Ask MAs tabs' counts: the same reads their sections make.
  const staleList = useQuery(isAdmin ? 'staleinvites:list' : null, (force) =>
    loadStaleInvites({ force })
  );
  const adminPolls = useAdminPolls(isAdmin ? me : null);
  // Propose's menu for Minter Admins (from their status until the queue says so too).
  const adminRole = isAdmin || Boolean(me && status?.isAdmin);
  const canNominate = Boolean(me && status?.canNominate);
  // A support record is published under the account's name.
  const publishName = status?.name ?? session.name ?? null;
  const publishSigner = useMemo(
    () => (signer && publishName ? { ...signer, name: publishName } : null),
    [signer, publishName]
  );
  const own = ownNominationOf(nominationsQ.data, me, status);

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
  const allCollecting = decisions.filter((d) => COLLECTING.has(d.phase));
  // On a kind's tab, only that kind (and nothing on Clean invites or Ask MAs).
  const collecting = allCollecting.filter(ofKind);
  const closed = decisions.filter((d) => !COLLECTING.has(d.phase)).filter(ofKind);
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
  const hiddenNote = hiddenCount ? (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {plural(hiddenCount, 'decision')} you already voted on {hiddenCount === 1 ? 'is' : 'are'}{' '}
        hidden.
      </Typography>
      <Button
        onClick={() => {
          // This button goes with the note: focus to the switch it turned off.
          hideAnsweredSwitch.current?.focus();
          setHideAnswered(false);
        }}
        aria-label="Show them: the decisions you already voted on"
        sx={{ minHeight: 44 }}
      >
        Show them
      </Button>
    </Box>
  ) : null;
  // By type: the shown decisions (Hide already voted on applies), each type in queue order.
  const groups = groupDecisions(shown);
  // In one queue (Most urgent first) each card keeps its kind's colour; By type's sections give it.
  const collectingCard =
    (now: ChainNow, coloured = false) =>
    (d: Decision) => (
      <DecisionCard
        key={d.signature}
        accent={coloured ? accentOf(decisionGroup(d)) : undefined}
        decision={d}
        now={now}
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
        onSign={(decision) => answer(decision, 'sign')}
        onReject={(decision) => answer(decision, 'reject')}
        onWithdraw={(decision) => answer(decision, 'withdraw')}
        impact={impactOf(d)}
        risk={riskOf(d)}
        labelOf={labelOf}
      />
    );

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
  // Approve several belongs to the Decisions tab: another tab ends it.
  // Another tab (a kind of All Decisions too) ends it.
  const [viewShown, setViewShown] = useState(tabKey);
  if (viewShown !== tabKey) {
    setViewShown(tabKey);
    if (selecting) stopSelecting();
  }
  const selectedList = signable.filter((d) => selected.has(d.signature));

  const nameFor = (d: Decision) => {
    if (!d.subject) return null;
    const name =
      nominationFor(d)?.nomineeName ??
      members.get(d.subject)?.primaryName ??
      adminNames.get(d.subject) ??
      peekQuery<string | null>(`name:${d.subject}`) ??
      null;
    return displayName(name, d.subject);
  };
  const labelFor = (d: Decision) => {
    const name = nameFor(d);
    if (!name) return `${decisionTitle(d)} (Core doesn’t say for whom)`;
    return `${decisionTitle(d)}: ${name}`;
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
    // Ready to mint follows the nominations' reads; after a failure it reads again itself.
    if (readyQ.isError) void readyQ.refetch();
    invalidate('staleinvites:');
    // Comment counts and open threads.
    invalidate('comments:');
    // The Minter Admin polls too (read only for admins, so nothing for anyone else),
    // asking Hub again for any it didn't decrypt.
    retryPollDecrypts();
    invalidate('adminpolls:list:');
  };

  const chooseProposal = (choice: ProposeChoice) => {
    if (choice === 'nominate') {
      navigate(PATHS.nominate);
      return;
    }
    if (choice === 'poll') {
      askFrom.current = null;
      setAsking(true);
      return;
    }
    if (choice === 'stale') {
      // Where the section is: All Decisions, or its own tab.
      if (view !== 'decisions' || (kind && kind !== 'cleanInvites'))
        navigate(decisionsViewPath('decisions'), { replace: true });
      setStaleExpanded(true);
      setStaleFocus((n) => n + 1);
      return;
    }
    setPropose({ kind: choice, preset: null });
  };

  const fetching = decisionsQ.fetching || nominationsQ.fetching;

  // The page's main action: Propose (Propose nomination first) for a Minter Admin, Propose
  // nomination for a level 5+ member; on a phone the floating button, out of the way of the
  // keyboard, a short frame and Approve several's bar (not while it opened a proposal: focus
  // comes back to it).
  const proposeNomination = () => navigate(PATHS.nominate);
  const fab = phone && !landscape && (adminRole || canNominate);
  const proposing = Boolean(propose) || asking;
  const fabShown = fab && !selecting && (proposing || (!shortFrame && !keyboardOpen));
  const headerAction = fab ? null : adminRole ? (
    <ProposeMenu onChoose={chooseProposal} buttonRef={proposeButton} nominate={canNominate} />
  ) : canNominate ? (
    <Button
      variant="contained"
      startIcon={<PersonAddAlt1OutlinedIcon />}
      onClick={proposeNomination}
      sx={{ minHeight: 44 }}
    >
      {PROPOSE_NOMINATION}
    </Button>
  ) : null;

  const counts: Partial<Record<DecisionsView, number>> = {
    decisions: data ? allCollecting.length + waiting.length : undefined,
    nominations: nominationsQ.data
      ? nominationsQ.data.open.filter((n) => n.nominee !== me).length
      : undefined,
    ready: readyQ.data?.people.length,
  };
  // Each kind's count: what is open of it. A tab shows while it has some (or is on screen).
  const kindCount = (key: DecisionsKind): number | undefined =>
    key === 'cleanInvites'
      ? staleList.data?.rows.length
      : key === 'askAdmins'
        ? adminPolls.views
          ? adminPolls.views.filter((v) => v.open).length
          : undefined
        : data
          ? allCollecting.filter((d) => decisionsKindOf(d) === key).length
          : undefined;
  const kindTabs = DECISIONS_KINDS.filter(
    (k) => (k.key !== 'cleanInvites' && k.key !== 'askAdmins') || isAdmin
  )
    .map((k) => ({ ...k, count: kindCount(k.key) }))
    .filter((k) => (k.count ?? 0) > 0 || k.key === kind);
  const subtitle =
    view === 'nominations'
      ? 'Who is up for MINTER right now'
      : view === 'ready'
        ? 'Who asked to join MINTER'
        : data
          ? `Each needs ${needed} approvals`
          : 'Everything waiting for the Minter Admins';

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle={subtitle}
        actions={
          <>
            <RefreshButton onClick={refresh} fetching={fetching} />
            {headerAction}
          </>
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>
        {/* There from the start: says once that the target changed (the note below isn't live). */}
        <span role="status" className="qmp-visually-hidden">
          {targetChange ? targetChangedTitle(targetChange.from.needed, targetChange.to.needed) : ''}
        </span>
        {/* Above the tabs: the target counts for nominations as much as for decisions. */}
        {data && targetChange ? (
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

        {own.shown && nominationsQ.data ? (
          <OwnNomination facts={own} data={nominationsQ.data} signer={signer} />
        ) : null}

        <DecisionsTabs view={tabKey} counts={counts} kinds={kindTabs} />
        <ViewPanel view={view} tab={tabKey}>
          {view === null ? (
            <ListSkeleton count={3} ring label="Loading" />
          ) : view !== 'decisions' ? (
            <NominationsPanel
              view={view}
              nominations={nominationsQ}
              ready={readyQ}
              me={me}
              isAdmin={isAdmin}
              canNominate={canNominate}
              publishSigner={publishSigner}
              ownShown={own.shown}
              session={session}
              status={status}
            />
          ) : decisionsQ.isLoading && !data ? (
            <ListSkeleton count={4} ring label="Loading decisions" />
          ) : decisionsQ.isError && !data ? (
            <ErrorState
              title="Couldn’t load the decisions."
              error={decisionsQ.error}
              onRetry={() => void decisionsQ.refetch()}
            />
          ) : data ? (
            <>
              {!showsDecisions ? null : isAdmin ? (
                <Card sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
                    {signable.length
                      ? `${plural(signable.length, 'decision')} waiting for your answer`
                      : 'Nothing waiting for your answer'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Each needs {plural(needed, 'approval')}:{' '}
                    {describeThreshold(data.group.approvalThreshold)}, counting all {totalAdmins}{' '}
                    admin seats. Approve the ones you agree with. Reject the ones you don’t, or let
                    them expire: {plural(needed, 'rejection')} end one as rejected.
                  </Typography>
                  {doubles.length ? (
                    <Typography variant="body2" color="text.secondary">
                      {doublesAsideText(doubles.length)}
                    </Typography>
                  ) : null}
                </Card>
              ) : (
                <Alert severity="info" role="note">
                  Only Minter Admins approve or reject decisions. Here you can follow each one: who
                  proposed it, who has approved or rejected it, and how long is left. Each needs{' '}
                  {needed} Minter Admin approvals. On a nomination, a removal, a ban or a new Minter
                  Admin you can vote Yes or No and comment, so the Minter Admins see how the
                  community feels.
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
                    label="Hide already voted on"
                    sx={{ minHeight: 44, mr: 'auto' }}
                  />
                  {selecting || signable.length > 1 ? (
                    <Button
                      variant={selecting ? 'text' : 'outlined'}
                      onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
                      sx={{ minHeight: 44 }}
                    >
                      {selecting ? 'Cancel selection' : 'Approve several'}
                    </Button>
                  ) : null}
                </Box>
              ) : null}

              {!showsDecisions ||
              collecting.length ||
              (!kind && waiting.length) ||
              closed.length ? null : (
                <EmptyState
                  title={
                    kind
                      ? `No ${(DECISIONS_KINDS.find((k) => k.key === kind)?.label ?? '').toLowerCase()} collecting approvals now`
                      : 'Nothing collecting approvals'
                  }
                  description="New nominations and proposals show up here as soon as they are on chain."
                />
              )}

              {shift && showsDecisions ? (
                <TargetShiftSection
                  scenarios={shift.scenarios}
                  decisions={decisions}
                  now={data.now}
                  labelOf={labelOf}
                  advice={isAdmin}
                />
              ) : null}

              {collecting.length > 1 ? <OrderChoice order={order} onChange={setOrder} /> : null}

              {collecting.length && order === 'type' ? (
                <>
                  <Section
                    title="Collecting approvals"
                    count={collecting.length}
                    accent={accentOf('neutral')}
                    id="collecting"
                  >
                    {groups.length ? <GroupJumps groups={groups} reduced={reduced} /> : null}
                    {hiddenNote}
                  </Section>
                  {groups.map((g) => {
                    const Icon = SECTION_ICON[g.key];
                    return (
                      <Box
                        key={g.key}
                        id={decisionGroupId(g.key)}
                        sx={{ scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)' }}
                      >
                        <Section
                          title={g.label}
                          count={g.decisions.length}
                          accent={accentOf(g.key)}
                          icon={<Icon />}
                          id={`${decisionGroupId(g.key)}-section`}
                        >
                          {g.decisions.map(collectingCard(data.now))}
                        </Section>
                      </Box>
                    );
                  })}
                </>
              ) : collecting.length ? (
                <Section
                  title="Collecting approvals"
                  count={collecting.length}
                  accent={accentOf('neutral')}
                  id="collecting"
                >
                  {shown.map(collectingCard(data.now, true))}
                  {hiddenNote}
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

              {!kind && (waiting.length || nominationsQ.isLoading || nominationsQ.isError) ? (
                <Section
                  title="Waiting for a Minter Admin"
                  count={waiting.length || undefined}
                  accent={accentOf('waiting')}
                  icon={<SECTION_ICON.waiting />}
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
                      Nominated, but no Minter Admin has approved yet. The first approval puts the
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
                            <FirstSignatureAction
                              nomination={n}
                              onStart={() => setFirstTarget(n)}
                            />
                          </>
                        ) : null
                      }
                    />
                  ))}
                </Section>
              ) : null}

              {isAdmin && pollAuthor && (!kind || kind === 'askAdmins') ? (
                <Suspense fallback={<CardSkeleton lines={2} />}>
                  <AdminPollsSection
                    author={pollAuthor}
                    onAsk={(from) => {
                      askFrom.current = from;
                      setAsking(true);
                    }}
                    hideVoted={hideAnswered}
                    onShowVoted={() => {
                      // The note's button goes: focus to the switch it turned off, when shown.
                      hideAnsweredSwitch.current?.focus();
                      setHideAnswered(false);
                    }}
                  />
                </Suspense>
              ) : null}

              {closed.length ? (
                <Section
                  title="Too late to approve"
                  count={closed.length}
                  accent={accentOf('neutral')}
                  id="closed"
                >
                  {closed.map((d) => (
                    <DecisionCard
                      key={d.signature}
                      accent={accentOf(decisionGroup(d))}
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

              {!kind && isAdmin && data.unusual.length ? (
                <Section title="Unusual approval route" accent={accentOf('neutral')} id="unusual">
                  <UnusualList decisions={data.unusual} now={data.now} />
                </Section>
              ) : null}

              {!kind && isAdmin && data.others.length ? (
                <Section
                  title="Other transactions waiting for Minter Admins"
                  accent={accentOf('neutral')}
                  id="others"
                >
                  <OtherPendingList items={data.others} now={data.now} />
                </Section>
              ) : null}

              {isAdmin && signer && (!kind || kind === 'cleanInvites') ? (
                <Box
                  id={STALE_SECTION_ID}
                  sx={{ scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)' }}
                >
                  <Section
                    title="Clean up stale invites"
                    accent={accentOf('cancelInvite')}
                    icon={<SECTION_ICON.cancelInvite />}
                    id="stale"
                  >
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

              {showsDecisions ? (
                <HowSigningWorks
                  group={data.group}
                  now={data.now}
                  needed={needed}
                  totalAdmins={totalAdmins}
                  signers={data.admins.signers.length}
                />
              ) : null}

              {data.truncated ? <TruncatedNote what="the decisions" /> : null}
            </>
          ) : null}
        </ViewPanel>
        {fabShown ? <FabClearance /> : null}
      </PageBody>

      {fabShown ? (
        adminRole ? (
          <ProposeMenu
            fab
            onChoose={chooseProposal}
            buttonRef={proposeButton}
            nominate={canNominate}
          />
        ) : (
          <PageFab
            label={PROPOSE_NOMINATION}
            icon={<PersonAddAlt1OutlinedIcon aria-hidden />}
            onClick={proposeNomination}
          />
        )
      ) : null}

      <SignDialog
        decision={signTarget}
        signer={signer}
        onClose={() => setSignTarget(null)}
        impact={signTarget ? impactOf(signTarget) : null}
        labelOf={labelOf}
        returnFocus={backToQueue}
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
        returnFocus={backToQueue}
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
      {asking && pollAuthor && data ? (
        <Suspense fallback={null}>
          <AskAdminsDialog
            open
            onClose={() => setAsking(false)}
            author={pollAuthor}
            admins={data.admins.signers.length}
            // Back where it was opened: Propose, or the polls section's button (the
            // section itself once a new poll has replaced its empty state, while
            // this page is still here).
            returnFocus={() => {
              const from = askFrom.current;
              if (!from || from.isConnected) return from ?? proposeButton.current;
              const here = proposeButton.current?.isConnected;
              return (here ? sectionOf('admin-polls') : null) ?? proposeButton.current;
            }}
          />
        </Suspense>
      ) : null}
      <BulkDialog
        open={bulkList !== null}
        onClose={() => setBulkList(null)}
        title="Approve several"
        intro={
          <>
            <Typography>
              Approves {plural(bulkList?.length ?? 0, 'decision')}, one after another. Each approval
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
        items={(bulkList ?? []).map((d) => ({
          key: d.signature,
          label: labelFor(d),
          name: nameFor(d),
        }))}
        leftOut={doubles.map((d) => ({
          key: d.signature,
          label: labelFor(d),
          name: nameFor(d),
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

/**
 * The tab's panel, labelled by its tab. On a touch screen a swipe to the
 * left opens the next tab, to the right the previous one (useSwipeTabs),
 * swapping the URL in place as the tabs do; a tab picked from far down the
 * page brings its top into view (useTopInViewOnSwitch).
 */
function ViewPanel({
  view,
  tab,
  children,
}: {
  view: DecisionsView | null;
  /** The tab on screen: the view, or a kind of All Decisions. */
  tab: DecisionsView | DecisionsKind | null;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const touch = useMediaQuery('(pointer: coarse)');
  const index = view ? DECISIONS_VIEWS.findIndex((v) => v.key === view) : -1;
  useSwipeTabs(node, {
    enabled: touch && index >= 0,
    canGo: (step) => index + step >= 0 && index + step < DECISIONS_VIEWS.length,
    go: (step) => navigate(decisionsViewPath(DECISIONS_VIEWS[index + step].key), { replace: true }),
  });
  useTopInViewOnSwitch(PATHS.decisions, tab ?? '', DECISIONS_PANEL_ID);
  return (
    <Box
      ref={setNode}
      role="tabpanel"
      id={DECISIONS_PANEL_ID}
      aria-labelledby={tab ? decisionsTabId(tab) : undefined}
      sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}
    >
      {children}
    </Box>
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
      aria-label="Approve several"
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
        Approve {selected || ''}
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
  const name = displayName(n.nomineeName, n.nominee);
  const label = `Nomination of ${name}`;
  return (
    <ConsideringControls
      mine={mine}
      label={label}
      canStart
      onSet={() => onConsider({ target: publishTarget, mode: 'set', label, name, nominee: true })}
      onClear={() =>
        onConsider({ target: publishTarget, mode: 'clear', label, name, nominee: true })
      }
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
  // The chip pops in when it takes the button's place, not when the page opens with it.
  const pop = useChangedSinceMount(pending?.status === 'confirming');
  if (pending?.status === 'confirming')
    return <DoneChip label="On chain ✓ (confirming…)" settled={false} pop={pop} />;
  return (
    <Button
      variant="contained"
      onClick={onStart}
      disabled={pending?.status === 'sending'}
      aria-label={`First approval: ${displayName(n.nomineeName, n.nominee)}`}
      sx={{ minHeight: 44 }}
    >
      First approval
    </Button>
  );
}

const ORDERS: ReadonlyArray<{ key: DecisionsOrder; label: string }> = [
  { key: 'type', label: 'By type' },
  { key: 'urgency', label: 'Most urgent first' },
];

/** By type (a section each, the default) or most urgent first (one queue): stays on this device. */
function OrderChoice({
  order,
  onChange,
}: {
  order: DecisionsOrder;
  onChange: (order: DecisionsOrder) => void;
}) {
  return (
    <Box
      role="group"
      aria-label="Order the decisions"
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}
    >
      {ORDERS.map((o) => {
        const active = order === o.key;
        return (
          <Chip
            key={o.key}
            clickable
            aria-pressed={active}
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            onClick={() => onChange(o.key)}
            label={o.label}
            sx={{ height: { xs: 44, sm: 40 }, borderRadius: 999, px: 0.5 }}
          />
        );
      })}
    </Box>
  );
}

/**
 * By type: a chip per type with its count and a dot in its section's colour,
 * as an overview of what is waiting; pressing one scrolls to that type's
 * section and puts focus on its first card.
 */
function GroupJumps({
  groups,
  reduced,
}: {
  groups: ReadonlyArray<{ key: DecisionGroup; label: string; decisions: unknown[] }>;
  reduced: boolean;
}) {
  const theme = useTheme();
  const jump = (key: DecisionGroup) => {
    const section = document.getElementById(decisionGroupId(key));
    if (!section) return;
    section.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    section.querySelector<HTMLElement>('article')?.focus({ preventScroll: true });
  };
  return (
    <Box
      component="nav"
      aria-label="Decisions by type"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
    >
      {groups.map((g) => (
        <Chip
          key={g.key}
          clickable
          variant="outlined"
          onClick={() => jump(g.key)}
          // A dot in the section's colour, so the chip and its section match.
          icon={
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: sectionAccent(theme, g.key),
                ml: '10px !important',
              }}
            />
          }
          label={
            <>
              {g.label}{' '}
              <Box component="span" sx={{ ml: 0.25, fontWeight: 700 }}>
                {formatCount(g.decisions.length)}
              </Box>{' '}
              <Box component="span" sx={visuallyHidden}>
                {g.decisions.length === 1 ? 'decision' : 'decisions'}
              </Box>
            </>
          }
          sx={{ height: { xs: 44, sm: 40 }, borderRadius: 999, px: 0.5 }}
        />
      ))}
    </Box>
  );
}
