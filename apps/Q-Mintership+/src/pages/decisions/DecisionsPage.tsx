/**
 * Decisions: every transaction waiting for MINTER's approval (invites,
 * kicks, bans, admin changes, cancelled invites and bans), most urgent
 * first, plus the nominations no Minter Admin has signed yet.
 *
 * Minter Admins sign here; everyone else follows along read-only. There is
 * no reject or withdraw: an admin signs or lets it expire.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
  keyframes,
} from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useAtom, useAtomValue } from 'jotai';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { NominationCard } from '../../components/nomination/NominationCard';
import { Card, Section } from '../../components/common/Section';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { STORAGE_PREFIX } from '../../constants/plus';
import type { Nomination } from '../../data/nominations';
import { useDecisions, useMembers, useNominations } from '../../hooks/useData';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { Decision } from '../../rules/decision';
import { approvalsNeeded } from '../../rules/threshold';
import { useSession } from '../../state/session';
import { decisionsHideSignedAtom } from '../../state/settings';
import { plural } from '../../utils/format';
import { pendingWritesAtom, writeKeys, type PendingWrite } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';
import { DecisionCard, type SubjectFacts } from './DecisionCard';
import { canSign, decisionCardId, isSignedByMe, myAnswer } from './decisionUi';
import { HowSigningWorks } from './HowSigningWorks';
import { SignDialog } from './SignDialog';
import { UnusualList } from './UnusualList';

const COLLECTING: ReadonlySet<Decision['phase']> = new Set([
  'open',
  'early',
  'thresholdMet',
  'unconfirmed',
]);

const PENDING_MAX_AGE_MS = 15 * 60_000;
const TARGET_KEY = `${STORAGE_PREFIX}decisions-last-target`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

interface TargetSnapshot {
  needed: number;
  totalAdmins: number;
}

function readTarget(): TargetSnapshot | null {
  try {
    const raw = window.localStorage.getItem(TARGET_KEY);
    const value = raw ? (JSON.parse(raw) as TargetSnapshot) : null;
    return value && typeof value.needed === 'number' && typeof value.totalAdmins === 'number'
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeTarget(value: TargetSnapshot): void {
  try {
    window.localStorage.setItem(TARGET_KEY, JSON.stringify(value));
  } catch {
    // A private window: the note just won't appear next time.
  }
}

/** The target the viewer saw last time, when it has changed since (shown once per visit). */
function useTargetChange(current: TargetSnapshot | null): TargetSnapshot | null {
  const [previous] = useState(readTarget);
  useEffect(() => {
    if (current) writeTarget(current);
  }, [current]);
  if (!previous || !current) return null;
  return previous.needed !== current.needed || previous.totalAdmins !== current.totalAdmins
    ? previous
    : null;
}

