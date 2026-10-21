/**
 * One asset's own popup (Simon, 2026-10-21: "when clicking on each asset it
 * gets its own popup overview window"), from the Assets tab, the Overview's
 * Q-Assets or a link with `?asset=<id>`: its avatar, number, owner and
 * marks; its description as its owner wrote it; what this account holds of
 * it and its share; how much there is, and that it is indivisible when it
 * is; its last trade price and what the holding is worth at it; its biggest
 * holders, this account marked and where it stands; and its latest trades
 * with QORT, who bought from whom. The holders and the trades are read when it opens
 * (data/explorer/assets.ts); the rest is the tab's. Its transactions with
 * this account are the Transactions tab, searched for the asset's name.
 */
import { useId, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { PersonInline } from '../../../../components/common/Person';
import { ErrorState } from '../../../../components/common/states';
import { AssetAvatar } from '../../../../components/explorer/AssetAvatar';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { StatusChip } from '../../../../components/explorer/StatusChip';
import {
  dealsKey,
  getAssetDeals,
  getTopHolders,
  holdersKey,
} from '../../../../data/explorer/assets';
import { useQuery } from '../../../../hooks/useQuery';
import {
  amountWords,
  quantityWords,
  shareOf,
  shareWords,
  type AssetDeal,
  type AssetView,
} from '../../../../rules/explorer/assets';
import { explorerAccountPath } from '../../../../routes/paths';
import { formatDate } from '../../../../utils/format';
import { AssetChips, ShareBar } from './AssetItems';
import { assetAccent } from './assetAccent';
import {
  INDIVISIBLE_EXPLANATION,
  INDIVISIBLE_WORDS,
  NEVER_TRADED,
  priceWords,
  rankLine,
  worthWords,
} from './assetsWords';

/** Holders shown at first; the rest of those read on request. */
const HOLDERS_SHOWN = 10;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={FIELD_BLOCK_SX}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function Loading({ words }: { words: string }) {
  return (
    <Typography component="div">
      <Skeleton variant="text" width="70%" aria-hidden />
      <Skeleton variant="text" width="50%" aria-hidden />
      <Box component="span" sx={visuallyHidden}>
        {words}
      </Box>
    </Typography>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <Typography id={id} component="h3" sx={{ fontWeight: 700, fontSize: 17, mt: 1 }}>
      {children}
    </Typography>
  );
}

function Holders({ address, asset }: { address: string; asset: AssetView }) {
  const holders = useQuery(holdersKey(asset.assetId), (force) =>
    getTopHolders(asset.assetId, { force })
  );
  const [all, setAll] = useState(false);
  const headingId = useId();
  let body: React.ReactNode;
  if (holders.isError && !holders.data)
    body = (
      <ErrorState
        compact
        title="Couldn’t read its holders."
        error={holders.error}
        onRetry={() => void holders.refetch()}
      />
    );
  else if (!holders.data) body = <Loading words="Reading its holders" />;
  else {
    const { rows, truncated } = holders.data;
    const index = rows.findIndex((row) => row.address === address);
    const shown = all ? rows : rows.slice(0, HOLDERS_SHOWN);
    const quantity = asset.meta?.quantity;
    body = (
      <>
        <Typography variant="body2" color="text.secondary">
          This account: {rankLine(index < 0 ? null : index + 1, rows.length, truncated)}
        </Typography>
        <Box component="ol" aria-labelledby={headingId} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {shown.map((row, i) => {
            const share = quantity ? shareOf(row.balance, quantity) : undefined;
            const self = row.address === address;
            return (
              <Box
                component="li"
                key={row.address}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  columnGap: 1,
                  rowGap: 0.25,
                  py: 0.75,
                  borderTop: i ? 1 : 0,
                  borderColor: 'divider',
                  fontWeight: self ? 700 : 400,
                }}
              >
                <Typography
                  component="span"
                  color="text.secondary"
                  sx={{ minWidth: 32, fontVariantNumeric: 'tabular-nums' }}
                >
                  #{i + 1}
                </Typography>
                <Box sx={{ minWidth: 0, flex: '1 1 160px' }}>
                  <PersonInline address={row.address} />
                </Box>
                {self ? <StatusChip label="This account" kind="plain" explain={null} /> : null}
                <Typography
                  component="span"
                  sx={{ fontWeight: 'inherit', fontVariantNumeric: 'tabular-nums', ml: 'auto' }}
                >
                  {amountWords(row.balance)}
                  {share !== undefined ? (
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                      {' · '}
                      {shareWords(share)}
                    </Box>
                  ) : null}
                </Typography>
              </Box>
            );
          })}
        </Box>
        {rows.length > HOLDERS_SHOWN ? (
          <Box>
            <Button onClick={() => setAll(!all)} sx={{ minHeight: 44 }}>
              {all ? 'Show the first 10' : `Show all ${rows.length}`}
            </Button>
          </Box>
        ) : null}
      </>
    );
  }
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Heading id={headingId}>Biggest holders</Heading>
      {body}
    </Box>
  );
}

