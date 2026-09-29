import { type MouseEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, IconButton, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import StarOutlineRounded from '@mui/icons-material/StarOutlineRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import type { AppEntry } from '../apps/manifest';
import type { AppResource } from '../qortal/appResources';
import type { AppResourcesStatus } from '../hooks/useAppResources';
import { AppIcon } from './AppIcon';
import { StatusLine } from './StatusLine';
import { detailPath } from '../utils/routes';

const Root = styled('article', { shouldForwardProp: (prop) => prop !== '$list' })<{ $list?: boolean }>(
  ({ theme, $list }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: $list ? 'row' : 'column',
    alignItems: $list ? 'center' : 'stretch',
    gap: theme.spacing($list ? 1.5 : 1.25),
    padding: theme.spacing($list ? 1.25 : 2),
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    transition: 'background 150ms ease, border-color 150ms ease, transform 150ms ease',
    '&:hover': {
      background: theme.palette.action.hover,
      borderColor: theme.palette.mode === 'dark' ? theme.palette.text.secondary : theme.palette.divider,
    },
    '&:focus-within': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
);

const Head = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minWidth: 0,
  flex: 1,
}));

const Titles = styled('div')({
  minWidth: 0,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

const NameLink = styled(RouterLink)(({ theme }) => ({
  color: theme.palette.text.primary,
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 16,
  lineHeight: 1.25,
  '&:hover': { textDecoration: 'underline' },
  '&:focus-visible': { outline: 'none' },
}));

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

export interface AppCardProps {
  app: AppEntry;
  status: AppResourcesStatus;
  resource?: AppResource;
  favourite: boolean;
  layout: 'grid' | 'list';
  onOpen: (name: string) => void;
  onToggleFavourite: (name: string) => void;
  now?: number;
}

export function AppCard({ app, status, resource, favourite, layout, onOpen, onToggleFavourite, now }: AppCardProps) {
  const navigate = useNavigate();
  const list = layout === 'list';
  const stop = (event: MouseEvent) => event.stopPropagation();
  return (
    <Root $list={list} onClick={() => navigate(detailPath(app))} data-testid={`app-card-${app.slug}`}>
      <Head>
        <AppIcon name={app.name} icon={app.icon} size={list ? 44 : 52} />
        <Titles>
          <NameLink to={detailPath(app)} onClick={stop}>
            {app.name}
          </NameLink>
          <Typography variant="body2" color="text.secondary" noWrap={list} sx={{ lineHeight: 1.35 }}>
            {app.tagline}
          </Typography>
          {list && <StatusLine status={status} resource={resource} now={now} />}
        </Titles>
      </Head>
      {!list && <StatusLine status={status} resource={resource} now={now} />}
      <Actions onClick={stop}>
        <Button
          variant="contained"
          size="small"
          startIcon={<OpenInNewOutlined />}
          onClick={() => onOpen(app.name)}
          sx={{ flex: list ? '0 0 auto' : 1 }}
        >
          Open
        </Button>
        <Tooltip title={favourite ? 'Remove from favourites' : 'Add to favourites'}>
          <IconButton
            size="small"
            aria-label={favourite ? `Remove ${app.name} from favourites` : `Add ${app.name} to favourites`}
            aria-pressed={favourite}
            onClick={() => onToggleFavourite(app.name)}
            color={favourite ? 'primary' : 'default'}
          >
            {favourite ? <StarRounded /> : <StarOutlineRounded />}
          </IconButton>
        </Tooltip>
      </Actions>
    </Root>
  );
}
