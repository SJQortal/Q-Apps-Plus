/**
 * Settings → Notifications: Home's "Since your last visit" (on by default,
 * kept in this browser) and Hub alerts (off until you turn them on; Hub
 * keeps them for your account: qortal/hubAlerts.ts), for each role and for
 * replies to your comments (anyone with a registered name). While alerts are
 * on, a nominator's support alerts are brought in step with their open
 * nominations here, without a Hub dialog.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Box, Button, Switch, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAtom } from 'jotai';
import { Section } from '../../components/common/Section';
import { focusPageTitle } from '../../components/layout/pageFocus';
import { useMyStatus } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { loadNominations } from '../../data/nominations';
import { getQueryState } from '../../data/query';
import { hasQortalRequest } from '../../qortal/client';
import {
  MAX_SUPPORT_ALERTS,
  SUPPORTED_YOURS_PREFIX,
  alertRole,
  alertRules,
  getHubActions,
  getHubAlertIds,
  makesNominations,
  replyAlertRules,
  rulesMatch,
  supportAlertNominees,
  supportsHubAlerts,
  syncHubAlerts,
  turnOffHubAlerts,
  turnOnHubAlerts,
  type AlertRole,
} from '../../qortal/hubAlerts';
import { useSession } from '../../state/session';
import { sinceLastVisitAtom } from '../../state/notifications';
import { plural } from '../../utils/format';
import { friendlyError } from '../../utils/friendlyError';
import { isHubDecline, isHubTimeout } from '../../utils/hubErrors';
import { readable } from '../../utils/readable';

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

/** The whole row turns its switch on and off (the switch alone is under 44 px). */
const Row = styled('label')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  cursor: 'pointer',
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled('span')({ display: 'block', flex: 1, minWidth: 0 });

/** Text inside a row (a label holds no paragraphs). */
const LINE = { component: 'span', sx: { display: 'block' } } as const;

/** What Hub tells each role about, before the replies. */
const ROLE_EVENTS: Record<Exclude<AlertRole, 'none'>, string> = {
  admin:
    'when a new nomination is published, when someone adds their support to a nomination you made',
  nominator: 'when someone adds their support to a nomination you made',
  nominee: 'when someone nominates you or adds their support',
};

const ALERTS_TAIL = 'even when this app is closed. Hub asks you once to allow it. No fee.';

/**
 * What the Hub alerts switch says for a role; `named`: the account has a
 * registered name to comment under, so replies to its comments count too.
 */
function roleHint(role: AlertRole, named: boolean): string {
  const replies = 'when someone replies to your comment';
  if (role === 'none')
    return named
      ? `Hub tells you ${replies}, ${ALERTS_TAIL}`
      : 'Hub alerts are for Minter Admins, members at level 5 or above who nominate, people not in MINTER yet, and anyone with a registered name who comments. Nothing to alert you about now.';
  return named
    ? `Hub tells you ${ROLE_EVENTS[role]}, and ${replies}, ${ALERTS_TAIL}`
    : `Hub tells you ${ROLE_EVENTS[role]}, ${ALERTS_TAIL}`;
}

/** What the support alerts cover, for Minter Admins and nominators. */
const SUPPORT_SCOPE = `Support alerts cover the nominations you made that are still open (up to ${MAX_SUPPORT_ALERTS}). While alerts are on, opening Settings adds the ones you made since and drops the ones that closed.`;

type Note = { tone: 'success' | 'warning' | 'error' | 'neutral'; text: string } | null;

