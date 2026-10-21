/**
 * One held asset, as a card (the grid) or a row (the list): its avatar with
 * its owner's on the edge, its name and number, how much the account holds
 * and its share of all there is (a bar in the asset's own colour), and its
 * last trade price with what the holding is worth at it. Its name is the
 * button that opens it (AssetDialog); the button stretches over the whole
 * card or row, so anywhere on it opens it, while the rest reads as text.
 */
import type { ReactNode } from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { AssetAvatar } from '../../../../components/explorer/AssetAvatar';
import { StatusChip } from '../../../../components/explorer/StatusChip';
import { usePrimaryName } from '../../../../hooks/useData';
import {
  amountWords,
  quantityWords,
  shareWords,
  type AssetMeta,
  type AssetView,
} from '../../../../rules/explorer/assets';
import { formatDate, shortAddress } from '../../../../utils/format';
import { assetAccent } from './assetAccent';
import {
  NEVER_TRADED,
  OWNS_EXPLANATION,
  OWNS_WORDS,
  priceWords,
  UNSPENDABLE_EXPLANATION,
  UNSPENDABLE_WORDS,
  WHOLE_EXPLANATION,
  WHOLE_WORDS,
  worthWords,
} from './assetsWords';

/** "by Pia Promote": the owner's primary name, or its short address. */
export function OwnerWords({ owner }: { owner: string }) {
  const name = usePrimaryName(owner).data;
  return <bdi dir="auto">{name || shortAddress(owner)}</bdi>;
}

/** Its marks: the account's own asset, whole units only, can't be sent. Above the stretched button. */
export function AssetChips({ meta, owned }: { meta?: AssetMeta; owned: boolean }) {
  const chips: ReactNode[] = [];
  if (owned)
    chips.push(<StatusChip key="own" label={OWNS_WORDS} kind="owner" explain={OWNS_EXPLANATION} />);
  if (meta && !meta.isDivisible)
    chips.push(
      <StatusChip key="whole" label={WHOLE_WORDS} kind="plain" explain={WHOLE_EXPLANATION} />
    );
  if (meta?.isUnspendable)
    chips.push(
      <StatusChip
        key="unspendable"
        label={UNSPENDABLE_WORDS}
        kind="plain"
        explain={UNSPENDABLE_EXPLANATION}
      />
    );
  if (!chips.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, position: 'relative', zIndex: 1 }}>
      {chips}
    </Box>
  );
}

/** Its share of all there is, as a bar in its colour; the words beside it say it. */
export function ShareBar({ share, accent }: { share: number; accent: string }) {
  const width = share > 0 ? Math.max(share * 100, 2) : 0;
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        height: 6,
        borderRadius: 999,
        bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.2 : 0.16),
        overflow: 'hidden',
        flex: '1 1 auto',
        minWidth: 40,
      })}
    >
      <Box
        sx={{
          width: `${Math.min(width, 100)}%`,
          height: '100%',
          bgcolor: accent,
          borderRadius: 999,
        }}
      />
    </Box>
  );
}

