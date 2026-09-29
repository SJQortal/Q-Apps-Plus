import { useState } from 'react';
import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAtom, useSetAtom } from 'jotai';
import { Virtuoso } from 'react-virtuoso';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { dismissToast, showError, showLoading, showSuccess, useQortBalance } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import {
  forSaleAtom,
  ListStatus,
  namesAtom,
  NamesForSale,
  pendingTxsAtom,
} from '../../state/global/names';
import { useUnitFee } from '../../hooks/useNamesApi';
import { formatDate, formatQort, shortAddress } from '../../utils/format';
import {
  EmptyState,
  ErrorState,
  ListCard,
  Row,
  RowActions,
  RowMain,
  RowMeta,
  RowSkeletons,
  RowTitle,
} from '../names/ListStates';

const Price = styled('div')(({ theme }) => ({
  fontWeight: 700,
  fontSize: 15,
  whiteSpace: 'nowrap',
  color: theme.palette.text.primary,
  [theme.breakpoints.down('sm')]: { fontSize: 14 },
}));

const Summary = styled('dl')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(0.75),
  margin: theme.spacing(1, 0, 0),
  '& dt': { color: theme.palette.text.secondary },
  '& dd': { margin: 0, textAlign: 'right', fontWeight: 600 },
}));

interface ForSaleListProps {
  rows: NamesForSale[];
  status: ListStatus;
  filter: string;
  isPrimaryNameForSale: boolean;
  onRetry: () => void;
}

export const ForSaleList = ({ rows, status, filter, isPrimaryNameForSale, onRetry }: ForSaleListProps) => {
  const { t } = useTranslation(['core']);
  const [names, setNames] = useAtom(namesAtom);
  const setNamesForSale = useSetAtom(forSaleAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const [buying, setBuying] = useState<NamesForSale | null>(null);
  const cap = { postProcess: 'capitalizeFirstChar' as const };

  const ownedNames = new Set(names.map((item) => item.name));
  const pendingBuys = new Set(
    Object.values(pendingTxs['BUY_NAME'] ?? {}).map((tx) => tx.name)
  );

  // The purchase itself is the original app's code: BUY_NAME, then a pending
  // transaction whose callback moves the name into "my names" once confirmed.
  const handleBuy = async (name: string) => {
    const loadId = showLoading(t('core:market.responses.loading', cap));
    try {
      const res = await qortalRequest({
        action: 'BUY_NAME',
        nameForSale: name,
      });
      showSuccess(t('core:market.responses.success', cap));
      setPendingTxs((prev) => {
        return {
          ...prev,
          ['BUY_NAME']: {
            ...(prev['BUY_NAME'] || {}),
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNamesForSale((prev) => prev.filter((item) => item?.name !== res.name));
                setNames((prev) => [
                  ...prev,
                  {
                    name: res.name,
                    owner: res.creatorAddress,
                  },
                ]);
              },
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(t('core:market.responses.error', cap));
    } finally {
      dismissToast(loadId);
    }
  };

  let body;
  if (status === 'loading' && rows.length === 0) {
    body = <RowSkeletons />;
  } else if (status === 'error' && rows.length === 0) {
    body = (
      <ErrorState
        message={t('core:market.error', cap)}
        retryLabel={t('core:actions.retry', cap)}
        onRetry={onRetry}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState
        icon={<StorefrontOutlinedIcon />}
        title={
          filter.trim()
            ? t('core:market.empty_filter', { filter: filter.trim(), ...cap })
            : t('core:market.empty', cap)
        }
      />
    );
  } else {
    body = (
      <Virtuoso
        data={rows}
        style={{ flex: 1 }}
        computeItemKey={(_index, row) => row.name}
        itemContent={(_index, row) => {
          const owned = ownedNames.has(row.name);
          const pending = pendingBuys.has(row.name);
          const meta = [
            row.owner ? shortAddress(row.owner) : '',
            row.registered ? formatDate(row.registered) : '',
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Row>
              <Avatar
                sx={{ width: 40, height: 40 }}
                src={`/arbitrary/THUMBNAIL/${encodeURIComponent(row.name)}/qortal_avatar`}
                alt=""
                slotProps={{ img: { loading: 'lazy' } }}
              >
                {row.name.charAt(0)}
              </Avatar>
              <RowMain>
                <RowTitle>{row.name}</RowTitle>
                {meta ? <RowMeta>{meta}</RowMeta> : null}
              </RowMain>
              <Price>{formatQort(row.salePrice)} QORT</Price>
              <RowActions>
                <Button
                  variant="contained"
                  size="small"
                  disabled={isPrimaryNameForSale || owned || pending}
                  onClick={() => setBuying(row)}
                >
                  {pending ? t('core:names.pending', cap) : t('core:actions.buy', cap)}
                </Button>
              </RowActions>
            </Row>
          );
        }}
      />
    );
  }

  return (
    <>
      <ListCard>{body}</ListCard>
      {buying ? (
        <BuyNameDialog
          row={buying}
          onClose={() => setBuying(null)}
          onConfirm={() => {
            const name = buying.name;
            setBuying(null);
            void handleBuy(name);
          }}
        />
      ) : null}
    </>
  );
};

function BuyNameDialog({
  row,
  onClose,
  onConfirm,
}: {
  row: NamesForSale;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation(['core']);
  const cap = { postProcess: 'capitalizeFirstChar' as const };
  const fee = useUnitFee('BUY_NAME');
  const { value: balance } = useQortBalance();
  const price = Number(row.salePrice);
  const total = fee === null ? null : price + fee;
  const short = typeof balance === 'number' && total !== null && balance < total;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="buy-name-title">
      <DialogTitle id="buy-name-title">
        {t('core:market.buy_title', { name: row.name, ...cap })}
      </DialogTitle>
      <DialogContent>
        <Summary>
          <dt>{t('core:market.price', cap)}</dt>
          <dd>{formatQort(price)} QORT</dd>
          <dt>{t('core:market.fee', cap)}</dt>
          <dd>{fee === null ? '…' : `${formatQort(fee)} QORT`}</dd>
          <dt>{t('core:market.total', cap)}</dt>
          <dd>{total === null ? '…' : `${formatQort(total)} QORT`}</dd>
          <dt>{t('core:market.balance', cap)}</dt>
          <dd>{typeof balance === 'number' ? `${formatQort(balance)} QORT` : '…'}</dd>
        </Summary>
        <Typography
          variant="body2"
          color={short ? 'error' : 'text.secondary'}
          sx={{ mt: 2 }}
        >
          {short ? t('core:market.insufficient', cap) : t('core:market.buy_confirm', cap)}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('core:actions.cancel', cap)}</Button>
        <Button variant="contained" disabled={short} onClick={onConfirm} autoFocus>
          {t('core:actions.confirm_buy', { price: formatQort(price) })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
