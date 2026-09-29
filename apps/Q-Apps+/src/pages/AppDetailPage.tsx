import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import StarOutlineRounded from '@mui/icons-material/StarOutlineRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { allQdnNames, categoryLabel, findApp, SHARED_IMPROVEMENTS, STACK_LABELS } from '../apps/manifest';
import { describeStatus, getAppResourceStatus, type AppResourceStatus } from '../qortal/appResources';
import { describeError, hasQortalRequest } from '../qortal/request';
import { appLink } from '../qortal/openApp';
import { useAppResources } from '../hooks/useAppResources';
import { useNow } from '../hooks/useNow';
import { useOpenApp } from '../hooks/useOpenApp';
import { favouriteAppsAtom, showOriginalsAtom, toggleFavourite } from '../state/settings';
import { AppIcon } from '../components/AppIcon';
import { Card, Page, PageHeader, Section, SectionTitle } from '../components/Layout';
import { useToast } from '../components/Toast';
import { formatBytes, formatDate, timeAgo } from '../utils/format';

const Hero = styled(Card)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  alignItems: 'flex-start',
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
}));

const HeroText = styled('div')(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

const Facts = styled('dl')(({ theme }) => ({
  margin: 0,
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(0.75),
  '& dt': { color: theme.palette.text.secondary, fontSize: 14 },
  '& dd': { margin: 0, fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' },
}));

const List = styled('ul')(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '& li': { fontSize: 14, lineHeight: 1.45 },
}));

