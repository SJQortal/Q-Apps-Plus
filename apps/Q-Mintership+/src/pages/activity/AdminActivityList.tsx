/**
 * Minter Admin Activity: every admin's signatures against the decisions they
 * could have signed, misses, time to sign, proposals and last activity.
 * Cards on phones and tablets (one or two columns), a sortable table from
 * 900 px. Former admins of the window are listed apart.
 */
import { useId, useState, type ReactNode } from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import { primarySoft } from '../../hub-theme';
import type { ActivityData } from '../../data/activity';
import { sortActivity, type ActivitySort, type AdminActivity } from '../../rules/activity';
import type { DecisionKind } from '../../rules/decision';
import { PersonChip } from '../../components/common/Person';
import { ProgressBar } from '../../components/common/ProgressRing';
import { Card, Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/states';
import { displayName, formatCount, plural } from '../../utils/format';
import { blockDate, blocksAsTime, lastActive, NONE, ofTotal, percent, windowWords } from './format';

const SORTS: Array<{ value: ActivitySort; label: string }> = [
  { value: 'participation', label: 'Participation' },
  { value: 'signatures', label: 'Signatures' },
  { value: 'lastActive', label: 'Last active' },
  { value: 'name', label: 'Name' },
];

/** Participation, signatures and last active sort highest or newest first; names A–Z. */
const DESCENDING: Record<ActivitySort, boolean> = {
  participation: true,
  signatures: true,
  lastActive: true,
  name: false,
};

interface RowContext {
  data: ActivityData;
  /** Name for an address: the member list's, null for "no name", undefined to look it up. */
  nameOf: (address: string) => string | null | undefined;
  myAddress: string | null;
}

export function AdminActivityList({
  data,
  myAddress,
}: {
  data: ActivityData;
  myAddress: string | null;
}) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const [sort, setSort] = useState<ActivitySort>('participation');
  const sortId = useId();
  const memberSet = new Set(data.members);
  // Members without a name have none; anyone else (a former admin who left) is looked up.
  const nameOf = (address: string) =>
    data.names[address] ?? (memberSet.has(address) ? null : undefined);
  const label = (address: string) => displayName(data.names[address], address);
  const current = sortActivity(data.report.current, sort, label);
  const former = sortActivity(data.report.former, sort, label);
  const ctx: RowContext = { data, nameOf, myAddress };

  const sortControl = (
    <TextField
      select
      size="small"
      label="Sort by"
      value={sort}
      onChange={(e) => setSort(e.target.value as ActivitySort)}
      id={sortId}
      slotProps={{ select: { native: true } }}
      sx={{ minWidth: 150, '& .MuiInputBase-root': { minHeight: 44 } }}
    >
      {SORTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </TextField>
  );

  return (
    <>
      <Section title="Minter Admin Activity" id="activity-admins" action={sortControl}>
        <Typography variant="body2" color="text.secondary">
          {plural(data.report.decisionCount, 'MINTER decision')}{' '}
          {data.report.decisionCount === 1 ? 'was' : 'were'} waiting for signatures{' '}
          {windowWords(data.range.days)}; each needs {plural(data.needed, 'signature')} of{' '}
          {formatCount(data.signerCount)} admins.
        </Typography>
        {current.length ? (
          <AdminRows
            label="Minter Admin Activity"
            rows={current}
            ctx={ctx}
            wide={wide}
            sort={sort}
            onSort={setSort}
          />
        ) : (
          <EmptyState
            title="No Minter Admins found"
            description="Core's admin list for MINTER came back empty. Try again in a minute."
          />
        )}
      </Section>
      {former.length ? (
        <Section title="Former admins" id="activity-former">
          <Typography variant="body2" color="text.secondary">
            Minter Admins during this window who aren't admins now, counted until they stopped.
          </Typography>
          <AdminRows
            label="Former admins"
            rows={former}
            ctx={ctx}
            wide={wide}
            sort={sort}
            onSort={setSort}
          />
        </Section>
      ) : null}
    </>
  );
}

function AdminRows({
  label,
  rows,
  ctx,
  wide,
  sort,
  onSort,
}: {
  /** The table's accessible name. */
  label: string;
  rows: AdminActivity[];
  ctx: RowContext;
  wide: boolean;
  sort: ActivitySort;
  onSort: (sort: ActivitySort) => void;
}) {
  if (wide) return <AdminTable label={label} rows={rows} ctx={ctx} sort={sort} onSort={onSort} />;
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {rows.map((row) => (
        <Box component="li" key={row.address} sx={{ minWidth: 0 }}>
          <AdminCard row={row} ctx={ctx} />
        </Box>
      ))}
    </Box>
  );
}