function DealLine({ deal, name }: { deal: AssetDeal; name: string }) {
  const perUnit = deal.units > 0n ? (deal.qort * 100_000_000n) / deal.units : 0n;
  return (
    <>
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        <PersonInline address={deal.buyer} /> bought {amountWords(deal.units)}{' '}
        <bdi dir="auto">{name}</bdi> from <PersonInline address={deal.seller} /> for{' '}
        {amountWords(deal.qort)} QORT
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {priceWords({ perUnit, units: deal.units, qort: deal.qort, at: deal.at })} ·{' '}
        {formatDate(deal.at)}
      </Typography>
    </>
  );
}

function Deals({ asset }: { asset: AssetView }) {
  const deals = useQuery(dealsKey(asset.assetId), (force) =>
    getAssetDeals(asset.assetId, { force })
  );
  const headingId = useId();
  let body: React.ReactNode;
  if (deals.isError && !deals.data)
    body = (
      <ErrorState
        compact
        title="Couldn’t read its trades."
        error={deals.error}
        onRetry={() => void deals.refetch()}
      />
    );
  else if (!deals.data) body = <Loading words="Reading its trades" />;
  else if (!deals.data.length)
    body = (
      <Typography variant="body2" color="text.secondary">
        {NEVER_TRADED}.
      </Typography>
    );
  else
    body = (
      <Box component="ul" aria-labelledby={headingId} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {deals.data.map((deal, i) => (
          <Box
            component="li"
            key={`${deal.orderId}:${deal.at}:${i}`}
            sx={{ py: 0.75, borderTop: i ? 1 : 0, borderColor: 'divider' }}
          >
            <DealLine deal={deal} name={asset.name} />
          </Box>
        ))}
      </Box>
    );
  return (
    <Box component="section" aria-labelledby={headingId}>
      <Heading id={headingId}>Latest trades with QORT</Heading>
      {body}
    </Box>
  );
}

export function AssetDialog({
  address,
  asset,
  onClose,
}: {
  address: string;
  asset: AssetView;
  onClose: () => void;
}) {
  const theme = useTheme();
  const location = useLocation();
  const accent = assetAccent(theme, asset.assetId);
  const meta = asset.meta;
  const transactions = `${explorerAccountPath(address, 'transactions')}?q=${encodeURIComponent(asset.name)}`;
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={<bdi dir="auto">{asset.name}</bdi>}
      maxWidth="sm"
      actions={
        <>
          <Button
            component={RouterLink}
            to={transactions}
            replace
            state={location.state}
            startIcon={<ReceiptLongOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Find in its transactions
          </Button>
          <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <AssetAvatar asset={{ ...asset, owner: meta?.owner }} size={72} badge />
          <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Asset #{asset.assetId}
              {meta?.owner ? (
                <>
                  {' · owned by '}
                  <PersonInline address={meta.owner} />
                </>
              ) : null}
            </Typography>
            <AssetChips meta={meta} owned={asset.owned} />
          </Box>
        </Box>
        {meta?.description ? (
          <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            <bdi dir="auto">{meta.description}</bdi>
          </Typography>
        ) : null}
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          <Fact label="This account holds">
            {asset.balance > 0n ? amountWords(asset.balance) : 'None'}
          </Fact>
          <Fact label="Its share of all">
            {asset.share !== undefined ? (
              <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShareBar share={asset.share} accent={accent} />
                {shareWords(asset.share)}
              </Box>
            ) : (
              '–'
            )}
          </Fact>
          <Fact label="All there is">{meta ? quantityWords(meta.quantity) : '–'}</Fact>
          {meta && !meta.isDivisible ? (
            <Fact label={INDIVISIBLE_WORDS}>{INDIVISIBLE_EXPLANATION}</Fact>
          ) : null}
          <Fact label="Last trade">
            {asset.price
              ? `${priceWords(asset.price)}, ${formatDate(asset.price.at)}`
              : NEVER_TRADED}
          </Fact>
          {asset.worth !== undefined ? (
            <Fact label="Its holding at that price">{worthWords(asset.worth)}</Fact>
          ) : null}
        </Box>
        <Holders address={address} asset={asset} />
        <Deals asset={asset} />
      </Box>
    </ResponsiveDialog>
  );
}
