/**
 * "How it adds up": the summary's "Buyers would pay now", asset by asset
 * (Simon, 2026-10-21: "also add realistic sale amount with its own window
 * next to it"). Each holding sold into the open buy orders on chain, the
 * best price first, until it or the buyers run out, the account's own buy
 * orders left out: what it would fetch, for how much of the holding, and the
 * best offer, beside its worth at its last trade, the most first. Nothing is
 * sold; only the orders are read (the tab's reads). An asset opens its own
 * window from here.
 */
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { AssetAvatar } from '../../../../components/explorer/AssetAvatar';
import {
  amountWords,
  assetsTotals,
  qortWords,
  sortAssets,
  type AssetView,
} from '../../../../rules/explorer/assets';
import { assetAccent } from './assetAccent';
import {
  bestOfferWords,
  LAST_TRADE_LABEL,
  NEVER_TRADED,
  SALE_EXPLANATION,
  saleDetail,
  saleWords,
  worthWords,
} from './assetsWords';

function Row({
  view,
  total,
  onOpen,
}: {
  view: AssetView;
  /** Everything buyers would pay together, for the bar. */
  total: bigint;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const accent = assetAccent(theme, view.assetId);
  const sale = view.sale;
  const fraction = sale && total > 0n ? Number((sale.qort * 10_000n) / total) / 10_000 : 0;
  const detail = sale ? [saleDetail(sale, view.balance), bestOfferWords(sale)].filter(Boolean) : [];
  return (
    <Box
      component="li"
      sx={{ borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 } }}
    >
      <ButtonBase
        onClick={onOpen}
        aria-haspopup="dialog"
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          columnGap: 1.25,
          rowGap: 0.25,
          py: 1,
          px: 0.5,
          textAlign: 'left',
          borderRadius: 1,
          '&:hover': { bgcolor: alpha(accent, 0.06) },
          '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}` },
        }}
      >
        <AssetAvatar asset={{ ...view, owner: view.meta?.owner }} size={36} />
        <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
          <Typography
            component="span"
            sx={{ display: 'block', fontWeight: 700, overflowWrap: 'anywhere' }}
          >
            <bdi dir="auto">{view.name}</bdi>
          </Typography>
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            Holds {amountWords(view.balance)}
            {detail.length ? ` · ${detail.join(' · ')}` : ''}
          </Typography>
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block' }}
          >
            {LAST_TRADE_LABEL}: {view.worth !== undefined ? worthWords(view.worth) : NEVER_TRADED}
          </Typography>
        </Box>
        <Typography
          component="span"
          sx={{
            fontWeight: sale?.sold ? 700 : 400,
            color: sale?.sold ? 'text.primary' : 'text.secondary',
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right',
          }}
        >
          {sale ? saleWords(sale) : '–'}
        </Typography>
        <Box
          component="span"
          aria-hidden
          sx={{
            gridColumn: '2 / 4',
            height: 4,
            borderRadius: 999,
            bgcolor: alpha(accent, 0.15),
            overflow: 'hidden',
            display: fraction > 0 ? 'block' : 'none',
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'block',
              height: '100%',
              width: `${Math.max(fraction * 100, 1)}%`,
              bgcolor: accent,
            }}
          />
        </Box>
      </ButtonBase>
    </Box>
  );
}

export function SaleDialog({
  views,
  onClose,
  onOpenAsset,
}: {
  views: readonly AssetView[];
  onClose: () => void;
  /** Opens an asset's own window (this one closes). */
  onOpenAsset: (assetId: number) => void;
}) {
  const totals = assetsTotals(views);
  const sorted = sortAssets(views, 'sale');
  return (
    <ResponsiveDialog open onClose={onClose} title="What buyers would pay now" maxWidth="sm">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography color="text.secondary">{SALE_EXPLANATION}</Typography>
        <Box
          sx={(theme) => ({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            columnGap: 2,
            rowGap: 0.5,
            p: 1.5,
            borderRadius: 1,
            bgcolor: alpha(
              theme.palette.text.primary,
              theme.palette.mode === 'dark' ? 0.06 : 0.045
            ),
          })}
        >
          <Typography sx={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
            {totals.saleAtLeast ? 'at least ' : ''}≈ {qortWords(totals.sale)} QORT
          </Typography>
          {totals.priced ? (
            <Typography variant="body2" color="text.secondary">
              At their last trades ≈ {qortWords(totals.worth)} QORT
            </Typography>
          ) : null}
        </Box>
        <Box
          component="ul"
          aria-label="What buyers would pay for each"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {sorted.map((view) => (
            <Row
              key={view.assetId}
              view={view}
              total={totals.sale}
              onOpen={() => onOpenAsset(view.assetId)}
            />
          ))}
        </Box>
      </Box>
    </ResponsiveDialog>
  );
}
