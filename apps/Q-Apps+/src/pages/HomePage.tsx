import { useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import ViewListOutlined from '@mui/icons-material/ViewListOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import {
  allQdnNames,
  APP_CATEGORIES,
  APPS,
  matchesQuery,
  type AppCategoryId,
  type AppEntry,
} from '../apps/manifest';
import { useAppResources } from '../hooks/useAppResources';
import { useOpenApp } from '../hooks/useOpenApp';
import { useNow } from '../hooks/useNow';
import { favouriteAppsAtom, layoutModeAtom, recentAppsAtom, showRecentAtom, toggleFavourite } from '../state/settings';
import { AppCard } from '../components/AppCard';
import { AppIcon } from '../components/AppIcon';
import { Page, PageHeader, Section, SectionTitle } from '../components/Layout';
import { timeAgo } from '../utils/format';

const Grid = styled('div', { shouldForwardProp: (prop) => prop !== '$list' })<{ $list?: boolean }>(
  ({ theme, $list }) => ({
    display: 'grid',
    gap: theme.spacing(1.5),
    gridTemplateColumns: $list ? '1fr' : 'repeat(auto-fill, minmax(250px, 1fr))',
    [theme.breakpoints.down('sm')]: {
      gap: theme.spacing(1.25),
      gridTemplateColumns: '1fr',
    },
  })
);

const ChipRow = styled('div')(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  overflowX: 'auto',
  paddingBottom: 2,
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  '& > *': { flexShrink: 0 },
}));

const RecentButton = styled('button')(({ theme }) => ({
  appearance: 'none',
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1.25, 0.75, 0.75),
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 999,
  minHeight: 40,
  transition: 'background 150ms ease',
  '&:hover': { background: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

type Filter = 'all' | AppCategoryId;

export function HomePage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [layout, setLayout] = useAtom(layoutModeAtom);
  const [favourites, setFavourites] = useAtom(favouriteAppsAtom);
  const recent = useAtomValue(recentAppsAtom);
  const showRecent = useAtomValue(showRecentAtom);
  const names = useMemo(() => allQdnNames(), []);
  const { status, byName, error, reload } = useAppResources(names);
  const open = useOpenApp();
  const now = useNow();

  const visible = useMemo(
    () => APPS.filter((app) => (filter === 'all' || app.category === filter) && matchesQuery(app, query)),
    [filter, query]
  );
  const favouriteApps = visible.filter((app) => favourites.includes(app.name));
  const grouped = filter === 'all' && !query.trim();
  const recentApps = showRecent
    ? recent.map((entry) => ({ entry, app: APPS.find((a) => a.name === entry.name) })).filter((r) => r.app)
    : [];

  const renderCard = (app: AppEntry) => (
    <AppCard
      key={app.name}
      app={app}
      status={status}
      resource={byName[app.name]}
      favourite={favourites.includes(app.name)}
      layout={layout}
      onOpen={open}
      onToggleFavourite={(name) => setFavourites((list) => toggleFavourite(list, name))}
      now={now}
    />
  );

  return (
    <>
      <PageHeader
        title="Q-Apps+"
        subtitle={`${APPS.length} apps · the + versions of the Qortal Q-Apps`}
        actions={
          <>
            <Tooltip title={layout === 'grid' ? 'Show as list' : 'Show as grid'}>
              <IconButton
                aria-label={layout === 'grid' ? 'Show as list' : 'Show as grid'}
                onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
              >
                {layout === 'grid' ? <ViewListOutlined /> : <GridViewOutlined />}
              </IconButton>
            </Tooltip>
            {status !== 'offline' && (
              <Tooltip title="Refresh app details">
                <span>
                  <IconButton aria-label="Refresh app details" onClick={() => void reload()} disabled={status === 'loading'}>
                    {status === 'loading' ? <CircularProgress size={20} /> : <RefreshOutlined />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </>
        }
      />
      <Page>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search apps"
          size="small"
          fullWidth
          type="search"
          autoComplete="off"
          slotProps={{
            htmlInput: { 'aria-label': 'Search apps' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            },
          }}
        />

        <ChipRow role="group" aria-label="Category">
          <Chip label="All" clickable color={filter === 'all' ? 'primary' : 'default'} onClick={() => setFilter('all')} />
          {APP_CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              label={category.label}
              clickable
              color={filter === category.id ? 'primary' : 'default'}
              onClick={() => setFilter(category.id)}
            />
          ))}
        </ChipRow>

        {status === 'offline' && (
          <Alert severity="info" variant="outlined">
            You're outside Qortal Hub. Open Q-Apps+ in Hub or GO to launch apps and see live details.
          </Alert>
        )}
        {status === 'error' && (
          <Alert
            severity="warning"
            variant="outlined"
            action={
              <Button color="inherit" size="small" onClick={() => void reload()}>
                Retry
              </Button>
            }
          >
            Couldn't load app details from QDN{error ? `: ${error}` : ''}. The apps still open.
          </Alert>
        )}

        {recentApps.length > 0 && !query && filter === 'all' && (
          <Section aria-label="Recently opened">
            <SectionTitle>
              <HistoryOutlined sx={{ fontSize: 14, verticalAlign: '-2px', mr: 0.5 }} />
              Recently opened
            </SectionTitle>
            <ChipRow>
              {recentApps.map(({ entry, app }) => (
                <RecentButton key={entry.name} type="button" onClick={() => void open(entry.name)} aria-label={`Open ${entry.name}`}>
                  <AppIcon name={app!.name} icon={app!.icon} size={28} />
                  <span>
                    <Typography component="span" sx={{ fontWeight: 600, fontSize: 14, display: 'block', lineHeight: 1.2 }}>
                      {entry.name}
                    </Typography>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {timeAgo(entry.at, now)}
                    </Typography>
                  </span>
                </RecentButton>
              ))}
            </ChipRow>
          </Section>
        )}

        {visible.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
            <Typography color="text.secondary">No apps match “{query.trim()}”.</Typography>
            <Button variant="outlined" size="small" onClick={() => { setQuery(''); setFilter('all'); }}>
              Show all apps
            </Button>
          </Box>
        ) : grouped ? (
          <>
            {favouriteApps.length > 0 && (
              <Section aria-label="Favourites">
                <SectionTitle>Favourites</SectionTitle>
                <Grid $list={layout === 'list'}>{favouriteApps.map(renderCard)}</Grid>
              </Section>
            )}
            {APP_CATEGORIES.map((category) => {
              const apps = visible.filter((app) => app.category === category.id);
              if (apps.length === 0) return null;
              return (
                <Section key={category.id} aria-label={category.label}>
                  <SectionTitle>
                    {category.label}
                    <Typography component="span" variant="caption" sx={{ textTransform: 'none', fontWeight: 400, ml: 1 }}>
                      {category.blurb}
                    </Typography>
                  </SectionTitle>
                  <Grid $list={layout === 'list'}>{apps.map(renderCard)}</Grid>
                </Section>
              );
            })}
          </>
        ) : (
          <Grid $list={layout === 'list'}>{visible.map(renderCard)}</Grid>
        )}
      </Page>
    </>
  );
}