/** The name, as the button that opens the asset, stretched over its card or row. */
function OpenButton({
  name,
  onOpen,
  radius = 0,
  children,
}: {
  name: string;
  onOpen: () => void;
  /** The corners of the card or row it covers. */
  radius?: number;
  children: ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${name}: details`}
      sx={(theme) => ({
        position: 'static',
        justifyContent: 'flex-start',
        textAlign: 'left',
        minHeight: 44,
        minWidth: 0,
        maxWidth: '100%',
        font: 'inherit',
        color: 'inherit',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
        },
        '&.Mui-focusVisible::after': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      })}
    >
      {children}
    </ButtonBase>
  );
}

function NameText({ name, lines = 2 }: { name: string; lines?: number }) {
  return (
    <Typography
      component="span"
      sx={{
        fontWeight: 700,
        fontSize: 17,
        lineHeight: 1.3,
        overflowWrap: 'anywhere',
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}
    >
      <bdi dir="auto">{name}</bdi>
    </Typography>
  );
}

/** "#77 · by Pia Promote". */
function IdLine({ view }: { view: AssetView }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      #{view.assetId}
      {view.meta?.owner ? (
        <>
          {' · by '}
          <OwnerWords owner={view.meta.owner} />
        </>
      ) : null}
    </Typography>
  );
}

function ShareLine({ view, accent }: { view: AssetView; accent: string }) {
  if (view.share === undefined || !view.meta) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <ShareBar share={view.share} accent={accent} />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
      >
        {shareWords(view.share)} of {quantityWords(view.meta.quantity)}
      </Typography>
    </Box>
  );
}

function PriceLine({ view }: { view: AssetView }) {
  if (!view.price || view.worth === undefined)
    return (
      <Typography variant="body2" color="text.secondary">
        {NEVER_TRADED}
      </Typography>
    );
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: 1,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {worthWords(view.worth)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {priceWords(view.price)} · {formatDate(view.price.at)}
      </Typography>
    </Box>
  );
}

export function AssetCard({ view, onOpen }: { view: AssetView; onOpen: () => void }) {
  const theme = useTheme();
  const accent = assetAccent(theme, view.assetId);
  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        p: 2,
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        backgroundImage: `linear-gradient(180deg, ${alpha(accent, 0.1)} 0, transparent 72px)`,
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': {
          borderColor: alpha(accent, 0.6),
          boxShadow: `0 2px 12px ${alpha(accent, 0.18)}`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <AssetAvatar asset={{ ...view, owner: view.meta?.owner }} size={52} badge />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <OpenButton name={view.name} onOpen={onOpen} radius={2}>
            <NameText name={view.name} />
          </OpenButton>
          <IdLine view={view} />
        </Box>
      </Box>
      <Box>
        <Typography variant="body2" color="text.secondary">
          Holds
        </Typography>
        <Typography
          sx={{
            fontSize: 26,
            fontWeight: 800,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
            overflowWrap: 'anywhere',
          }}
        >
          {amountWords(view.balance)}
        </Typography>
      </Box>
      <ShareLine view={view} accent={accent} />
      <PriceLine view={view} />
      <AssetChips meta={view.meta} owned={view.owned} />
    </Box>
  );
}

export function AssetRow({ view, onOpen }: { view: AssetView; onOpen: () => void }) {
  const theme = useTheme();
  const accent = assetAccent(theme, view.assetId);
  return (
    <Box
      component="li"
      sx={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: {
          xs: 'auto minmax(0, 1fr) auto',
          md: 'auto minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) auto',
        },
        alignItems: 'center',
        columnGap: 1.5,
        rowGap: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0 },
        '&:hover': { bgcolor: alpha(accent, 0.05) },
      }}
    >
      <AssetAvatar asset={{ ...view, owner: view.meta?.owner }} size={40} />
      <Box sx={{ minWidth: 0 }}>
        <OpenButton name={view.name} onOpen={onOpen}>
          <NameText name={view.name} lines={1} />
        </OpenButton>
        <IdLine view={view} />
      </Box>
      <Box
        sx={{
          minWidth: 0,
          gridColumn: { xs: '2 / 3', md: 'auto' },
          gridRow: { xs: 2, md: 'auto' },
        }}
      >
        <Typography
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}
        >
          {amountWords(view.balance)}
        </Typography>
        {view.share !== undefined ? (
          <Typography variant="body2" color="text.secondary">
            {shareWords(view.share)} of all
          </Typography>
        ) : null}
      </Box>
      <Box
        sx={{
          minWidth: 0,
          gridColumn: { xs: '2 / 3', md: 'auto' },
          gridRow: { xs: 3, md: 'auto' },
        }}
      >
        {view.worth !== undefined && view.price ? (
          <>
            <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {worthWords(view.worth)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {priceWords(view.price)}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {NEVER_TRADED}
          </Typography>
        )}
      </Box>
      <ChevronRightOutlinedIcon
        aria-hidden
        sx={{
          color: 'text.secondary',
          gridColumn: { xs: 3, md: 'auto' },
          gridRow: { xs: '1 / 2', md: 'auto' },
        }}
      />
    </Box>
  );
}
