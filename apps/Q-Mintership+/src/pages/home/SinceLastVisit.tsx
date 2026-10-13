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
import { KIND_LABEL, type Decision } from '../../rules/decision';
import type { DecidedEntry, NomineeEvent } from '../../rules/sinceLastVisit';
import type { MyStatus } from '../../rules/status';
import { signerState } from '../../rules/tally';
import { decisionPath, PATHS } from '../../routes/paths';
import { useSession } from '../../state/session';
import { sinceLastVisitAtom } from '../../state/notifications';
import { formatBlock, formatRelative, plural } from '../../utils/format';
import { PersonLink } from './Hero';

/** Rows of each kind before "And N more". */
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
function useDecisionTitle(kind: Decision['kind'], subject: string | null): string {
  const who = useDisplayName(subject ?? '', subject ? undefined : null);
  return `${KIND_LABEL[kind]}: ${subject ? who.label : 'an approved invite'}`;
}

function NewDecisionItem({ decision: d, publicKey }: { decision: Decision; publicKey: string }) {
  const title = useDecisionTitle(d.kind, d.subject);
  const mine = d.tally && publicKey ? signerState(d.tally, publicKey) : 'none';
  const waitsForMe =
    mine === 'none' && d.tally !== null && (d.phase === 'open' || d.phase === 'early');
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
          {KIND_LABEL[entry.kind]}:{' '}
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
  const focusTitle = () =>
    (
      document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('h1')
    )?.focus();

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
              focusTitle();
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
            {admin?.newDecisions.slice(0, TOP).map((d) => (
              <NewDecisionItem key={d.signature} decision={d} publicKey={session.publicKey} />
            ))}
            {admin && admin.newDecisions.length > TOP ? (
              <MoreItem
                Icon={FiberNewOutlinedIcon}
                text={`And ${plural(admin.newDecisions.length - TOP, 'more new decision')}`}
                to={decisionPath()}
                label="See all"
                ariaLabel="See all new decisions"
              />
            ) : null}
            {admin?.newNominations.slice(0, TOP).map((n) => (
              <NewNominationItem key={n.nominee} nomination={n} />
            ))}
            {admin && admin.newNominations.length > TOP ? (
              <MoreItem
                Icon={HowToRegOutlinedIcon}
                text={`And ${plural(admin.newNominations.length - TOP, 'more new nomination')}`}
                to={PATHS.nominations}
                label="See all"
                ariaLabel="See all new nominations"
              />
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