/** Download status of the app's zip on this node (GET_QDN_RESOURCE_STATUS), once per app page. */
function useResourceStatus(name: string) {
  const [state, setState] = useState<{ loading: boolean; status?: AppResourceStatus; error?: string }>({
    loading: hasQortalRequest(),
  });
  const [attempt, setAttempt] = useState(0);
  const freshRef = useRef(false);
  useEffect(() => {
    if (!name || !hasQortalRequest()) return;
    let ignore = false;
    const fresh = freshRef.current;
    freshRef.current = false;
    getAppResourceStatus(name, { fresh }).then(
      (status) => {
        if (!ignore) setState({ loading: false, status });
      },
      (error: unknown) => {
        if (!ignore) setState({ loading: false, error: describeError(error) });
      }
    );
    return () => {
      ignore = true;
    };
  }, [name, attempt]);
  const reload = useCallback(() => {
    freshRef.current = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

export function AppDetailPage() {
  const { name } = useParams<{ name: string }>();
  const app = findApp(name);
  const names = useMemo(() => allQdnNames(), []);
  const { status, byName, error, reload } = useAppResources(names);
  const [favourites, setFavourites] = useAtom(favouriteAppsAtom);
  const showOriginals = useAtomValue(showOriginalsAtom);
  const open = useOpenApp();
  const toast = useToast();
  const download = useResourceStatus(app?.name ?? '');
  const now = useNow();

  if (!app) {
    return (
      <>
        <PageHeader title="App not found" backTo="/" />
        <Page $maxWidth={720}>
          <Alert severity="warning" variant="outlined">
            There is no + app called “{name}”.
          </Alert>
          <Button component={RouterLink} to="/" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
            Back to all apps
          </Button>
        </Page>
      </>
    );
  }

  const resource = byName[app.name];
  const original = byName[app.original.name];
  const favourite = favourites.includes(app.name);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied', 'success');
    } catch {
      toast(`Couldn't copy. The link is ${text}`, 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={app.name}
        subtitle={categoryLabel(app.category)}
        backTo="/"
        actions={
          <Tooltip title={favourite ? 'Remove from favourites' : 'Add to favourites'}>
            <IconButton
              aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={favourite}
              color={favourite ? 'primary' : 'default'}
              onClick={() => setFavourites((list) => toggleFavourite(list, app.name))}
            >
              {favourite ? <StarRounded /> : <StarOutlineRounded />}
            </IconButton>
          </Tooltip>
        }
      />
      <Page $maxWidth={760}>
        <Hero>
          <AppIcon name={app.name} icon={app.icon} size={72} />
          <HeroText>
            <div>
              <Typography variant="h2" sx={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
                {app.name}
              </Typography>
              <Typography color="text.secondary">{app.tagline}</Typography>
            </div>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={categoryLabel(app.category)} />
              <Chip size="small" variant="outlined" label={STACK_LABELS[app.stack]} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
              <Button variant="contained" startIcon={<OpenInNewOutlined />} onClick={() => void open(app.name)}>
                Open {app.name}
              </Button>
              {showOriginals && app.original.name && (
                <Button variant="outlined" onClick={() => void open(app.original.name)}>
                  Open original {app.original.name}
                </Button>
              )}
            </Box>
          </HeroText>
        </Hero>

        <Section>
          <SectionTitle>About</SectionTitle>
          <Typography variant="body2">{app.description}</Typography>
        </Section>

        <Section>
          <SectionTitle>What the + version adds</SectionTitle>
          <Card>
            <List>
              {app.adds.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          </Card>
          <Typography variant="caption" color="text.secondary">
            Headline features of this pass. The app's own Settings → About lists exactly what shipped.
          </Typography>
        </Section>

        <Section>
          <SectionTitle>In every + app</SectionTitle>
          <Card>
            <List>
              {SHARED_IMPROVEMENTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          </Card>
        </Section>

        <Section>
          <SectionTitle>
            On QDN
            {status !== 'offline' && (
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Refresh QDN details"
                    sx={{ ml: 0.5, verticalAlign: 'middle' }}
                    disabled={status === 'loading'}
                    onClick={() => {
                      void reload();
                      void download.reload();
                    }}
                  >
                    <RefreshOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </SectionTitle>
          <Card>
            {status === 'offline' ? (
              <Typography variant="body2" color="text.secondary">
                Live details need Qortal Hub or GO.
              </Typography>
            ) : status === 'error' ? (
              <Alert
                severity="warning"
                variant="outlined"
                action={
                  <Button color="inherit" size="small" onClick={() => void reload()}>
                    Retry
                  </Button>
                }
              >
                Couldn't load QDN details{error ? `: ${error}` : ''}.
              </Alert>
            ) : status === 'loading' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
                <Skeleton width="50%" />
              </Box>
            ) : !resource ? (
              <Typography variant="body2" color="text.secondary">
                {app.name} isn't published on QDN yet. Check back soon.
              </Typography>
            ) : (
              <Facts>
                <dt>Published as</dt>
                <dd>
                  <code>{appLink(app.name)}</code>
                </dd>
                <dt>Updated</dt>
                <dd>
                  {formatDate(resource.updated)} ({timeAgo(resource.updated, now)})
                </dd>
                {resource.size !== undefined && (
                  <>
                    <dt>Size</dt>
                    <dd>{formatBytes(resource.size)}</dd>
                  </>
                )}
                {resource.metadata?.title && (
                  <>
                    <dt>Title</dt>
                    <dd>{resource.metadata.title}</dd>
                  </>
                )}
                {resource.metadata?.description && (
                  <>
                    <dt>Description</dt>
                    <dd>{resource.metadata.description}</dd>
                  </>
                )}
                <dt>On this node</dt>
                <dd>
                  {download.loading ? (
                    <Skeleton width={140} />
                  ) : download.error ? (
                    <span>Unknown ({download.error})</span>
                  ) : download.status ? (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                      {download.status.status === 'READY' && (
                        <CheckCircleOutlined sx={{ fontSize: 16, color: 'success.main' }} />
                      )}
                      {describeStatus(download.status.status)}
                      {download.status.status === 'DOWNLOADING' &&
                        download.status.percentLoaded !== undefined &&
                        ` · ${Math.round(download.status.percentLoaded)}%`}
                    </Box>
                  ) : (
                    '—'
                  )}
                </dd>
              </Facts>
            )}
          </Card>
        </Section>

        {app.original.name && (
          <Section>
            <SectionTitle>Compared with {app.original.name}</SectionTitle>
            <Card>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                {app.name} reads and writes the same QDN data as {app.original.name}
                {app.services.length > 0 ? ` (${app.services.join(', ')})` : ''}, so anything you publish in
                one shows up in the other. You can keep both installed.
              </Typography>
              <Facts>
                <dt>Original</dt>
                <dd>
                  <code>{appLink(app.original.name)}</code>
                  {status === 'ready' && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {original ? `updated ${timeAgo(original.updated, now)}` : 'not found on QDN'}
                    </Typography>
                  )}
                </dd>
                <dt>Source</dt>
                <dd>
                  {app.original.repo}
                  <Tooltip title="Copy link">
                    <IconButton size="small" aria-label="Copy source link" sx={{ ml: 0.5 }} onClick={() => void copy(app.original.repo)}>
                      <ContentCopyOutlined sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </dd>
              </Facts>
            </Card>
          </Section>
        )}
      </Page>
    </>
  );
}
