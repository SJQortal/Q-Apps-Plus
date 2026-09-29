import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from '@mui/material';
import { useAtom, useSetAtom } from 'jotai';
import { forwardRef, useMemo } from 'react';
import { TableVirtuoso, TableComponents } from 'react-virtuoso';
import {
  forSaleAtom,
  Names,
  namesAtom,
  NamesForSale,
  pendingTxsAtom,
  PendingTxsState,
} from '../../state/global/names';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { dismissToast, showError, showLoading, showSuccess } from 'qapp-core';
import { SetStateAction } from 'jotai';
import { SortBy, SortDirection } from '../../interfaces';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';

const VirtuosoTableComponents: TableComponents<NamesForSale> = {
  Scroller: forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer component={Paper} {...props} ref={ref} />
  )),
  Table: (props) => (
    <Table
      {...props}
      sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }}
    />
  ),
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableHead {...props} ref={ref} />
  )),
  TableRow,
  TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableBody {...props} ref={ref} />
  )),
};

function fixedHeaderContent(
  sortBy: string,
  sortDirection: string,
  setSort: (field: SortBy) => void,
  t: TFunction
) {
  const renderSortIcon = (field: string) => {
    if (sortBy !== field) return null;

    return sortDirection === 'asc' ? (
      <ArrowUpwardIcon fontSize="small" sx={{ ml: 0.5 }} />
    ) : (
      <ArrowDownwardIcon fontSize="small" sx={{ ml: 0.5 }} />
    );
  };

  const sortableCellSx = {
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'action.selected',
    },
  };

  return (
    <TableRow sx={{ backgroundColor: 'background.paper' }}>
      <TableCell onClick={() => setSort('name')} sx={sortableCellSx}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {t('core:tables.name', {
            postProcess: 'capitalizeFirstChar',
          })}
          {renderSortIcon('name')}
        </span>
      </TableCell>
      <TableCell onClick={() => setSort('salePrice')} sx={sortableCellSx}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {t('core:market.sale_price', {
            postProcess: 'capitalizeFirstChar',
          })}{' '}
          {renderSortIcon('salePrice')}
        </span>
      </TableCell>
      <TableCell>Actions</TableCell>
    </TableRow>
  );
}

type SetPendingTxs = (update: SetStateAction<PendingTxsState>) => void;

type SetNames = (update: SetStateAction<Names[]>) => void;

type SetNamesForSale = (update: SetStateAction<NamesForSale[]>) => void;

function rowContent(
  _index: number,
  row: NamesForSale,
  setPendingTxs: SetPendingTxs,
  setNames: SetNames,
  setNamesForSale: SetNamesForSale,
  isPrimaryNameForSale: boolean,
  t: TFunction,
  nameStrings: string[],
  pendingBuyNameStrings: string[]
) {
  const handleBuy = async (name: string) => {
    const loadId = showLoading(
      t('core:market.responses.loading', {
        postProcess: 'capitalizeFirstChar',
      })
    );

    try {
      const res = await qortalRequest({
        action: 'BUY_NAME',
        nameForSale: name,
      });
      showSuccess(
        t('core:market.responses.success', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      setPendingTxs((prev) => {
        return {
          ...prev, // preserve existing categories
          ['BUY_NAME']: {
            ...(prev['BUY_NAME'] || {}), // preserve existing transactions in this category
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNamesForSale((prev) =>
                  prev.filter((item) => item?.name !== res.name)
                );
                setNames((prev) => [
                  ...prev,
                  {
                    name: res.name,
                    owner: res.creatorAddress,
                  },
                ]);
              },
            }, // add or overwrite this transaction
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(
        t('core:market.responses.error', {
          postProcess: 'capitalizeFirstChar',
        })
      );
    } finally {
      dismissToast(loadId);
    }
  };

  const isNameOwned = nameStrings.includes(row.name);

  const isNameBuying = pendingBuyNameStrings.includes(row.name);

  return (
    <>
      <TableCell>{row.name}</TableCell>
      <TableCell>{row.salePrice}</TableCell>
      <TableCell>
        <Button
          disabled={isPrimaryNameForSale || isNameOwned || isNameBuying}
          variant="contained"
          size="small"
          onClick={() => handleBuy(row.name)}
        >
          {t('core:actions.buy', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
      </TableCell>
    </>
  );
}

interface ForSaleTable {
  namesForSale: NamesForSale[];
  sortDirection: SortDirection;
  sortBy: SortBy;
  handleSort: (sortBy: SortBy) => void;
  isPrimaryNameForSale: boolean;
}

export const ForSaleTable = ({
  namesForSale,
  sortDirection,
  sortBy,
  handleSort,
  isPrimaryNameForSale,
}: ForSaleTable) => {
  const [names, setNames] = useAtom(namesAtom);
  const setNamesForSale = useSetAtom(forSaleAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const { t } = useTranslation();
  const nameStrings = useMemo(() => {
    return names?.map((item) => item.name);
  }, [names]);
  const pendingBuyNameStrings = useMemo(() => {
    const buyNameTxs = pendingTxs['BUY_NAME'];
    if (!buyNameTxs) return [];

    return Object.values(buyNameTxs).map((tx) => tx.name);
  }, [pendingTxs]);

  return (
    <Paper
      sx={{
        height: 'calc(100vh - 64px - 60px)', // Header + footer height
        width: '100%',
      }}
    >
      <TableVirtuoso
        data={namesForSale}
        components={VirtuosoTableComponents}
        fixedHeaderContent={() =>
          fixedHeaderContent(sortBy, sortDirection, handleSort, t)
        }
        itemContent={(index, row: NamesForSale) =>
          rowContent(
            index,
            row,
            setPendingTxs,
            setNames,
            setNamesForSale,
            isPrimaryNameForSale,
            t,
            nameStrings,
            pendingBuyNameStrings
          )
        }
      />
    </Paper>
  );
};
