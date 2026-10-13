/**
 * Home's "Since your last visit": a compact list of what changed for the
 * signed-in account since this device last showed the app (new decisions
 * and decided ones for Minter Admins, the nomination's progress for a
 * nominee, "You're in" from the welcome). "Mark as seen" clears it; it
 * comes back when something else changes. Settings → Notifications can
 * turn it off.
 *
 * A heading, a list, and one polite sentence read out once a session.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography, keyframes } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import CelebrationOutlinedIcon from '@mui/icons-material/CelebrationOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import FiberNewOutlinedIcon from '@mui/icons-material/FiberNewOutlined';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useAtomValue } from 'jotai';
import { Card, Section } from '../../components/common/Section';
import type { Nomination } from '../../data/nominations';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useAnnounceOnce, useSinceLastVisit } from '../../hooks/useLastVisit';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { decisionTitle, type Decision } from '../../rules/decision';
import type { DecidedEntry, NomineeEvent } from '../../rules/sinceLastVisit';
import type { MyStatus } from '../../rules/status';
import { signerState } from '../../rules/tally';
import { decisionPath, PATHS } from '../../routes/paths';
import { useSession } from '../../state/session';
import { sinceLastVisitAtom } from '../../state/notifications';
import { formatBlock, formatRelative, plural } from '../../utils/format';
import { PersonLink } from './Hero';
import { focusPageTitle } from '../../components/layout/pageFocus';

/** Decided rows before "And N more". */
const TOP = 3;

const appear = keyframes`
  from { opacity: 0; transform: translate3d(0, 4px, 0); }
  to { opacity: 1; transform: none; }
`;

type Tone = 'primary' | 'success' | 'error' | 'neutral';

