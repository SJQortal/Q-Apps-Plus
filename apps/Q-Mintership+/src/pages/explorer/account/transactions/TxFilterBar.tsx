/**
 * The Transactions tab's filters, under the kind chips (FamilyFilter): one
 * exact type of the kind picked, one of the account's names (primary or
 * secondary: the transactions about it), when (the last day, week, month
 * or year, between two dates, or between two blocks) and the order (newest
 * or oldest first, or the biggest amount first). Every picker is a native
 * select, so it works the same on phones and with a screen reader; they
 * sit side by side where they fit and wrap on phones.
 *
 * "Between dates…" and "Between blocks…" open two fields and Show, either
 * side may stay empty (open). What is picked is said in one line with
 * "Clear filters". Everything picked lives in the URL (TransactionsTab).
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import { getTip } from '../../../../data/chain';
import { useQuery } from '../../../../hooks/useQuery';
import {
  dateValue,
  DEFAULT_FILTERS,
  filterSummary,
  ORDERS,
  rangeProblem,
  WHENS,
  type TxFilters,
  type TxOrder,
  type TxWhen,
} from '../../../../rules/explorer/accountTxFilters';
import { visibleName } from '../../../../rules/explorer/nameNotes';
import { TX_FAMILIES, txTypeLabel, typesFor } from '../../../../rules/explorer/txFamilies';
import { formatCount } from '../../../../utils/format';

const FIELD_SX = {
  flex: '1 1 170px',
  maxWidth: { sm: 260 },
  '& .MuiInputBase-root': { minHeight: 44 },
} as const;

/** The two fields of "Between dates…" or "Between blocks…", applied with Show. */
function RangeForm({
  filters,
  onChange,
}: {
  filters: TxFilters & { when: 'dates' | 'blocks' };
  onChange: (filters: TxFilters) => void;
}) {
  const dates = filters.when === 'dates';
  const [from, setFrom] = useState(filters.from ?? '');
  const [to, setTo] = useState(filters.to ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const tip = useQuery(dates ? null : 'chain:tip', (force) => getTip({ force }));
  const today = dateValue(Date.now());

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const why = rangeProblem(filters.when, from.trim(), to.trim(), today, tip.data?.height ?? null);
    setProblem(why);
    if (why) return;
    onChange({ ...filters, from: from.trim() || null, to: to.trim() || null });
  };

  const fieldSx = {
    ...FIELD_SX,
    // The browser's own calendar follows the theme's light or dark.
    '& input': { colorScheme: 'inherit' },
  };
  const inputProps = dates
    ? { max: today }
    : { inputMode: 'numeric' as const, pattern: '[0-9]*', autoComplete: 'off' };
  return (
    <Box
      component="form"
      onSubmit={apply}
      noValidate
      aria-label={dates ? 'Between dates' : 'Between blocks'}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        colorScheme: theme.palette.mode,
      })}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <TextField
          label={dates ? 'First day' : 'First block'}
          type={dates ? 'date' : 'text'}
          size="small"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: inputProps }}
          sx={fieldSx}
        />
        <TextField
          label={dates ? 'Last day' : 'Last block'}
          type={dates ? 'date' : 'text'}
          size="small"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: inputProps }}
          sx={fieldSx}
        />
        <Button type="submit" variant="outlined" sx={{ minHeight: 44 }}>
          Show
        </Button>
      </Box>
      {problem ? (
        <Typography role="alert" variant="body2" color="error">
          {problem}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {dates
            ? 'Either day may stay empty. A transaction counts by its own time.'
            : tip.data
              ? `Either block may stay empty. The chain is at block ${formatCount(tip.data.height)}.`
              : 'Either block may stay empty.'}
        </Typography>
      )}
    </Box>
  );
}

export function TxFilterBar({
  filters,
  onChange,
  names,
  primary,
}: {
  filters: TxFilters;
  onChange: (filters: TxFilters) => void;
  /** The account's names (Core's order); undefined while they load. */
  names: readonly string[] | undefined;
  primary: string | null | undefined;
}) {
  const types = filters.kind === 'all' ? [] : typesFor(filters.kind);
  // The primary name first; a name from a link that it no longer has stays pickable.
  const nameOptions = [
    ...(primary && names?.includes(primary) ? [primary] : []),
    ...(names ?? []).filter((name) => name !== primary),
  ];
  if (filters.name && !nameOptions.includes(filters.name)) nameOptions.push(filters.name);
  const kindLabel = TX_FAMILIES.find((f) => f.key === filters.kind)?.label ?? 'All';
  const summary = filterSummary(filters, kindLabel);
  const ranged = filters.when === 'dates' || filters.when === 'blocks';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {types.length > 1 ? (
          <TextField
            select
            label="Type"
            size="small"
            value={filters.type ?? ''}
            onChange={(e) => onChange({ ...filters, type: e.target.value || null })}
            // Its first choice is the empty value: the label stays up.
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            sx={FIELD_SX}
          >
            <option value="">Every type</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {txTypeLabel(type)}
              </option>
            ))}
          </TextField>
        ) : null}
        {nameOptions.length ? (
          <TextField
            select
            label="Name"
            size="small"
            value={filters.name ?? ''}
            onChange={(e) => onChange({ ...filters, name: e.target.value || null })}
            slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            sx={FIELD_SX}
          >
            <option value="">Any name</option>
            {nameOptions.map((name) => (
              <option key={name} value={name}>
                {visibleName(name)}
                {name === primary ? ' (primary)' : ''}
              </option>
            ))}
          </TextField>
        ) : null}
        <TextField
          select
          label="When"
          size="small"
          value={filters.when}
          onChange={(e) =>
            onChange({ ...filters, when: e.target.value as TxWhen, from: null, to: null })
          }
          slotProps={{ select: { native: true } }}
          sx={FIELD_SX}
        >
          {WHENS.map((when) => (
            <option key={when.value} value={when.value}>
              {when.label}
            </option>
          ))}
        </TextField>
        <TextField
          select
          label="Order"
          size="small"
          value={filters.order}
          onChange={(e) => onChange({ ...filters, order: e.target.value as TxOrder })}
          slotProps={{ select: { native: true } }}
          sx={FIELD_SX}
        >
          {ORDERS.map((order) => (
            <option key={order.value} value={order.value}>
              {order.label}
            </option>
          ))}
        </TextField>
      </Box>
      {ranged ? (
        <RangeForm
          key={`${filters.when}:${filters.from}:${filters.to}`}
          filters={filters as TxFilters & { when: 'dates' | 'blocks' }}
          onChange={onChange}
        />
      ) : null}
      {summary ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 220px', minWidth: 0, overflowWrap: 'anywhere' }}
          >
            Showing: {summary}
          </Typography>
          <Button
            onClick={() => onChange(DEFAULT_FILTERS)}
            startIcon={<FilterAltOffOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Clear filters
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
