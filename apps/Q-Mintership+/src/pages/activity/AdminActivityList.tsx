/**
 * Minter Admin Activity: every admin's signatures (approvals and rejections,
 * shown apart) against the decisions they could have signed, misses, time
 * to approve, proposals and last activity.
 * Cards on phones and tablets (one or two columns), a table from 900 px
 * whose every column header sorts it (again reverses it); Sort by and its
 * order button do the same everywhere. Participation fills its bar and
 * counts up to its value as it shows. Former admins of the window are
 * listed apart.
 */
import { useId, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
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
import {
  ACTIVITY_SORT_DESCENDING,
  sortActivity,
  type ActivitySort,
  type AdminActivity,
} from '../../rules/activity';
import { useCountUp } from '../../hooks/useCountUp';
import type { DecisionKind } from '../../rules/decision';
import { PersonChip } from '../../components/common/Person';
import { ProgressBar } from '../../components/common/ProgressRing';
import { Card, Section } from '../../components/common/Section';
import { EmptyState } from '../../components/common/states';
import { displayName, formatCount, plural } from '../../utils/format';
import { blockDate, blocksAsTime, lastActive, NONE, ofTotal, percent, windowWords } from './format';

const SORTS: Array<{ value: ActivitySort; label: string }> = [
  { value: 'participation', label: 'Participation' },
  { value: 'signatures', label: 'Approved' },
  { value: 'missed', label: 'Missed' },
  { value: 'medianTime', label: 'Median time to approve' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'lastActive', label: 'Last active' },
  { value: 'name', label: 'Name' },
];

export interface ActivityOrder {
  sort: ActivitySort;
  descending: boolean;
}

/** The order's words, for its button: "Highest first", "Fastest first", "A to Z", … */
function orderWords({ sort, descending }: ActivityOrder): string {
  if (sort === 'name') return descending ? 'Z to A' : 'A to Z';
  if (sort === 'medianTime') return descending ? 'Slowest first' : 'Fastest first';
  if (sort === 'lastActive') return descending ? 'Most recent first' : 'Least recent first';
  return descending ? 'Highest first' : 'Lowest first';
}

/** A column pressed: its first order, or the other way round when it is the one in use. */
function nextOrder(current: ActivityOrder, sort: ActivitySort): ActivityOrder {
  return current.sort === sort
    ? { sort, descending: !current.descending }
    : { sort, descending: ACTIVITY_SORT_DESCENDING[sort] };
}

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
  const [order, setOrder] = useState<ActivityOrder>({
    sort: 'participation',
    descending: ACTIVITY_SORT_DESCENDING.participation,
  });
  const onSort = (sort: ActivitySort) => setOrder((current) => nextOrder(current, sort));
  const sortId = useId();
  const memberSet = new Set(data.members);
  // Members without a name have none; anyone else (a former admin who left) is looked up.
  const nameOf = (address: string) =>
    data.names[address] ?? (memberSet.has(address) ? null : undefined);
  const label = (address: string) => displayName(data.names[address], address);
  const current = sortActivity(data.report.current, order.sort, label, order.descending);
  const former = sortActivity(data.report.former, order.sort, label, order.descending);
  const ctx: RowContext = { data, nameOf, myAddress };

  const words = orderWords(order);
  const sortControl = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <TextField
        select
        size="small"
        label="Sort by"
        value={order.sort}
        onChange={(e) => {
          const sort = e.target.value as ActivitySort;
          setOrder({ sort, descending: ACTIVITY_SORT_DESCENDING[sort] });
        }}
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
      <Button
        variant="outlined"
        color="inherit"
        onClick={() => onSort(order.sort)}
        aria-label={`Order: ${words}. Press to reverse it`}
        title="Reverse the order"
        sx={{ minHeight: 44, minWidth: 44, px: 1 }}
      >
        {order.descending ? (
          <ArrowDownwardOutlinedIcon aria-hidden sx={{ fontSize: 20 }} />
        ) : (
          <ArrowUpwardOutlinedIcon aria-hidden sx={{ fontSize: 20 }} />
        )}
      </Button>
    </Box>
  );

  return (
    <>
      <Section title="Minter Admin Activity" id="activity-admins" action={sortControl}>
        <Typography variant="body2" color="text.secondary">
          {plural(data.report.decisionCount, 'MINTER decision')}{' '}
          {data.report.decisionCount === 1 ? 'was' : 'were'} waiting for approvals{' '}
          {windowWords(data.range.days)}; each needs {plural(data.needed, 'approval')}, from{' '}
          {formatCount(data.signerCount)} Minter Admins who can approve.
        </Typography>
        {current.length ? (
          <AdminRows
            label="Minter Admin Activity"
            rows={current}
            ctx={ctx}
            wide={wide}
            order={order}
            onSort={onSort}
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
            order={order}
            onSort={onSort}
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
  order,
  onSort,
}: {
  /** The table's accessible name. */
  label: string;
  rows: AdminActivity[];
  ctx: RowContext;
  wide: boolean;
  order: ActivityOrder;
  onSort: (sort: ActivitySort) => void;
}) {
  if (wide) return <AdminTable label={label} rows={rows} ctx={ctx} order={order} onSort={onSort} />;
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

/** "7 of 10 signed": approvals and rejections, each a signed transaction. */
function signedText(row: AdminActivity): string {
  return `${ofTotal(row.answered, row.eligible)} signed`;
}

function Participation({ row, caption }: { row: AdminActivity; caption?: boolean }) {
  // Rises to its value as the bar fills (screen readers get the bar's value instead).
  const counted = useCountUp((row.participation ?? 0) * 100);
  const bar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 48 }}>
        <ProgressBar
          value={row.participation ?? 0}
          label={
            row.participation === null
              ? 'Participation: nothing to sign in this window'
              : `Participation ${percent(row.participation)}`
          }
          valueText={row.participation === null ? undefined : signedText(row)}
        />
      </Box>
      <Typography
        aria-hidden
        sx={{
          fontWeight: 700,
          minWidth: 44,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {row.participation === null ? percent(null) : `${Math.round(counted)}%`}
      </Typography>
    </Box>
  );
  if (!caption || !row.eligible) return bar;
  return (
    <Box sx={{ minWidth: 0 }}>
      {bar}
      <Typography variant="body2" color="text.secondary" aria-hidden>
        {signedText(row)}
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
        <Stat
          label="Signatures"
          value={row.eligible ? ofTotal(row.answered, row.eligible) : NONE}
        />
        <Stat label="Approved" value={formatCount(row.signed)} />
        <Stat label="Rejected" value={formatCount(row.rejected)} />
        <Stat label="Missed" value={formatCount(row.missed)} />
        <Stat label="Proposed" value={formatCount(row.proposed)} />
        <Stat label="Median time to approve" value={blocksAsTime(row.medianBlocksToSign, now)} />
        <Stat label="Last active" value={lastActive(row.lastActiveHeight, now)} />
      </Box>
      {row.proposed ? (
        <Typography variant="body2" color="text.secondary">
          Proposed: {proposedText(row)}
        </Typography>
      ) : null}
    </Card>
  );
}

/**
 * A column header that sorts the list by it, or reverses the order when it
 * is the one in use (aria-sort on the header cell).
 */
function SortHeader({
  label,
  value,
  order,
  onSort,
  align = 'left',
}: {
  label: ReactNode;
  value: ActivitySort;
  order: ActivityOrder;
  onSort: (sort: ActivitySort) => void;
  align?: 'left' | 'right';
}) {
  const active = order.sort === value;
  return (
    <Box
      component="th"
      scope="col"
      aria-sort={active ? (order.descending ? 'descending' : 'ascending') : undefined}
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
          textAlign: align,
          color: active ? theme.palette.text.primary : 'inherit',
          '&:hover': { color: theme.palette.text.primary },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}` },
        })}
      >
        <span>{label}</span>
        {active ? (
          order.descending ? (
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
  order,
  onSort,
}: {
  label: string;
  rows: AdminActivity[];
  ctx: RowContext;
  order: ActivityOrder;
  onSort: (sort: ActivitySort) => void;
}) {
  const now = ctx.data.now;
  const headers = { order, onSort };
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
            <SortHeader label="Approved" value="signatures" align="right" {...headers} />
            <SortHeader label="Missed" value="missed" align="right" {...headers} />
            <SortHeader
              label={
                <>
                  Median time
                  <br />
                  to approve
                </>
              }
              value="medianTime"
              align="right"
              {...headers}
            />
            <SortHeader label="Proposed" value="proposed" align="right" {...headers} />
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
                <Participation row={row} caption />
              </Box>
              <td className="num">
                {row.eligible ? formatCount(row.signed) : NONE}
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
