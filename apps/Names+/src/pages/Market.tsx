import { Box, TextField } from '@mui/material';
import { ForSaleTable } from '../components/Tables/ForSaleTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  forSaleAtom,
  pendingTxsAtom,
  primaryNameAtom,
} from '../state/global/names';
import { useAtom } from 'jotai';
import { SortBy, SortDirection } from '../interfaces';
import { useTranslation } from 'react-i18next';

export const Market = () => {
  const { t } = useTranslation(['core']);

  const [namesForSale] = useAtom(forSaleAtom);
  const [pendingTxs] = useAtom(pendingTxsAtom);
  const [primaryName] = useAtom(primaryNameAtom);

  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterValue, setFilterValue] = useState('');
  const [value, setValue] = useState('');
  const namesForSaleFiltered = useMemo(() => {
    const lowerFilter = filterValue.trim().toLowerCase();

    const filtered = !lowerFilter
      ? namesForSale
      : namesForSale.filter((item) =>
          item.name.toLowerCase().includes(lowerFilter)
        );

    return [...filtered].sort((a, b) => {
      let aVal: string | number = a[sortBy];
      let bVal: string | number = b[sortBy];

      // Convert salePrice strings to numbers for comparison
      if (sortBy === 'salePrice') {
        aVal = parseFloat(aVal as string);
        bVal = parseFloat(bVal as string);
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  }, [namesForSale, sortBy, sortDirection, filterValue]);

  const isPrimaryNameForSale = useMemo(() => {
    if (!primaryName) return false;
    const findPendingNameSellTx = pendingTxs?.['SELL_NAME'];
    let isOnSale = false;
    if (findPendingNameSellTx) {
      Object.values(findPendingNameSellTx).forEach((value) => {
        if (value?.name === primaryName) {
          isOnSale = true;
          return;
        }
      });
    }
    if (isOnSale) return true;
    const findNameIndex = namesForSale?.findIndex(
      (item) => item?.name === primaryName
    );
    if (findNameIndex === -1) return false;
    return true;
  }, [namesForSale, primaryName, pendingTxs]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setFilterValue(value);
    }, 500);

    // Cleanup timeout if searchValue changes before the timeout completes
    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  const handleSort = useCallback(
    (field: SortBy) => {
      if (sortBy === field) {
        // Toggle direction
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        // Change field and reset direction
        setSortBy(field);
        setSortDirection('asc');
      }
    },
    [sortBy]
  );

  return (
    <div>
      <Box
        sx={{
          width: '100%',
          height: '60px',
          padding: '10px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
        }}
      >
        <TextField
          placeholder={t('core:inputs.filter_names', {
            postProcess: 'capitalizeFirstChar',
          })}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="small"
        />
      </Box>
      <ForSaleTable
        namesForSale={namesForSaleFiltered}
        sortBy={sortBy}
        sortDirection={sortDirection}
        handleSort={handleSort}
        isPrimaryNameForSale={isPrimaryNameForSale}
      />
    </div>
  );
};
