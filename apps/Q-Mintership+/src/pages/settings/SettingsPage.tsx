/**
 * Settings (docs/DESIGN.md → Settings page): Account, Appearance, the app's
 * own Mintership section, Notifications, Muted names, and About with the
 * changelog.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useAtom, useAtomValue } from 'jotai';
import { ThemePicker } from '../../hub-theme';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { useNavHas } from '../../components/layout/useNavHas';
import { ChangelogDialog } from '../../components/Settings/ChangelogDialog';
import { NotificationSettings } from './NotificationSettings';
import { MutedNames } from './MutedNames';
import { AddressText } from '../../components/common/Person';
import { NameAvatar } from '../../components/common/NameAvatar';
import { Section, ToneChip } from '../../components/common/Section';
import { useMyStatus } from '../../hooks/useData';
import { useFullExplorer } from '../../hooks/useFullExplorer';
import { signIn, useSession } from '../../state/session';
import { clearRecent, useRecent } from '../../state/explorer';
import {
  celebrateAtom,
  decisionsHideAnsweredAtom,
  motionAtom,
  timeDisplayAtom,
  decisionsOrderAtom,
  explorerRememberAtom,
  activityFirstReadAtom,
  activityHiddenMarksAtom,
  clampActivityRead,
  type DecisionsOrder,
  type MotionSetting,
  type TimeDisplay,
} from '../../state/settings';
import { APP_VERSION } from '../../constants/app';
import {
  APP_NAME,
  ORIGINAL_APP_LINK,
  ORIGINAL_APP_NAME,
  SOURCE_REPO,
  UPSTREAM_REPO,
} from '../../constants/plus';
import { PATHS } from '../../routes/paths';
import { formatCount, plural } from '../../utils/format';
import { ActivitySettingsDialog } from '../explorer/account/activity/ActivitySettings';
import { copyText, openQortalLink } from '../../utils/links';
import { readable } from '../../utils/readable';

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

/** A row under a switch row (which draws no line below itself). */
const RowAfterSwitch = styled(Row)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const LinkRow = styled('button')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  width: '100%',
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  border: 0,
  background: 'none',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  textAlign: 'left',
  transition: 'background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  '& + &, & + div, div + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled('span')({ display: 'block', flex: 1, minWidth: 0 });

/** A row whose switch the whole row turns on and off (the switch alone is under 44 px). */
const SwitchRow = styled('label')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  cursor: 'pointer',
  'div + &, label + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

