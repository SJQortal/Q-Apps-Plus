import { useEffect, useMemo, useState } from 'react';
import { Chip, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { PendingTxsList } from '../components/Tables/PendingTxsTable';
import { ForSaleList } from '../components/Tables/ForSaleTable';
import {
  forSaleAtom,
  forSaleStatusAtom,
  pendingTxsAtom,
  primaryNameAtom,
} from '../state/global/names';
import { SortBy, SortDirection } from '../interfaces';
import { useNameData } from '../hooks/useNameData';
import {
  defaultDirection,
  filterNamesForSale,
  SORT_KEYS,
  sortNamesForSale,
} from '../utils/marketSort';

const SortRow = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
}));

const SORT_LABEL: Record<SortBy, string> = {
  name: 'name',
  salePrice: 'price',
  length: 'length',
  registered: 'newest',
};

export const Market = () => {
  const { t } = useTranslation(['core']);
  const cap = { postProcess: 'capitalizeFirstChar' as const };
  const namesForSale = useAtomValue(forSaleAtom);
  const status = useAtomValue(forSaleStatusAtom);
  const pendingTxs = useAtomValue(pendingTxsAtom);
  const primaryName = useAtomValue(primaryNameAtom);
  const { reloadNamesForSale } = useNameData();

  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterValue, setFilterValue] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setFilterValue(value), 300);
    return () => clearTimeout(handler);
  }, [value]);

  const rows = useMemo(
    () => sortNamesForSale(filterNamesForSale(namesForSale, filterValue), sortBy, sortDirection),
    [namesForSale, sortBy, sortDirection, filterValue]
  );

  // Core refuses registrations and purchases while the primary name is for sale.
  const isPrimaryNameForSale = useMemo(() => {
    if (!primaryName) return false;
    const pendingSells = Object.values(pendingTxs['SELL_NAME'] ?? {});
    if (pendingSells.some((tx) => tx.name === primaryName)) return true;
    return namesForSale.some((item) => item.name === primaryName);
  }, [namesForSale, primaryName, pendingTxs]);

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDirection(defaultDirection(field));
    }
  };

  const DirectionIcon = sortDirection === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon;

  return (
    <>
      <PageHeader
        title={t('core:header.market', cap)}
        subtitle={
          status === 'ready' || namesForSale.length > 0
            ? t('core:market.count', { count: namesForSale.length })
            : undefined
        }
      >
        <TextField
          placeholder={t('core:inputs.filter_names', cap)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="small"
          slotProps={{ htmlInput: { 'aria-label': t('core:inputs.filter_names', cap) } }}
          sx={{ ml: 'auto', minWidth: 0, maxWidth: 260 }}
        />
      </PageHeader>
      <PageBody $maxWidth={880} sx={{ flex: 1, minHeight: 0 }}>
        <PendingTxsList />
        <SortRow role="group" aria-label={t('core:market.sort_by', cap)}>
          {SORT_KEYS.map((key) => {
            const selected = sortBy === key;
            return (
              <Chip
                key={key}
                label={t(`core:market.sort.${SORT_LABEL[key]}`, cap)}
                icon={selected ? <DirectionIcon /> : undefined}
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                onClick={() => handleSort(key)}
                aria-pressed={selected}
              />
            );
          })}
        </SortRow>
        <ForSaleList
          rows={rows}
          status={status}
          filter={filterValue}
          isPrimaryNameForSale={isPrimaryNameForSale}
          onRetry={() => void reloadNamesForSale()}
        />
      </PageBody>
    </>
  );
};
