import { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Button, IconButton, Switch, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import ViewListOutlined from '@mui/icons-material/ViewListOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import ArrowForwardIosOutlined from '@mui/icons-material/ArrowForwardIosOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import { ThemePicker } from '../hub-theme';
import { SOURCE_REPO } from '../apps/manifest';
import { APP_VERSION } from '../constants/changelog';
import { qortalAvatarUrl } from '../qortal/avatar';
import { describeError, hasQortalRequest, qortalCall } from '../qortal/request';
import {
  favouriteAppsAtom,
  layoutModeAtom,
  recentAppsAtom,
  showOriginalsAtom,
  showRecentAtom,
  type LayoutMode,
} from '../state/settings';
import { ChangelogDialog } from '../components/ChangelogDialog';
import { Card, Page, PageHeader, Section, SectionTitle } from '../components/Layout';
import { useToast } from '../components/Toast';

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(1.25, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-of-type': { borderBottom: 0, paddingBottom: 0 },
  '&:first-of-type': { paddingTop: 0 },
}));

const RowText = styled('div')({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

const LinkRow = styled('button')(({ theme }) => ({
  appearance: 'none',
  width: '100%',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(1.25, 0),
  cursor: 'pointer',
  textAlign: 'left',
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

const Avatar = styled('img')(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  objectFit: 'cover',
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.elevated ?? theme.palette.background.paper,
}));

interface AccountState {
  loading: boolean;
  name?: string;
  address?: string;
  error?: string;
}

function AccountSection() {
  const [state, setState] = useState<AccountState>({ loading: false });
  const inHub = hasQortalRequest();

  const load = async () => {
    setState({ loading: true });
    try {
      const account = await qortalCall<{ address?: string }>({ action: 'GET_USER_ACCOUNT' });
      const address = account?.address;
      if (!address) throw new Error('No account address returned');
      let name: string | undefined;
      try {
        const primary = await qortalCall<unknown>({ action: 'GET_PRIMARY_NAME', address });
        if (typeof primary === 'string' && primary) name = primary;
      } catch {
        // Older hosts have no GET_PRIMARY_NAME; fall back to the account's names.
      }
      if (!name) {
        const names = await qortalCall<Array<{ name?: string }>>({
          action: 'GET_ACCOUNT_NAMES',
          address,
          limit: 20,
          offset: 0,
          reverse: false,
        });
        name = Array.isArray(names) ? names.find((n) => typeof n?.name === 'string')?.name : undefined;
      }
      setState({ loading: false, name, address });
    } catch (error) {
      setState({ loading: false, error: describeError(error) });
    }
  };

  return (
    <Section>
      <SectionTitle>Account</SectionTitle>
      <Card>
        {!inHub ? (
          <Typography variant="body2" color="text.secondary">
            Your Qortal name shows here when Q-Apps+ runs inside Hub or GO.
          </Typography>
        ) : state.address ? (
          <Row>
            {state.name ? <Avatar src={qortalAvatarUrl(state.name)} alt="" /> : <PersonOutlined />}
            <RowText style={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600 }}>{state.name ?? 'No name registered'}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {state.address}
              </Typography>
            </RowText>
          </Row>
        ) : (
          <Row>
            <RowText>
              <Typography variant="body2">Show the name you're using in Hub.</Typography>
              <Typography variant="caption" color="text.secondary">
                {state.error ? `Couldn't read it: ${state.error}` : 'Hub asks once for permission to share your account.'}
              </Typography>
            </RowText>
            <Button variant="outlined" size="small" onClick={() => void load()} disabled={state.loading}>
              {state.loading ? 'Reading…' : 'Show my name'}
            </Button>
          </Row>
        )}
      </Card>
    </Section>
  );
}

export function SettingsPage() {
  const [layout, setLayout] = useAtom(layoutModeAtom);
  const [showRecent, setShowRecent] = useAtom(showRecentAtom);
  const [showOriginals, setShowOriginals] = useAtom(showOriginalsAtom);
  const recent = useAtomValue(recentAppsAtom);
  const setRecent = useSetAtom(recentAppsAtom);
  const favourites = useAtomValue(favouriteAppsAtom);
  const setFavourites = useSetAtom(favouriteAppsAtom);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const toast = useToast();

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(SOURCE_REPO);
      toast('Source link copied', 'success');
    } catch {
      toast(`Couldn't copy. The link is ${SOURCE_REPO}`, 'error');
    }
  };

  return (
    <>
      <PageHeader title="Settings" />
      <Page $maxWidth={680}>
        <AccountSection />

        <Section>
          <SectionTitle>Appearance</SectionTitle>
          <Card>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Theme
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Hub 3.0 and Qortal Classic follow Hub's light or dark mode. Black is always dark and White always light.
            </Typography>
            <ThemePicker />
            <Row sx={{ mt: 2, pt: 2, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}>
              <RowText>
                <Typography variant="body2">Layout</Typography>
                <Typography variant="caption" color="text.secondary">
                  How the app list is shown.
                </Typography>
              </RowText>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={layout}
                onChange={(_event, value: LayoutMode | null) => value && setLayout(value)}
                aria-label="Layout"
              >
                <ToggleButton value="grid" aria-label="Grid">
                  <GridViewOutlined fontSize="small" />
                </ToggleButton>
                <ToggleButton value="list" aria-label="List">
                  <ViewListOutlined fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>Launcher</SectionTitle>
          <Card>
            <Row>
              <RowText>
                <Typography variant="body2">Show recently opened</Typography>
                <Typography variant="caption" color="text.secondary">
                  A row of the last apps you opened, at the top of the list.
                </Typography>
              </RowText>
              <Switch
                checked={showRecent}
                onChange={(event) => setShowRecent(event.target.checked)}
                slotProps={{ input: { 'aria-label': 'Show recently opened' } }}
              />
            </Row>
            <Row>
              <RowText>
                <Typography variant="body2">Show links to the original apps</Typography>
                <Typography variant="caption" color="text.secondary">
                  An “Open original” button on each app page.
                </Typography>
              </RowText>
              <Switch
                checked={showOriginals}
                onChange={(event) => setShowOriginals(event.target.checked)}
                slotProps={{ input: { 'aria-label': 'Show links to the original apps' } }}
              />
            </Row>
            <Row>
              <RowText>
                <Typography variant="body2">Recently opened</Typography>
                <Typography variant="caption" color="text.secondary">
                  {recent.length === 0 ? 'Nothing yet' : `${recent.length} app${recent.length === 1 ? '' : 's'}`}
                </Typography>
              </RowText>
              <Button variant="outlined" size="small" disabled={recent.length === 0} onClick={() => setRecent([])}>
                Clear
              </Button>
            </Row>
            <Row>
              <RowText>
                <Typography variant="body2">Favourites</Typography>
                <Typography variant="caption" color="text.secondary">
                  {favourites.length === 0 ? 'None yet · tap the star on an app' : favourites.join(', ')}
                </Typography>
              </RowText>
              <Button variant="outlined" size="small" disabled={favourites.length === 0} onClick={() => setFavourites([])}>
                Clear
              </Button>
            </Row>
          </Card>
        </Section>

        <Section>
          <SectionTitle>About</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <RowText>
                <Typography variant="body2">Q-Apps+ {APP_VERSION}</Typography>
                <Typography variant="caption" color="text.secondary">
                  What's new
                </Typography>
              </RowText>
              <ArrowForwardIosOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
            </LinkRow>
            <Row>
              <RowText>
                <Typography variant="body2">Source</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                  {SOURCE_REPO}
                </Typography>
              </RowText>
              <Tooltip title="Copy link">
                <IconButton aria-label="Copy source link" onClick={() => void copySource()}>
                  <ContentCopyOutlined />
                </IconButton>
              </Tooltip>
            </Row>
            <Row>
              <RowText>
                <Typography variant="caption" color="text.secondary">
                  Built by Simon on the original Qortal Q-Apps. Hub 3.0 theme from Torq. Inter font © The Inter Project
                  Authors, SIL Open Font License 1.1.
                </Typography>
              </RowText>
            </Row>
          </Card>
        </Section>
      </Page>
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </>
  );
}