function SettingText({ title, hint, id }: { title: string; hint: string; id?: string }) {
  return (
    <Copy>
      <Typography id={id} component="span" sx={{ display: 'block', fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" component="span" color="text.secondary" sx={{ display: 'block' }}>
        {hint}
      </Typography>
    </Copy>
  );
}

function WebLinkRow({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Row>
      <Copy>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {url}
        </Typography>
        {/* Visible on touch too, where the tooltip can't be read. */}
        <Typography variant="body2" role="status" sx={{ color: readable('success') }}>
          {copied ? 'Copied: paste it in your browser.' : ''}
        </Typography>
      </Copy>
      <Tooltip
        title={
          copied ? 'Copied: paste it in your browser' : 'Copy link (web links open outside Qortal)'
        }
      >
        <IconButton
          aria-label={copied ? `${title} link copied` : `Copy the ${title} link`}
          onClick={async () => setCopied(await copyText(url))}
          sx={{ width: 44, height: 44 }}
        >
          {copied ? (
            <CheckOutlinedIcon fontSize="small" />
          ) : (
            <ContentCopyOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Row>
  );
}

export default function SettingsPage() {
  const session = useSession();
  const { status } = useMyStatus();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [motion, setMotion] = useAtom(motionAtom);
  const [timeDisplay, setTimeDisplay] = useAtom(timeDisplayAtom);
  const [decisionsOrder, setDecisionsOrder] = useAtom(decisionsOrderAtom);
  const [celebrate, setCelebrate] = useAtom(celebrateAtom);
  const [hideAnswered, setHideAnswered] = useAtom(decisionsHideAnsweredAtom);
  const [rememberExplored, setRememberExplored] = useAtom(explorerRememberAtom);
  const activityFirstRead = clampActivityRead(useAtomValue(activityFirstReadAtom));
  // The activity chart is for viewers who see the Explorer's detailed parts (rules/explorer/access.ts).
  const fullExplorer = useFullExplorer() === true;
  const hiddenMarks = useAtomValue(activityHiddenMarksAtom);
  const [activityOpen, setActivityOpen] = useState(false);
  const recent = useRecent();
  // On phones Settings is a gear on Home, not in the bar: Back.
  const inNav = useNavHas('settings');

  const roles = status
    ? [
        status.isAdmin ? 'Minter Admin' : '',
        status.isMember ? 'MINTER member' : '',
        session.status === 'ready' ? `Level ${status.level}` : '',
      ].filter(Boolean)
    : [];

  return (
    <>
      <PageHeader title="Settings" back={inNav ? undefined : PATHS.home} />
      <PageBody $maxWidth={720}>
        <Section title="Account" id="settings-account">
          <Card>
            {session.status === 'ready' ? (
              <>
                <Row>
                  <NameAvatar name={session.name} size={44} />
                  <Copy>
                    <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {session.name ?? 'No registered name'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {session.name
                        ? 'Nominations you publish go out under this name.'
                        : 'A name is needed to publish a nomination, not to be nominated.'}
                    </Typography>
                  </Copy>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {roles.map((role) => (
                      <ToneChip
                        key={role}
                        size="small"
                        color="primary"
                        variant="outlined"
                        label={role}
                      />
                    ))}
                  </Box>
                </Row>
                <Row>
                  <Copy>
                    <Typography variant="body2" color="text.secondary">
                      Address
                    </Typography>
                    <AddressText address={session.address} full />
                  </Copy>
                </Row>
              </>
            ) : (
              <Row>
                <SettingText
                  title={
                    session.status === 'outside' ? 'Open in Qortal Hub or GO' : 'Not signed in'
                  }
                  hint={
                    session.status === 'outside'
                      ? 'Your account, nominations and approvals work inside Qortal Hub or GO.'
                      : 'Sign in to see your own status and act on nominations.'
                  }
                />
                {session.status !== 'outside' ? (
                  <Button variant="contained" onClick={() => void signIn()} sx={{ minHeight: 44 }}>
                    Sign in
                  </Button>
                ) : null}
              </Row>
            )}
          </Card>
        </Section>

        <Section title="Appearance" id="settings-appearance">
          <ThemePicker />
          <Card>
            <Row>
              <SettingText
                id="motion-label"
                title="Motion"
                hint="Pages and lists fade in, refresh icons turn, rings fill and the celebration plays. Follow your system, or turn animation down."
              />
              <Select
                size="small"
                value={motion}
                onChange={(e) => setMotion(e.target.value as MotionSetting)}
                labelId="motion-label"
                sx={{ minHeight: 44 }}
              >
                <MenuItem value="system">Follow system</MenuItem>
                <MenuItem value="reduce">Reduce</MenuItem>
                <MenuItem value="full">Full</MenuItem>
              </Select>
            </Row>
            <SwitchRow>
              <SettingText
                id="celebrate-label"
                title="Celebrate joining MINTER"
                hint="A small burst on Home when you become a minter."
              />
              <Switch
                checked={celebrate}
                onChange={(_, v) => setCelebrate(v)}
                slotProps={{ input: { 'aria-labelledby': 'celebrate-label' } }}
              />
            </SwitchRow>
          </Card>
        </Section>

        <Section title="Mintership" id="settings-mintership">
          <Card>
            <Row>
              <SettingText
                id="time-label"
                title="Countdowns"
                hint="Time is estimated from the measured block time (about 73 s); blocks are exact."
              />
              <Select
                size="small"
                value={timeDisplay}
                onChange={(e) => setTimeDisplay(e.target.value as TimeDisplay)}
                labelId="time-label"
                sx={{ minHeight: 44 }}
              >
                <MenuItem value="time">Time left</MenuItem>
                <MenuItem value="blocks">Blocks left</MenuItem>
                <MenuItem value="both">Both</MenuItem>
              </Select>
            </Row>
            <Row>
              <SettingText
                id="decisions-order-label"
                title="Decisions order"
                hint="A section for each type of change, or one queue, most urgent first."
              />
              <Select
                size="small"
                value={decisionsOrder}
                onChange={(e) => setDecisionsOrder(e.target.value as DecisionsOrder)}
                labelId="decisions-order-label"
                sx={{ minHeight: 44 }}
              >
                <MenuItem value="type">By type</MenuItem>
                <MenuItem value="urgency">Most urgent first</MenuItem>
              </Select>
            </Row>
            {status?.isAdmin ? (
              <SwitchRow>
                <SettingText
                  id="hide-answered-label"
                  title="Hide already voted on"
                  hint="Decisions you approved or rejected, and Minter Admin polls you voted on: keep Decisions to what still needs you."
                />
                <Switch
                  checked={hideAnswered}
                  onChange={(_, v) => setHideAnswered(v)}
                  slotProps={{ input: { 'aria-labelledby': 'hide-answered-label' } }}
                />
              </SwitchRow>
            ) : null}
          </Card>
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            These settings stay in this browser.
          </Typography>
        </Section>

        <Section title="Explorer" id="settings-explorer">
          <Card>
            <SwitchRow>
              <SettingText
                id="explorer-remember-label"
                title="Remember accounts I explore on this device"
                hint="The Explorer lists them under Recent explorations. Only their addresses are kept, in this browser. Turning this off forgets them."
              />
              <Switch
                checked={rememberExplored}
                onChange={(_, v) => {
                  setRememberExplored(v);
                  if (!v) clearRecent();
                }}
                slotProps={{ input: { 'aria-labelledby': 'explorer-remember-label' } }}
              />
            </SwitchRow>
            <RowAfterSwitch>
              <SettingText
                title="Recent explorations"
                hint={
                  recent.length
                    ? `${plural(recent.length, 'account')} remembered on this device.`
                    : 'None remembered on this device.'
                }
              />
              <Button
                variant="outlined"
                onClick={clearRecent}
                disabled={recent.length === 0}
                aria-label="Clear recent explorations"
                sx={{ minHeight: 44 }}
              >
                Clear
              </Button>
            </RowAfterSwitch>
            {fullExplorer ? (
              <RowAfterSwitch>
                <SettingText
                  title="Activity"
                  hint={`Reads an account's newest ${formatCount(activityFirstRead)} transactions at first${
                    hiddenMarks.length
                      ? `; ${plural(hiddenMarks.length, 'kind')} of milestone hidden`
                      : ''
                  }.`}
                />
                <Button
                  variant="outlined"
                  onClick={() => setActivityOpen(true)}
                  aria-haspopup="dialog"
                  aria-label="Change Activity settings"
                  sx={{ minHeight: 44 }}
                >
                  Change
                </Button>
              </RowAfterSwitch>
            ) : null}
          </Card>
          {activityOpen && fullExplorer ? (
            <ActivitySettingsDialog open onClose={() => setActivityOpen(false)} />
          ) : null}
        </Section>

        <NotificationSettings />

        <MutedNames />

        <Section title="About" id="settings-about">
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>
                  {APP_NAME} {APP_VERSION}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  What&apos;s new
                </Typography>
              </Copy>
              <ArrowForwardIosIcon aria-hidden sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => void openQortalLink(ORIGINAL_APP_LINK)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>The original {ORIGINAL_APP_NAME}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {ORIGINAL_APP_LINK}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon aria-hidden sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <WebLinkRow title="Upstream source" url={UPSTREAM_REPO} />
            <WebLinkRow title="Q-Apps+ source" url={SOURCE_REPO} />
          </Card>
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            {APP_NAME} reads MINTER straight from the chain, so it shows the same members, admins
            and decisions as any other app. Nominations are small new records on QDN; the original
            app&apos;s boards stay readable in History.
          </Typography>
        </Section>
      </PageBody>
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}
