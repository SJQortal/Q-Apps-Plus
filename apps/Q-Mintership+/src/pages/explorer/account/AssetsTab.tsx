/**
 * The account's Q-Assets (Simon, 2026-10-21: "a new tab to Explorer called
 * Assets, and it will be an overview of the Q-Assets the account is
 * holding … make it super nice visually, with asset avatars"). On top, a
 * summary: how many it holds, what they are worth at their last trades
 * with QORT, how many assets it owns, and how that worth splits. Then each
 * asset it holds as a card (the default) or a row, kept on this device,
 * searched and sorted (worth most first), 24 at a time; then the assets it
 * owns and holds none of. Opening one shows its details (AssetDialog); the
 * open asset and the search are in the URL (`?asset=<id>&q=…`), so a copied
 * link opens them too.
 *
 * Reads: its holdings, Core's asset list, their last trades with QORT and
 * the asset avatars the Q-Assets app published (data/explorer/assets.ts);
 * an opened asset's holders and trades. QORT itself is its balance (the
 * Overview), not a Q-Asset. Nothing polls; nothing writes.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { Section } from '../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../components/common/states';
import { AssetAvatar } from '../../../components/explorer/AssetAvatar';
import { RowSearchField } from '../../../components/explorer/search/RowSearchField';
import { useViewState } from '../../../hooks/useViewState';
import {
  ASSET_SORTS,
  isAssetSort,
  matchesAsset,
  quantityWords,
  sortAssets,
  type AssetMeta,
  type AssetSort,
} from '../../../rules/explorer/assets';
import { appParam } from '../../../routes/hubLocation';
import { formatCount } from '../../../utils/format';
import { AssetDialog } from './assets/AssetDialog';
import { AssetCard, AssetChips, AssetRow, type SaleState } from './assets/AssetItems';
import { AssetsSummary } from './assets/AssetsSummary';
import { assetsTitle, NO_ASSETS, ownedTitle, showMoreWords } from './assets/assetsWords';
import { useAssets } from './assets/useAssets';
import { useOpenAsset } from './assets/useOpenAsset';
import { useListView } from './useListView';
import { ViewToggle } from './ViewToggle';

/** Assets shown at first, and added by each "Show the next". */
export const ASSETS_PAGE = 24;

/** An asset it owns and holds none of: avatar, name (opens it), all there is and its marks. */
function OwnedRow({ meta, onOpen }: { meta: AssetMeta; onOpen: () => void }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1.25,
        rowGap: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0 },
      }}
    >
      <AssetAvatar asset={meta} size={36} />
      <Button
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`${meta.name}: details`}
        sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700, px: 1, minWidth: 0 }}
      >
        <bdi dir="auto">{meta.name}</bdi>
      </Button>
      <Typography variant="body2" color="text.secondary">
        #{meta.assetId} · {quantityWords(meta.quantity)} in all
      </Typography>
      <AssetChips meta={meta} owned={false} />
    </Box>
  );
}