/** "Admin since 2 Sep 2026", "Removed 30 Sep 2026", … */
function tenureText(row: AdminActivity, ctx: RowContext): string {
  const now = ctx.data.now;
  if (!row.current)
    return row.removedAt !== null
      ? `Removed ${blockDate(row.removedAt, now)}`
      : 'No longer an admin';
  if (row.adminSince === null) return 'Admin since before this window';
  const since = `Admin ${row.adminAgain ? 'again ' : ''}since ${blockDate(row.adminSince, now)}`;
  return row.adminSince > ctx.data.range.endBlock ? `${since}, after this range` : since;
}

const PROPOSAL_WORDS: Record<DecisionKind, [string, string]> = {
  invite: ['invite', 'invites'],
  cancelInvite: ['invite cancelled', 'invites cancelled'],
  kick: ['removal', 'removals'],
  ban: ['ban', 'bans'],
  cancelBan: ['ban lifted', 'bans lifted'],
  addAdmin: ['admin added', 'admins added'],
  removeAdmin: ['admin removed', 'admins removed'],
  other: ['other change', 'other changes'],
};

/** "2 invites, 1 removal". */
function proposedText(row: AdminActivity): string {
  const kinds = Object.entries(row.proposedByKind) as Array<[DecisionKind, number]>;
  return kinds
    .map(([kind, n]) => `${formatCount(n)} ${PROPOSAL_WORDS[kind][n === 1 ? 0 : 1]}`)
    .join(', ');
}

function Who({
  row,
  ctx,
  size,
  inlineYou,
}: {
  row: AdminActivity;
  ctx: RowContext;
  size: number;
  /** Say "You" in the second line instead of a chip (narrow table cells). */
  inlineYou?: boolean;
}) {
  const you = ctx.myAddress === row.address;
  const tenure = tenureText(row, ctx);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <PersonChip
          address={row.address}
          name={ctx.nameOf(row.address)}
          size={size}
          secondary={you && inlineYou ? `You · ${tenure}` : tenure}
        />
      </Box>
      {you && !inlineYou ? (
        <Chip
          size="small"
          label="You"
          sx={(theme) => ({
            bgcolor: primarySoft(theme),
            color: 'text.primary',
            border: `1px solid ${theme.palette.primary.main}`,
            fontWeight: 600,
          })}
        />
      ) : null}
    </Box>
  );
}

function Participation({ row }: { row: AdminActivity }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 48 }}>
        <ProgressBar
          value={row.participation ?? 0}
          label={
            row.participation === null
              ? 'Participation: nothing to sign in this window'
              : `Participation ${percent(row.participation)}`
          }
        />
      </Box>
      <Typography sx={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
        {percent(row.participation)}
      </Typography>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function AdminCard({ row, ctx }: { row: AdminActivity; ctx: RowContext }) {
  const now = ctx.data.now;
  const you = ctx.myAddress === row.address;
  return (
    <Card
      role="group"
      aria-label={`${displayName(ctx.data.names[row.address], row.address)}: participation ${percent(row.participation)}`}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
        ...(you ? { borderColor: theme.palette.primary.main } : {}),
      })}
    >
      <Who row={row} ctx={ctx} size={40} />
      <Participation row={row} />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
          columnGap: 1.5,
          rowGap: 1,
        }}
      >
        <Stat label="Signed" value={row.eligible ? ofTotal(row.signed, row.eligible) : NONE} />
        <Stat label="Missed" value={formatCount(row.missed)} />
        <Stat label="Proposed" value={formatCount(row.proposed)} />
        <Stat label="Median time to sign" value={blocksAsTime(row.medianBlocksToSign, now)} />
        <Stat label="Last active" value={lastActive(row.lastActiveHeight, now)} />
        {row.rejected ? <Stat label="Rejected" value={formatCount(row.rejected)} /> : null}
      </Box>
      {row.proposed ? (
        <Typography variant="body2" color="text.secondary">
          Proposed: {proposedText(row)}
        </Typography>
      ) : null}
    </Card>
  );
}

