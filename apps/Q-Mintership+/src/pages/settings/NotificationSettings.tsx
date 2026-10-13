/**
 * Settings → Notifications: Home's "Since your last visit" (on by default,
 * kept in this browser) and Hub alerts (off until you turn them on; Hub
 * keeps them for your account: qortal/hubAlerts.ts).
 */
import { useId, useRef, useState } from 'react';
import { Switch, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAtom } from 'jotai';
import { Section } from '../../components/common/Section';
import { useMyStatus } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { hasQortalRequest } from '../../qortal/client';
import {
  alertRole,
  getHubActions,
  getHubAlertIds,
  rulesMatch,
  supportsHubAlerts,
  turnOffHubAlerts,
  turnOnHubAlerts,
  type AlertRole,
} from '../../qortal/hubAlerts';
import { useSession } from '../../state/session';
import { sinceLastVisitAtom } from '../../state/notifications';
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

/** What the Hub alerts switch says for each role. */
const ROLE_HINT: Record<AlertRole, string> = {
  admin:
    'Hub tells you when a new nomination is published, even when this app is closed. Hub asks you once to allow it. No fee.',
  nominee:
    'Hub tells you when someone nominates you or adds their support, even when this app is closed. Hub asks you once to allow it. No fee.',
  none: 'Hub alerts are for Minter Admins (new nominations) and for people not in MINTER yet (being nominated). Nothing to alert you about now.',
};

type Note = { tone: 'success' | 'warning' | 'error' | 'neutral'; text: string } | null;

function HubAlertsRow() {
  const session = useSession();
  const { status } = useMyStatus();
  const labelId = useId();
  const hintId = useId();
  const inHub = hasQortalRequest() && session.status === 'ready';
  const actions = useQuery(inHub ? 'hub:actions' : null, () => getHubActions());
  const supported = supportsHubAlerts(actions.data);
  const alerts = useQuery(inHub && supported ? 'hub:alerts' : null, () => getHubAlertIds());
  const [busy, setBusy] = useState(false);
  // Two quick presses before the re-render: the second is ignored too.
  const busyRef = useRef(false);
  const [note, setNote] = useState<Note>(null);

  const role = alertRole(status);
  const ids = alerts.data ?? [];
  const on = ids.length > 0;
  const stale = on && !rulesMatch(ids, role, session.address);

  let hint: string;
  if (!inHub) hint = 'Open this app in Qortal Hub or GO, signed in, to use Hub alerts.';
  else if (actions.isLoading) hint = 'Checking what your Hub offers…';
  else if (!supported) hint = "Your Hub doesn't offer app alerts. Home still shows what changed.";
  else if (alerts.isError) hint = "Couldn't read your Hub alerts. Try again later.";
  else if (stale)
    // With no role now, they can only be turned off: the switch stays off after that.
    hint =
      role === 'none'
        ? 'These alerts were set up for your earlier role and no longer fit. Turn them off.'
        : 'These alerts were set up for your earlier role. Turn them off and on to update them.';
  else hint = ROLE_HINT[role];

  const ready = inHub && supported && !alerts.isLoading && !alerts.isError;
  // Not disabled while its own request runs: a disabled control loses focus.
  // Presses meanwhile are ignored instead.
  const disabled = !ready || (!on && role === 'none') || !status;

  const toggle = async (next: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote(null);
    try {
      if (next) {
        await turnOnHubAlerts(role, session.address);
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
        {ready && role !== 'none' ? (
          <Typography variant="body2" color="text.secondary" {...LINE}>
            Signatures, approvals and expiry show on Home: Hub can only alert about published
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
            'aria-labelledby': labelId,
            'aria-describedby': hintId,
            'aria-busy': busy || undefined,
          },
        }}
      />
    </Row>
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
              your nomination&apos;s progress.
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
