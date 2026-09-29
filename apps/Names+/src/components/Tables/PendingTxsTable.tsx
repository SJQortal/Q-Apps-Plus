import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { useAtomValue } from 'jotai';
import { forwardRef } from 'react';
import { TableVirtuoso, TableComponents } from 'react-virtuoso';
import {
  allSortedPendingTxsAtom,
  NameTransactions,
} from '../../state/global/names';
import { Spacer } from 'qapp-core';

const VirtuosoTableComponents: TableComponents<NameTransactions> = {
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

function fixedHeaderContent() {
  return (
    <TableRow sx={{ backgroundColor: 'background.paper' }}>
      <TableCell>Tx type</TableCell>
      <TableCell>Info</TableCell>
    </TableRow>
  );
}

function rowContent(_index: number, row: NameTransactions) {
  return (
    <>
      <TableCell>{row.type}</TableCell>
      <TableCell>
        {row.type === 'REGISTER_NAME' && `Name: ${row.name}`}
        {row.type === 'UPDATE_NAME' && `New name: ${row.newName}`}
        {row.type === 'SELL_NAME' && `name: ${row.name}`}
        {row.type === 'CANCEL_SELL_NAME' && `name: ${row.name}`}
        {row.type === 'BUY_NAME' && `name: ${row.name}`}
      </TableCell>
    </>
  );
}

export const PendingTxsTable = () => {
  const allTxs = useAtomValue(allSortedPendingTxsAtom);
  if (allTxs?.length === 0) return null;
  return (
    <>
      <Spacer height="20px" />
      <Typography variant="h3">Pending transactions</Typography>
      <Paper
        sx={{
          height: '250px', // Header + footer height
          width: '100%',
        }}
      >
        <TableVirtuoso
          data={allTxs}
          components={VirtuosoTableComponents}
          fixedHeaderContent={fixedHeaderContent}
          itemContent={rowContent}
        />
      </Paper>
    </>
  );
};
