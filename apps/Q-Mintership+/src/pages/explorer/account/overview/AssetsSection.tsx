/**
 * The Overview's Q-Assets, under At a glance (Simon, 2026-10-21: "in
 * overview a quick list of Q-Assets as well, under At a glance"): the ones
 * it holds, worth most first, as small tiles (avatar, name, how much, what
 * it is worth at its last trade), the first QUICK_ASSETS. Each opens its
 * own popup right here (Simon, 2026-10-21: "when clicking on each asset it
 * gets its own popup overview window"; `?asset=<id>`, as on the tab), and
 * "All N in Assets" opens the tab. The same reads as the tab
 * (assets/useAssets.ts), so opening it costs nothing more. It loads, fails
 * and retries on its own.
 */
import { Box, ButtonBase, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { AssetAvatar } from '../../../../components/explorer/AssetAvatar';
import { amountWords, sortAssets, type AssetView } from '../../../../rules/explorer/assets';
import { AssetDialog } from '../assets/AssetDialog';
import { assetAccent } from '../assets/assetAccent';
import { NO_ASSETS, worthWords } from '../assets/assetsWords';
import { useAssets } from '../assets/useAssets';
import { useOpenAsset } from '../assets/useOpenAsset';
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

function Tile({ view, onOpen }: { view: AssetView; onOpen: () => void }) {
  const theme = useTheme();
  const accent = assetAccent(theme, view.assetId);
  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      <ButtonBase
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`${view.name}: details`}
        sx={{
          width: '100%',
          justifyContent: 'flex-start',
          textAlign: 'left',
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
          '&.Mui-focusVisible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <AssetAvatar asset={{ ...view, owner: view.meta?.owner }} size={40} />
        <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <bdi dir="auto">{view.name}</bdi>
          </Typography>
          <Typography
            component="span"
            variant="body2"
            sx={{ display: 'block', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
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
      </ButtonBase>
    </Box>
  );
}

export function AssetsSection({ address }: { address: string }) {
  const { holdings, list, views } = useAssets(address);
  const { open, setOpen } = useOpenAsset(address, views, list.data);
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
              <Tile key={view.assetId} view={view} onOpen={() => setOpen(view.assetId)} />
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
      {open ? <AssetDialog address={address} asset={open} onClose={() => setOpen(null)} /> : null}
    </Section>
  );
}