/** A column header that sorts the list (aria-sort on the header cell). */
function SortHeader({
  label,
  value,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  value: ActivitySort;
  sort: ActivitySort;
  onSort: (sort: ActivitySort) => void;
  align?: 'left' | 'right';
}) {
  const active = sort === value;
  return (
    <Box
      component="th"
      scope="col"
      aria-sort={active ? (DESCENDING[value] ? 'descending' : 'ascending') : undefined}
      className={align === 'right' ? 'num' : undefined}
    >
      <ButtonBase
        onClick={() => onSort(value)}
        sx={(theme) => ({
          gap: 0.5,
          minHeight: 40,
          px: 0.5,
          mx: -0.5,
          borderRadius: 1,
          font: 'inherit',
          fontWeight: 700,
          color: active ? theme.palette.text.primary : 'inherit',
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
        })}
      >
        {label}
        {active ? (
          DESCENDING[value] ? (
            <ArrowDownwardOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
          ) : (
            <ArrowUpwardOutlinedIcon sx={{ fontSize: 16 }} aria-hidden />
          )
        ) : null}
      </ButtonBase>
    </Box>
  );
}

/** A plain HTML table: MUI's Table would add to the shared chunk for this one screen. */
function AdminTable({
  label,
  rows,
  ctx,
  sort,
  onSort,
}: {
  label: string;
  rows: AdminActivity[];
  ctx: RowContext;
  sort: ActivitySort;
  onSort: (sort: ActivitySort) => void;
}) {
  const now = ctx.data.now;
  const headers = { sort, onSort };
  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflowX: 'auto',
      }}
    >
      <Box
        component="table"
        aria-label={label}
        sx={(theme) => ({
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          '& th': {
            color: theme.palette.text.secondary,
            fontWeight: 700,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            padding: theme.spacing(0.75, 1.25),
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          '& td': {
            padding: theme.spacing(1, 1.25),
            borderBottom: `1px solid ${theme.palette.divider}`,
            verticalAlign: 'middle',
            fontVariantNumeric: 'tabular-nums',
          },
          '& tbody tr:last-of-type td': { borderBottom: 0 },
          '& .num': { textAlign: 'right', whiteSpace: 'nowrap' },
        })}
      >
        <thead>
          <tr>
            <SortHeader label="Admin" value="name" {...headers} />
            <SortHeader label="Participation" value="participation" {...headers} />
            <SortHeader label="Signed" value="signatures" align="right" {...headers} />
            <th scope="col" className="num">
              Missed
            </th>
            <th scope="col" className="num">
              Median time
              <br />
              to sign
            </th>
            <th scope="col" className="num">
              Proposed
            </th>
            <SortHeader label="Last active" value="lastActive" {...headers} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Box
              component="tr"
              key={row.address}
              sx={(theme) => (ctx.myAddress === row.address ? { bgcolor: primarySoft(theme) } : {})}
            >
              <Box component="td" sx={{ minWidth: 240 }}>
                <Who row={row} ctx={ctx} size={32} inlineYou />
              </Box>
              <Box component="td" sx={{ width: '18%', minWidth: 130 }}>
                <Participation row={row} />
              </Box>
              <td className="num">
                {row.eligible ? ofTotal(row.signed, row.eligible) : NONE}
                {row.rejected ? (
                  <Typography variant="body2" color="text.secondary">
                    {row.rejected} rejected
                  </Typography>
                ) : null}
              </td>
              <td className="num">{formatCount(row.missed)}</td>
              <td className="num">{blocksAsTime(row.medianBlocksToSign, now)}</td>
              <td className="num">{formatCount(row.proposed)}</td>
              <Box component="td" sx={{ whiteSpace: 'nowrap' }}>
                {lastActive(row.lastActiveHeight, now)}
              </Box>
            </Box>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