export default function DecisionsPage() {
  const session = useSession();
  const decisionsQ = useDecisions();
  const nominationsQ = useNominations();
  const membersQ = useMembers();
  const [hideSigned, setHideSigned] = useAtom(decisionsHideSignedAtom);
  const writes = useAtomValue(pendingWritesAtom);
  const [params] = useSearchParams();
  const target = params.get('d');
  const reduced = useReducedMotion();

  const [signTarget, setSignTarget] = useState<Decision | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [handledTarget, setHandledTarget] = useState<string | null>(null);

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

  const needed = data ? approvalsNeeded(data.group.approvalThreshold, data.admins.adminCount) : 0;
  const totalAdmins = data?.admins.adminCount ?? 0;
  const snapshot = useMemo(
    () => (data ? { needed, totalAdmins } : null),
    [data, needed, totalAdmins]
  );
  const targetChange = useTargetChange(snapshot);

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

  const pendingOf = (d: Decision): PendingWrite | null => {
    const entry = writes[writeKeys.sign(d.signature)];
    return entry && Date.now() - entry.at <= PENDING_MAX_AGE_MS ? entry : null;
  };

  const decisions = data?.decisions ?? [];
  const collecting = decisions.filter((d) => COLLECTING.has(d.phase));
  const closed = decisions.filter((d) => !COLLECTING.has(d.phase));
  const signedByMe = (d: Decision) => isAdmin && isSignedByMe(myAnswer(d, myKey), pendingOf(d));
  const shown =
    isAdmin && hideSigned
      ? collecting.filter((d) => !signedByMe(d) || d.signature === target)
      : collecting;
  const hiddenCount = collecting.length - shown.length;
  const signable = isAdmin
    ? collecting.filter((d) => canSign(d, myAnswer(d, myKey), pendingOf(d)))
    : [];
  const waiting = (nominationsQ.data?.open ?? []).filter((n) => n.state === 'waiting');
  const targetKnown =
    !target ||
    !data ||
    decisions.some((d) => d.signature === target) ||
    (isAdmin && data.unusual.some((d) => d.signature === target));

  // ?d=<signature>: scroll to that decision once, and light it up for a moment.
  useEffect(() => {
    if (!target || !data || handledTarget === target) return;
    const el = document.getElementById(decisionCardId(target));
    setHandledTarget(target);
    if (!el) return;
    el.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el.focus?.({ preventScroll: true });
    setHighlight(target);
  }, [target, data, handledTarget, reduced]);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(timer);
  }, [highlight]);

  const refresh = () => {
    void decisionsQ.refetch();
    void nominationsQ.refetch();
  };

  const fetching = decisionsQ.fetching || nominationsQ.fetching;

  return (
    <>
      <PageHeader
        title="Decisions"
        subtitle={
          data
            ? `Needs ${needed} of ${totalAdmins} admins`
            : 'Everything waiting for the Minter Admins'
        }
        actions={
          <>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  aria-label="Refresh"
                  onClick={refresh}
                  disabled={fetching}
                  sx={{ width: 44, height: 44 }}
                >
                  <RefreshOutlinedIcon
                    sx={fetching ? { animation: `${spin} 1s linear infinite` } : undefined}
                  />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      <PageBody>
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
            {!targetKnown ? (
              <Alert severity="info" role="status">
                That decision isn’t waiting any more: it was applied, or it expired. Its outcome is
                in History.
              </Alert>
            ) : null}
            {targetChange ? (
              <Alert severity="info" role="status">
                The target changed from {targetChange.needed} to {needed} signatures: MINTER now has{' '}
                {totalAdmins} admins (it had {targetChange.totalAdmins}). It is{' '}
                {data.group.approvalThreshold.replace('PCT', '')}% of all admins, recounted every
                block.
              </Alert>
            ) : null}

            {isAdmin ? (
              <Card sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18 }}>
                  {signable.length
                    ? `${plural(signable.length, 'decision')} waiting for your signature`
                    : 'Nothing waiting for your signature'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Each needs {needed} of {totalAdmins} Minter Admins. Sign the ones you agree with;
                  the rest expire by themselves.
                </Typography>
              </Card>
            ) : (
              <Alert severity="info" role="note">
                Only Minter Admins sign decisions. Here you can follow each one: who proposed it,
                who has signed, and how long is left. Each needs {needed} of {totalAdmins} Minter
                Admins.
              </Alert>
            )}

            {isAdmin && collecting.length ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideSigned}
                      onChange={(e) => setHideSigned(e.target.checked)}
                    />
                  }
                  label="Hide what I signed"
                  sx={{ minHeight: 44, mr: 'auto' }}
                />
              </Box>
            ) : null}

            {collecting.length || waiting.length || closed.length ? null : (
              <EmptyState
                title="Nothing waiting for signatures"
                description="New nominations and proposals show up here as soon as they are on chain."
              />
            )}

            {collecting.length ? (
              <Section title={`Collecting signatures · ${collecting.length}`} id="collecting">
                {shown.map((d) => (
                  <DecisionCard
                    key={d.signature}
                    decision={d}
                    now={data.now}
                    myPublicKey={myKey}
                    canAct={isAdmin}
                    nomination={nominationFor(d)}
                    adminNames={adminNames}
                    subjectFacts={factsFor(d.subject)}
                    onSign={setSignTarget}
                    highlighted={highlight === d.signature}
                  />
                ))}
                {hiddenCount ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {plural(hiddenCount, 'decision')} you signed{' '}
                      {hiddenCount === 1 ? 'is' : 'are'} hidden.
                    </Typography>
                    <Button onClick={() => setHideSigned(false)} sx={{ minHeight: 44 }}>
                      Show the ones I signed
                    </Button>
                  </Box>
                ) : null}
              </Section>
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
                  <NominationCard key={n.nominee} nomination={n} now={data.now} compact />
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
                    adminNames={adminNames}
                    subjectFacts={factsFor(d.subject)}
                    highlighted={highlight === d.signature}
                  />
                ))}
              </Section>
            ) : null}

            {isAdmin && data.unusual.length ? (
              <Section title="Unusual approval route" id="unusual">
                <UnusualList decisions={data.unusual} now={data.now} />
              </Section>
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

      <SignDialog decision={signTarget} signer={signer} onClose={() => setSignTarget(null)} />
    </>
  );
}