export default function AssetsTab({ address }: { address: string }) {
  const { holdings, list, prices, sales, views, owned } = useAssets(address);
  const [params, setParams] = useSearchParams();
  const [view, setView] = useListView('assets');
  const [sort, setSort] = useViewState<AssetSort>('assets:sort', 'worth');
  const [shown, setShown] = useViewState('assets:shown', ASSETS_PAGE);
  const search = appParam(params, 'q') ?? '';
  const { open, setOpen } = useOpenAsset(address, views, list.data);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (value) out.set(key, value);
        else out.delete(key);
        return out;
      },
      { replace: true }
    );

  const sorted = useMemo(
    () =>
      views
        ? sortAssets(
            views.filter((v) => matchesAsset(v, search)),
            sort
          )
        : [],
    [views, search, sort]
  );

  if (holdings.isError && !holdings.data)
    return (
      <ErrorState
        title="Couldn’t load its Q-Assets."
        error={holdings.error}
        onRetry={() => void holdings.refetch()}
      />
    );
  if (!holdings.data || !views) return <ListSkeleton count={3} label="Loading its Q-Assets" />;

  const ownedCount = owned ? owned.length + views.filter((v) => v.owned).length : undefined;
  const page = sorted.slice(0, shown);
  const listFailed = list.isError && !list.data;
  const saleState: SaleState = sales.data ? 'read' : sales.isError ? 'failed' : 'reading';

  return (
    <>
      <Section title={assetsTitle(views.length)} id="assets-held">
        {views.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <AssetsSummary
              views={views}
              ownedCount={ownedCount}
              prices={prices}
              sales={sales}
              onOpenAsset={setOpen}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
              <RowSearchField
                value={search}
                onChange={(next) => setParam('q', next.trim() || null)}
                placeholder="Search these assets"
                label="Search this account’s Q-Assets: a name or a number"
              />
              <TextField
                select
                label="Sort"
                size="small"
                value={sort}
                onChange={(e) => {
                  if (isAssetSort(e.target.value)) setSort(e.target.value);
                }}
                slotProps={{ select: { native: true } }}
                sx={{
                  flex: '1 1 200px',
                  maxWidth: { sm: 260 },
                  '& .MuiInputBase-root': { minHeight: 44 },
                }}
              >
                {ASSET_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </TextField>
              <ViewToggle view={view} onView={setView} label="Show the assets as" />
            </Box>
            {search.trim() ? (
              <Typography role="status" variant="body2" color="text.secondary">
                {sorted.length
                  ? `${formatCount(sorted.length)} of ${formatCount(views.length)} match “${search.trim()}”.`
                  : `None of its assets matches “${search.trim()}”.`}
              </Typography>
            ) : null}
            {page.length ? (
              <Box
                component="ul"
                aria-label="Its Q-Assets"
                sx={
                  view === 'grid'
                    ? {
                        listStyle: 'none',
                        m: 0,
                        p: 0,
                        display: 'grid',
                        gap: 1.5,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))',
                      }
                    : { listStyle: 'none', m: 0, p: 0 }
                }
              >
                {page.map((item) =>
                  view === 'grid' ? (
                    <AssetCard
                      key={item.assetId}
                      view={item}
                      onOpen={() => setOpen(item.assetId)}
                      saleState={saleState}
                    />
                  ) : (
                    <AssetRow
                      key={item.assetId}
                      view={item}
                      onOpen={() => setOpen(item.assetId)}
                      saleState={saleState}
                    />
                  )
                )}
              </Box>
            ) : null}
            {sorted.length > page.length ? (
              <Box>
                <Button onClick={() => setShown(shown + ASSETS_PAGE)} sx={{ minHeight: 44 }}>
                  {showMoreWords(sorted.length - page.length, ASSETS_PAGE)}
                </Button>
              </Box>
            ) : null}
            {holdings.data.truncated ? (
              <Typography variant="body2" color="text.secondary">
                It holds more than {formatCount(holdings.data.rows.length)} Q-Assets: the first{' '}
                {formatCount(holdings.data.rows.length)} Core lists are here.
              </Typography>
            ) : null}
            {listFailed ? (
              <ErrorState
                compact
                title="Couldn’t read Core’s list of assets: owners and shares are missing."
                error={list.error}
                onRetry={() => void list.refetch()}
              />
            ) : null}
          </Box>
        ) : (
          <EmptyState title={NO_ASSETS} />
        )}
      </Section>
      {owned?.length ? (
        <Section title={ownedTitle(owned.length)} id="assets-owned">
          <Box
            component="ul"
            aria-label="Assets it owns, holding none"
            sx={{ listStyle: 'none', m: 0, p: 0 }}
          >
            {owned.map((meta) => (
              <OwnedRow key={meta.assetId} meta={meta} onOpen={() => setOpen(meta.assetId)} />
            ))}
          </Box>
        </Section>
      ) : null}
      {open ? <AssetDialog address={address} asset={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
