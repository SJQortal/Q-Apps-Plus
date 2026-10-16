/**
 * Compare → Side by side. From 900 px a real table: a header row with each
 * account's letter and name, a row header per fact. Narrower, each fact is
 * a block: its label, then one line per account (letter and value). A fact
 * the same for every account reads "Same for all: …" once. A read that
 * failed says "Couldn’t read" in its cell, and the section lists them in one
 * line with one Retry. The page decides the layout once and passes it down
 * (no screen-size listener per row).
 */
import { Box, Skeleton, Typography } from '@mui/material';
import { Section } from '../../../components/common/Section';
import { PersonInline } from '../../../components/common/Person';
import { useDisplayName } from '../../../hooks/useDisplayName';
import type { Letter } from '../../../rules/explorer/compare';
import { visibleName } from '../../../rules/explorer/nameNotes';
import { LetterBadge } from './letters';
import { FailedReads } from './parts';
import { sameForAll, type SideCell, type SideRow } from './sideRows';

export interface SideColumn {
  address: string;
  letter: Letter;
  accent: string;
}

function Cell({ cell }: { cell: SideCell | undefined }) {
  if (!cell)
    return (
      <>
        <Skeleton variant="text" width={80} aria-hidden />
        <span className="qmp-visually-hidden">Loading</span>
      </>
    );
  if (cell.failed)
    return (
      <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {cell.text}
      </Box>
    );
  return (
    <Box component="span" sx={{ overflowWrap: 'anywhere' }}>
      {cell.before}
      {cell.account ? (
        <PersonInline address={cell.account} />
      ) : cell.name !== undefined ? (
        <bdi dir="auto" style={{ fontWeight: 600 }}>
          {visibleName(cell.name)}
        </bdi>
      ) : (
        cell.text
      )}
      {cell.after}
    </Box>
  );
}

function ColumnName({ column }: { column: SideColumn }) {
  const { label } = useDisplayName(column.address);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <LetterBadge letter={column.letter} accent={column.accent} />
      <Box
        component="bdi"
        dir="auto"
        sx={{ fontWeight: 700, overflowWrap: 'anywhere', minWidth: 0 }}
      >
        {label}
      </Box>
    </Box>
  );
}

const CELL_SX = {
  textAlign: 'left',
  verticalAlign: 'top',
  py: 1,
  px: 1,
  borderBottom: 1,
  borderColor: 'divider',
  fontSize: 14,
  minWidth: 0,
} as const;

function Table({ columns, rows }: { columns: readonly SideColumn[]; rows: readonly SideRow[] }) {
  return (
    <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
      <caption className="qmp-visually-hidden">The accounts side by side</caption>
      <thead>
        <tr>
          <Box component="th" scope="col" sx={{ ...CELL_SX, width: '22%' }}>
            <span className="qmp-visually-hidden">Fact</span>
          </Box>
          {columns.map((column) => (
            <Box component="th" scope="col" key={column.address} sx={CELL_SX}>
              <ColumnName column={column} />
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const same = sameForAll(row.cells);
          return (
            <tr key={row.key}>
              <Box
                component="th"
                scope="row"
                sx={{ ...CELL_SX, color: 'text.secondary', fontWeight: 600 }}
              >
                {row.label}
              </Box>
              {same ? (
                <Box component="td" colSpan={columns.length} sx={CELL_SX}>
                  Same for all: <Cell cell={same} />
                </Box>
              ) : (
                row.cells.map((cell, i) => (
                  <Box component="td" key={columns[i].address} sx={CELL_SX}>
                    <Cell cell={cell} />
                  </Box>
                ))
              )}
            </tr>
          );
        })}
      </tbody>
    </Box>
  );
}

function Stacked({ columns, rows }: { columns: readonly SideColumn[]; rows: readonly SideRow[] }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {rows.map((row) => {
        const same = sameForAll(row.cells);
        return (
          <Box key={row.key} sx={{ minWidth: 0, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography
              component="dt"
              variant="body2"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              {row.label}
            </Typography>
            {same ? (
              <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere' }}>
                Same for all: <Cell cell={same} />
              </Typography>
            ) : (
              row.cells.map((cell, i) => (
                <Typography
                  component="dd"
                  key={columns[i].address}
                  sx={{
                    m: 0,
                    mt: 0.5,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    minWidth: 0,
                  }}
                >
                  <LetterBadge letter={columns[i].letter} accent={columns[i].accent} size={24} />
                  <Box component="span" sx={{ minWidth: 0, pt: 0.25 }}>
                    <Cell cell={cell} />
                  </Box>
                </Typography>
              ))
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export function SideBySide({
  columns,
  rows,
  table,
  failed = [],
  onRetry,
}: {
  columns: readonly SideColumn[];
  rows: readonly SideRow[];
  /** A table (900 px and wider), else stacked blocks. */
  table: boolean;
  /** The reads that failed, in words ("B’s balance"). */
  failed?: readonly string[];
  /** Asks again for every read that failed. */
  onRetry?: () => void;
}) {
  if (columns.length < 2) return null;
  return (
    <Section title="Side by side" id="compare-side">
      {table ? <Table columns={columns} rows={rows} /> : <Stacked columns={columns} rows={rows} />}
      {onRetry ? (
        <FailedReads what={failed} onRetry={onRetry} retryLabel="Retry Side by side" />
      ) : null}
    </Section>
  );
}