function Item({
  Icon,
  tone,
  title,
  children,
  action,
}: {
  Icon: SvgIconComponent;
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        py: 1,
        '& + li': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <Icon
        aria-hidden
        sx={{
          mt: '2px',
          fontSize: 22,
          color: tone === 'neutral' ? 'text.secondary' : `${tone}.main`,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{title}</Typography>
        {children ? (
          <Typography
            component="div"
            variant="body2"
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {children}
          </Typography>
        ) : null}
      </Box>
      {action ? (
        <Box sx={{ flexShrink: 0, '& .MuiButton-root': { minHeight: 44 } }}>{action}</Box>
      ) : null}
    </Box>
  );
}

/** "Remove from MINTER: Kai Target". */
function useDecisionTitle(facts: Pick<Decision, 'kind' | 'subject' | 'creatorAddress'>): string {
  const who = useDisplayName(facts.subject ?? '', facts.subject ? undefined : null);
  return `${decisionTitle(facts)}: ${facts.subject ? who.label : 'an approved invite'}`;
}

/** Open, and not signed (or rejected) by this admin yet. */
function waitsFor(d: Decision, publicKey: string): boolean {
  if (!d.tally || !(d.phase === 'open' || d.phase === 'early')) return false;
  return !publicKey || signerState(d.tally, publicKey) === 'none';
}

/** A decision's title inside a sentence. */
function DecisionTitle({ decision: d }: { decision: Decision }) {
  return <>{useDecisionTitle(d)}</>;
}

/** "Ban from MINTER: Ben Target; Add to MINTER: bob+builder, and 5 more". */
function DecisionNames({ decisions }: { decisions: Decision[] }) {
  const shown = decisions.slice(0, 2);
  return (
    <>
      {shown.map((d, i) => (
        <span key={d.signature}>
          {i > 0 ? '; ' : ''}
          <DecisionTitle decision={d} />
        </span>
      ))}
      {decisions.length > shown.length ? `, and ${decisions.length - shown.length} more` : ''}
    </>
  );
}

/**
 * New decisions: one row with the decision when there is one, else a count
 * and the first names (the Home list below already shows the urgent ones).
 */
function NewDecisionsItem({ decisions, publicKey }: { decisions: Decision[]; publicKey: string }) {
  if (decisions.length === 1) {
    return <NewDecisionItem decision={decisions[0]} publicKey={publicKey} />;
  }
  const waiting = decisions.filter((d) => waitsFor(d, publicKey)).length;
  return (
    <Item
      Icon={FiberNewOutlinedIcon}
      tone="primary"
      title={plural(decisions.length, 'new decision')}
      action={
        <Button component={RouterLink} to={decisionPath()} aria-label="Review the new decisions">
          Review
        </Button>
      }
    >
      <DecisionNames decisions={decisions} />.
      {waiting ? ` ${plural(waiting, 'is', 'are')} waiting for your signature.` : ''}
    </Item>
  );
}

function NewDecisionItem({ decision: d, publicKey }: { decision: Decision; publicKey: string }) {
  const title = useDecisionTitle(d);
  const waitsForMe = waitsFor(d, publicKey);
  return (
    <Item
      Icon={FiberNewOutlinedIcon}
      tone="primary"
      title={title}
      action={
        <Button component={RouterLink} to={decisionPath(d.signature)} aria-label={`Open: ${title}`}>
          Open
        </Button>
      }
    >
      New
      {d.tally
        ? ` · ${d.tally.approvalCount} of ${d.tally.needed} signatures`
        : ' · waiting for a block'}
      {waitsForMe ? ' · waiting for your signature' : ''}
    </Item>
  );
}

function NewNominationItem({ nomination: n }: { nomination: Nomination }) {
  const shown = useDisplayName(n.nominee, n.nomineeName ?? undefined);
  const by = n.nomination?.publisher ?? null;
  return (
    <Item
      Icon={HowToRegOutlinedIcon}
      tone="primary"
      title={`New nomination: ${shown.label}`}
      action={
        <Button
          component={RouterLink}
          to={decisionPath()}
          aria-label={`Review the nomination of ${shown.label}`}
        >
          Review
        </Button>
      }
    >
      {by ? `Nominated by ${by.name} ${formatRelative(n.publishedAt)}` : 'Nominated'} · waiting for
      a first signature
    </Item>
  );
}

function NomineeName({ nomination: n }: { nomination: Nomination }) {
  return <>{useDisplayName(n.nominee, n.nomineeName ?? undefined).label}</>;
}

/** New nominations: the one, or a count and the first names. */
function NewNominationsItem({ nominations }: { nominations: Nomination[] }) {
  if (nominations.length === 1) return <NewNominationItem nomination={nominations[0]} />;
  const shown = nominations.slice(0, 2);
  return (
    <Item
      Icon={HowToRegOutlinedIcon}
      tone="primary"
      title={plural(nominations.length, 'new nomination')}
      action={
        <Button component={RouterLink} to={decisionPath()} aria-label="Review the new nominations">
          Review
        </Button>
      }
    >
      {shown.map((n, i) => (
        <span key={n.nominee}>
          {i > 0 ? ', ' : ''}
          <NomineeName nomination={n} />
        </span>
      ))}
      {nominations.length > shown.length ? `, and ${nominations.length - shown.length} more` : ''} ·
      waiting for a first signature
    </Item>
  );
}

const OUTCOME: Record<
  DecidedEntry['outcome'],
  { Icon: SvgIconComponent; tone: Tone; words: string }
> = {
  approved: { Icon: CheckCircleOutlineOutlinedIcon, tone: 'success', words: 'Approved' },
  rejected: { Icon: HighlightOffOutlinedIcon, tone: 'error', words: 'Rejected by Minter Admins' },
  expired: {
    Icon: ScheduleOutlinedIcon,
    tone: 'neutral',
    words: 'Expired without enough signatures',
  },
};

function DecidedItem({ entry }: { entry: DecidedEntry }) {
  const outcome = OUTCOME[entry.outcome];
  return (
    <Item
      Icon={outcome.Icon}
      tone={outcome.tone}
      title={
        <>
          {decisionTitle(entry)}:{' '}
          {entry.subject ? <PersonLink address={entry.subject} /> : 'an approved invite'}
        </>
      }
    >
      {outcome.words}
      {entry.height ? ` in ${formatBlock(entry.height)}` : ''}
    </Item>
  );
}

function MoreItem({
  Icon,
  text,
  to,
  label,
  ariaLabel,
}: {
  Icon: SvgIconComponent;
  text: string;
  to: string;
  label: string;
  /** The button's full name (several "See all" sit on one page). */
  ariaLabel: string;
}) {
  return (
    <Item
      Icon={Icon}
      tone="neutral"
      title={text}
      action={
        <Button component={RouterLink} to={to} aria-label={ariaLabel}>
          {label}
        </Button>
      }
    />
  );
}

function signaturesLine(signed: number, needed: number | null): string {
  return needed ? `${signed} of ${needed} signatures` : plural(signed, 'signature');
}

function NomineeItem({ event: e }: { event: NomineeEvent }) {
  switch (e.kind) {
    case 'nominated': {
      const n = e.nomination;
      const by = n.nomination?.publisher ?? null;
      const proposer = by ? null : (n.decision?.creatorAddress ?? null);
      const tally = n.decision?.tally ?? null;
      return (
        <Item Icon={HowToRegOutlinedIcon} tone="primary" title="You've been nominated">
          {by ? (
            <>
              By <PersonLink address={by.address} name={by.name} /> {formatRelative(n.publishedAt)}
            </>
          ) : proposer ? (
            <>
              Minter Admin <PersonLink address={proposer} /> proposed you on chain
            </>
          ) : (
            'A nomination for you is open'
          )}
          {tally ? ` · ${signaturesLine(tally.approvalCount, tally.needed)} so far` : ''}.
        </Item>
      );
    }
    case 'firstSignature':
      return (
        <Item Icon={DrawOutlinedIcon} tone="primary" title="A Minter Admin signed first">
          The clock has started: {signaturesLine(e.signed, e.needed)} so far.
        </Item>
      );
    case 'signatures':
      return (
        <Item Icon={DrawOutlinedIcon} tone="primary" title={plural(e.added, 'new signature')}>
          Your nomination has {signaturesLine(e.signed, e.needed)} now.
        </Item>
      );
    case 'support':
      return (
        <Item Icon={GroupAddOutlinedIcon} tone="primary" title={plural(e.added, 'new supporter')}>
          {e.added === 1
            ? 'Another member added their support to your nomination.'
            : `${e.added} more members added their support to your nomination.`}
        </Item>
      );
    case 'approved':
      return (
        <Item
          Icon={CheckCircleOutlineOutlinedIcon}
          tone="success"
          title="Your nomination was approved"
        >
          One step left: press Join now.
        </Item>
      );
    case 'expired':
      return (
        <Item Icon={ScheduleOutlinedIcon} tone="neutral" title="Your nomination expired">
          {e.signed > 0 ? `It had ${signaturesLine(e.signed, e.needed)} at your last visit. ` : ''}
          You can be nominated again.
        </Item>
      );
    case 'rejected':
      return (
        <Item Icon={HighlightOffOutlinedIcon} tone="error" title="Your nomination was rejected">
          Enough Minter Admins rejected it. You can be nominated again later.
        </Item>
      );
    case 'lapsed':
      return (
        <Item
          Icon={HourglassEmptyOutlinedIcon}
          tone="neutral"
          title="No Minter Admin signed in time"
        >
          Your nomination waited its full window without a first signature and closed. You can be
          nominated again.
        </Item>
      );
  }
}

export function SinceLastVisit({ status, welcome }: { status: MyStatus; welcome: boolean }) {
  const on = useAtomValue(sinceLastVisitAtom);
  const session = useSession();
  const since = useSinceLastVisit(on ? status : undefined, welcome);
  const announcement = useAnnounceOnce(since);
  const reduced = useReducedMotion();
  if (!on || !since.visible) return null;

  const { joined, admin, nominee } = since.changes;

  return (
    <Box sx={{ animation: reduced ? 'none' : `${appear} 200ms ease-out both` }}>
      <Section
        title="Since your last visit"
        id="home-since"
        action={
          <Button
            onClick={() => {
              since.markSeen();
              // The panel goes away with the button: keep focus on the page.
              focusPageTitle();
            }}
            sx={{ minHeight: 44 }}
          >
            Mark as seen
          </Button>
        }
      >
        <Card sx={{ py: 1 }}>
          {since.since ? (
            <Typography variant="body2" color="text.secondary" sx={{ pt: 0.5 }}>
              Your last visit on this device was {formatRelative(since.since)}.
            </Typography>
          ) : null}
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {joined ? (
              <Item Icon={CelebrationOutlinedIcon} tone="success" title="You're in">
                You&rsquo;re a MINTER member now.
              </Item>
            ) : null}
            {nominee.map((e) => (
              <NomineeItem key={e.kind} event={e} />
            ))}
            {admin?.newDecisions.length ? (
              <NewDecisionsItem decisions={admin.newDecisions} publicKey={session.publicKey} />
            ) : null}
            {admin?.newNominations.length ? (
              <NewNominationsItem nominations={admin.newNominations} />
            ) : null}
            {admin?.decided.slice(0, TOP).map((entry) => (
              <DecidedItem key={entry.signature} entry={entry} />
            ))}
            {admin && admin.decided.length > TOP ? (
              <MoreItem
                Icon={ScheduleOutlinedIcon}
                text={`And ${admin.decided.length - TOP} more decided`}
                to={PATHS.history}
                label="History"
                ariaLabel="See the decided ones in History"
              />
            ) : null}
          </Box>
          <Typography component="span" role="status" className="qmp-visually-hidden">
            {announcement}
          </Typography>
        </Card>
      </Section>
    </Box>
  );
}
