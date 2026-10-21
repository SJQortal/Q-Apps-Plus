/**
 * The Overview's Q-Assets, under At a glance (Simon, 2026-10-21: "in
 * overview a quick list of Q-Assets as well, under At a glance"): the ones
 * it holds, worth most first, as small tiles (avatar, name, how much, what
 * it is worth at its last trade), the first QUICK_ASSETS; each opens in the
 * Assets tab, and "All N in Assets" opens the tab. The same reads as the tab
 * (assets/useAssets.ts), so opening it costs nothing more. It loads, fails
 * and retries on its own.
 */
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { AssetAvatar } from '../../../../components/explorer/AssetAvatar';
import { amountWords, sortAssets, type AssetView } from '../../../../rules/explorer/assets';
import { explorerAccountPath } from '../../../../routes/paths';
import { assetAccent } from '../assets/assetAccent';
import { NO_ASSETS, worthWords } from '../assets/assetsWords';
import { useAssets } from '../assets/useAssets';
import { TabButton } from './TabLink';

/** Tiles shown on the Overview. */
export const QUICK_ASSETS = 6;

const GRID_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'grid',
  gap: 1,
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 210px), 1fr))',
} as const;

function Tile({ address, view }: { address: string; view: AssetView }) {
  const theme = useTheme();
  const location = useLocation();
  const accent = assetAccent(theme, view.assetId);
  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      <Box
        component={RouterLink}
        to={`${explorerAccountPath(address, 'assets')}?asset=${view.assetId}`}
        replace
        state={location.state}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          p: 1.25,
          minHeight: 44,
          minWidth: 0,
          height: '100%',
          boxSizing: 'border-box',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          bgcolor: 'background.paper',
          backgroundImage: `linear-gradient(90deg, ${alpha(accent, 0.1)} 0, transparent 70%)`,
          color: 'text.primary',
          textDecoration: 'none',
          transition: 'border-color 160ms ease',
          '&:hover': { borderColor: alpha(accent, 0.6) },
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <AssetAvatar asset={{ ...view, owner: view.meta?.owner }} size={40} />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <bdi dir="auto">{view.name}</bdi>
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
          >
            {amountWords(view.balance)}
            {view.worth !== undefined ? (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {' · '}
                {worthWords(view.worth)}
              </Box>
            ) : null}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function AssetsSection({ address }: { address: string }) {
  const { holdings, views } = useAssets(address);
  let body: React.ReactNode;
  if (holdings.isError && !holdings.data)
    body = (
      <ErrorState
        compact
        title="Couldn’t load its Q-Assets."
        error={holdings.error}
        onRetry={() => void holdings.refetch()}
      />
    );
  else if (!views)
    body = (
      <Box sx={GRID_SX}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={64} aria-hidden />
        ))}
        <Box component="span" sx={visuallyHidden}>
          Loading its Q-Assets
        </Box>
      </Box>
    );
  else if (!views.length)
    body = (
      <Typography color="text.secondary" sx={{ py: 0.5 }}>
        {NO_ASSETS}
      </Typography>
    );
  else
    body = (
      <>
        <Box component="ul" aria-label="Its Q-Assets, worth most first" sx={GRID_SX}>
          {sortAssets(views, 'worth')
            .slice(0, QUICK_ASSETS)
            .map((view) => (
              <Tile key={view.assetId} address={address} view={view} />
            ))}
        </Box>
        <Box sx={{ mt: 1 }}>
          <TabButton address={address} tab="assets">
            {views.length > QUICK_ASSETS ? `All ${views.length} in Assets` : 'Open Assets'}
          </TabButton>
        </Box>
      </>
    );
  return (
    <Section title="Q-Assets" id="overview-assets">
      <Card>{body}</Card>
    </Section>
  );
}
