/**
 * Settings (docs/DESIGN.md → Settings page): Account, Appearance, the app's
 * own Mintership section, and About with the changelog.
 */
import { useState } from 'react';
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useAtom } from 'jotai';
import { ThemePicker } from '../../hub-theme';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { ChangelogDialog } from '../../components/Settings/ChangelogDialog';
import { AddressText } from '../../components/common/Person';
import { NameAvatar } from '../../components/common/NameAvatar';
import { Section, ToneChip } from '../../components/common/Section';
import { useMyStatus } from '../../hooks/useData';
import { signIn, useSession } from '../../state/session';
import {
  celebrateAtom,
  decisionsHideSignedAtom,
  motionAtom,
  timeDisplayAtom,
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
import { copyText, openQortalLink } from '../../utils/links';

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

const Copy = styled('div')({ flex: 1, minWidth: 0 });

function SettingText({ title, hint, id }: { title: string; hint: string; id?: string }) {
  return (
    <Copy>
      <Typography id={id} sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {hint}
      </Typography>
    </Copy>
  );
}

function WebLinkRow({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Row>
      <Copy>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {url}
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
          <ContentCopyOutlinedIcon fontSize="small" />
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
  const [celebrate, setCelebrate] = useAtom(celebrateAtom);
  const [hideSigned, setHideSigned] = useAtom(decisionsHideSignedAtom);

  const roles = status
    ? [
        status.isAdmin ? 'Minter Admin' : '',
        status.isMember ? 'MINTER member' : '',
        session.status === 'ready' ? `Level ${status.level}` : '',
      ].filter(Boolean)
    : [];

  return (
    <>
      <PageHeader title="Settings" />
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
                      ? 'Your account, nominations and signing work inside Qortal Hub or GO.'
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
                hint="Rings, countdowns and the celebration animate. Follow your system, or turn animation down."
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
            <Row>
              <SettingText
                id="celebrate-label"
                title="Celebrate new minters"
                hint="A small burst on Home when you become a minter."
              />
              <Switch
                checked={celebrate}
                onChange={(_, v) => setCelebrate(v)}
                slotProps={{ input: { 'aria-labelledby': 'celebrate-label' } }}
              />
            </Row>
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
            {status?.isAdmin ? (
              <Row>
                <SettingText
                  id="hide-signed-label"
                  title="Hide decisions I signed"
                  hint="Keep the Decisions queue to what still needs you."
                />
                <Switch
                  checked={hideSigned}
                  onChange={(_, v) => setHideSigned(v)}
                  slotProps={{ input: { 'aria-labelledby': 'hide-signed-label' } }}
                />
              </Row>
            ) : null}
          </Card>
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            These settings stay in this browser.
          </Typography>
        </Section>

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