function HubAlertsRow() {
  const session = useSession();
  const { status } = useMyStatus();
  const labelId = useId();
  const hintId = useId();
  const switchId = useId();
  const inHub = hasQortalRequest() && session.status === 'ready';
  const actions = useQuery(inHub ? 'hub:actions' : null, () => getHubActions());
  const supported = supportsHubAlerts(actions.data);
  const alerts = useQuery(inHub && supported ? 'hub:alerts' : null, () => getHubAlertIds());
  const [busy, setBusy] = useState(false);
  // Two quick presses before the re-render: the second is ignored too.
  const busyRef = useRef(false);
  const [note, setNote] = useState<Note>(null);

  const role = alertRole(status);
  const name = session.name || null;
  const ids = alerts.data ?? [];
  const on = ids.length > 0;
  const stale = on && !rulesMatch(ids, role, session.address);
  // The nominations a nominator made (the read Home makes; usually still cached).
  const nominator = makesNominations(role);
  const all = useQuery(inHub && supported && nominator ? 'nominations:all' : null, (force) =>
    loadNominations({ force })
  );
  const nominees = all.data ? supportAlertNominees(all.data.all, session.address) : null;
  const noneOpen = role === 'nominator' && nominees !== null && nominees.length === 0;
  // A nominator's switch needs their open nominations: until they are read, nothing to turn on.
  const nominationsFailed = !on && role === 'nominator' && all.isError;

  let hint: string;
  if (!inHub) hint = 'Open this app in Qortal Hub or GO, signed in, to use Hub alerts.';
  else if (actions.isLoading) hint = 'Checking what your Hub offers…';
  else if (!supported) hint = "Your Hub doesn't offer app alerts. Home still shows what changed.";
  else if (alerts.isError) hint = "Couldn't read your Hub alerts. Try again later.";
  else if (stale)
    // With nothing to alert about now, they can only be turned off: the switch stays off after that.
    hint =
      alertRules(role, session.address, nominees ?? [], name).length === 0
        ? 'These alerts were set up for your earlier role and no longer fit. Turn them off.'
        : 'These alerts were set up for your earlier role. Turn them off and on to update them.';
  else if (nominationsFailed)
    hint = "Couldn't read the nominations you made, so there's nothing to turn on yet.";
  else if (!on && role === 'nominator' && all.isLoading)
    hint = 'Checking the nominations you made…';
  else if (noneOpen)
    hint = name
      ? 'Hub tells you when someone replies to your comment, and when someone adds their support to a nomination you made. You have no open nominations now.'
      : 'Hub tells you when someone adds their support to a nomination you made. You have no open nominations now.';
  else hint = roleHint(role, Boolean(name));

  const ready = inHub && supported && !alerts.isLoading && !alerts.isError;
  // Not disabled while its own request runs: a disabled control loses focus.
  // Presses meanwhile are ignored instead. A nominator's switch waits for the
  // nominations they made (their support rules); otherwise there is nothing
  // to turn on without role rules, a name for the reply rules, or open
  // nominations.
  const disabled =
    !ready ||
    !status ||
    (!on &&
      ((role === 'nominator' && nominees === null) ||
        alertRules(role, session.address, nominees ?? [], name).length === 0));

  // While alerts are on, bring the support and reply rules in step once per visit, list of
  // nominations and name: once the nominations are read (or couldn't be), for those who nominate.
  const synced = useRef<string | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const nomineesKey = nominees?.join(',') ?? null;
  const nomineesSettled = !nominator || nomineesKey !== null || all.isError;
  const syncKey = `${role}|${nomineesKey}|${name ?? ''}`;
  useEffect(() => {
    if (!ready || !on || stale || !nomineesSettled) return;
    if (synced.current === syncKey) return;
    synced.current = syncKey;
    const list =
      nominator && nomineesKey !== null ? (nomineesKey ? nomineesKey.split(',') : []) : null;
    syncHubAlerts(role, list, name)
      .catch(() =>
        setNote({
          tone: 'warning',
          text: "Couldn't update your alerts. Try again later.",
        })
      )
      .finally(() => setChecked(syncKey));
  }, [ready, on, stale, nomineesSettled, nominator, role, nomineesKey, name, syncKey]);
  // Try again stays while it reads, so focus stays on it; once the nominations are read it
  // goes, and focus moves on to the switch (or the page, when there is nothing to turn on).
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);
  const refocus = useRef(false);
  const retry = async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    setNote(null);
    await all.refetch();
    if (getQueryState('nominations:all').status === 'error') {
      setNote({
        tone: 'warning',
        text: "Still couldn't read the nominations you made. Try again in a moment.",
      });
    }
    retryingRef.current = false;
    refocus.current = true;
    setRetrying(false);
  };
  useEffect(() => {
    if (retrying || !refocus.current) return;
    refocus.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    const input = document.getElementById(switchId);
    if (input instanceof HTMLInputElement && !input.disabled) input.focus();
    else focusPageTitle();
  }, [retrying, switchId]);

  // Open nominations still without a rule once that is done (Hub didn't let the app add them),
  // and the reply rules likewise.
  const missing =
    on && !stale && nominees && checked === syncKey
      ? nominees.filter((n) => !ids.includes(`${SUPPORTED_YOURS_PREFIX}${n}`)).length
      : 0;
  const repliesMissing =
    on &&
    !stale &&
    checked === syncKey &&
    replyAlertRules(role, name).some((r) => !ids.includes(r.notificationId));

  const toggle = async (next: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    try {
      if (next) {
        await turnOnHubAlerts(role, session.address, nominees ?? [], name);
        setNote({ tone: 'success', text: 'Hub alerts are on.' });
      } else {
        await turnOffHubAlerts();
        setNote({ tone: 'neutral', text: 'Hub alerts are off.' });
      }
    } catch (error) {
      if (isHubDecline(error)) {
        setNote({ tone: 'neutral', text: "You didn't allow alerts in Hub. Nothing changed." });
      } else if (isHubTimeout(error)) {
        setNote({
          tone: 'warning',
          text: 'Hub stopped waiting. If you allowed alerts there, turn this on again to finish.',
        });
      } else {
        const reason = friendlyError(error);
        setNote({
          tone: 'error',
          text: `Couldn't change Hub alerts${reason ? `: ${reason}` : '.'}`,
        });
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Row>
        <Copy>
          <Typography id={labelId} component="span" sx={{ display: 'block', fontWeight: 600 }}>
            Hub alerts
          </Typography>
          <Typography id={hintId} variant="body2" color="text.secondary" {...LINE}>
            {hint}
          </Typography>
          {ready && role === 'nominee' && !session.name ? (
            <Typography variant="body2" color="text.secondary" {...LINE}>
              Hub listens for app alerts only on accounts with a registered name.
            </Typography>
          ) : null}
          {/* With alerts on and none open, it still says how the next ones get their alerts. */}
          {ready && nominator && nominees !== null && (on || !noneOpen) ? (
            <Typography variant="body2" color="text.secondary" {...LINE}>
              {SUPPORT_SCOPE}
            </Typography>
          ) : null}
          {missing ? (
            <Typography variant="body2" color="text.secondary" {...LINE}>
              Alerts for {plural(missing, 'open nomination')} you made aren&apos;t set up yet: turn
              alerts off and on to add them.
            </Typography>
          ) : null}
          {repliesMissing ? (
            <Typography variant="body2" color="text.secondary" {...LINE}>
              Alerts for replies to your comments aren&apos;t set up yet: turn alerts off and on to
              add them.
            </Typography>
          ) : null}
          {ready && role !== 'none' ? (
            <Typography variant="body2" color="text.secondary" {...LINE}>
              Approvals, rejections and expiry show on Home: Hub can only alert about published
              records.
            </Typography>
          ) : null}
          <Typography
            variant="body2"
            role="status"
            component="span"
            sx={{
              display: 'block',
              color: (theme) =>
                !note || note.tone === 'neutral'
                  ? theme.palette.text.secondary
                  : readable(note.tone)(theme),
              fontWeight: note && note.tone !== 'neutral' ? 600 : 400,
            }}
          >
            {busy ? 'Waiting for Hub…' : (note?.text ?? '')}
          </Typography>
        </Copy>
        <Switch
          checked={on}
          disabled={disabled}
          onChange={(_, next) => void toggle(next)}
          slotProps={{
            input: {
              id: switchId,
              'aria-labelledby': labelId,
              'aria-describedby': hintId,
              'aria-busy': busy || undefined,
            },
          }}
        />
      </Row>
      {/* Outside the row: a button inside its label would take the row's taps from the switch. */}
      {nominationsFailed || retrying ? (
        <Box sx={{ px: 2, pb: 1.25, mt: -1 }}>
          <Button
            onClick={() => void retry()}
            aria-busy={retrying || undefined}
            aria-label="Try again to read the nominations you made"
            sx={{ minHeight: 44, ml: -1 }}
          >
            Try again
          </Button>
        </Box>
      ) : null}
    </>
  );
}

export function NotificationSettings() {
  const [since, setSince] = useAtom(sinceLastVisitAtom);
  const labelId = useId();
  const hintId = useId();
  return (
    <Section title="Notifications" id="settings-notifications">
      <Card>
        <Row>
          <Copy>
            <Typography id={labelId} component="span" sx={{ display: 'block', fontWeight: 600 }}>
              Since your last visit
            </Typography>
            <Typography id={hintId} variant="body2" color="text.secondary" {...LINE}>
              Home lists what changed since you last opened the app on this device: new decisions,
              your nomination&apos;s progress, how the nominations you made ended, replies to your
              comments.
            </Typography>
          </Copy>
          <Switch
            checked={since}
            onChange={(_, v) => setSince(v)}
            slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }}
          />
        </Row>
        <HubAlertsRow />
      </Card>
    </Section>
  );
}
