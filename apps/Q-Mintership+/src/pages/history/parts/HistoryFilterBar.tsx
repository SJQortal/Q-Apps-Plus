/**
 * History's filters: what to show (a chip per type; a native picker on
 * phones, where eleven chips would stack five rows deep) and when (a native
 * picker: any time, the last 30, 60 or 120 days, the last year, or from a
 * date, picked in a date field and applied with Show).
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, Chip, TextField, Typography } from '@mui/material';
import { formatDate } from '../../../utils/format';
import { DAY_MS, fromDateInput, toDateInput } from '../../activity/range';
import {
  PERIOD_CHOICES,
  periodKey,
  type HistoryFilter,
  type HistoryPeriod,
  type PeriodDays,
} from '../historyFilters';

const FIELD_SX = {
  flex: '1 1 150px',
  maxWidth: { sm: 240 },
  '& .MuiInputBase-root': { minHeight: 44 },
};

export function HistoryFilterBar({
  choices,
  filter,
  onFilter,
  period,
  onPeriod,
  phone,
  earliest,
  nowMs,
}: {
  choices: ReadonlyArray<{ key: HistoryFilter; label: string }>;
  filter: HistoryFilter;
  onFilter: (filter: HistoryFilter) => void;
  period: HistoryPeriod;
  onPeriod: (period: HistoryPeriod) => void;
  phone: boolean;
  /** MINTER's creation, the earliest a period can start. */
  earliest?: number;
  nowMs: number;
}) {
  const [editing, setEditing] = useState(false);
  const fromOn = editing || period.kind === 'from';
  const [date, setDate] = useState(() =>
    period.kind === 'from' ? period.date : toDateInput(nowMs - 30 * DAY_MS)
  );
  const [problem, setProblem] = useState<string | null>(null);

  const choosePeriod = (key: string) => {
    setProblem(null);
    if (key === 'from') {
      setEditing(true);
      return;
    }
    setEditing(false);
    onPeriod(key === 'any' ? { kind: 'any' } : { kind: 'days', days: Number(key) as PeriodDays });
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const ms = fromDateInput(date);
    let why: string | null = null;
    if (ms === null) why = 'Pick a date.';
    else if (ms > nowMs) why = 'The date is in the future.';
    else if (earliest !== undefined && ms < earliest - DAY_MS)
      why = `MINTER started on ${formatDate(earliest)}.`;
    setProblem(why);
    if (why) return;
    setEditing(false);
    onPeriod({ kind: 'from', date });
  };

  const typeChoice = phone ? (
    <TextField
      select
      label="Show"
      size="small"
      value={filter}
      onChange={(e) => onFilter(e.target.value as HistoryFilter)}
      slotProps={{ select: { native: true } }}
      sx={FIELD_SX}
    >
      {choices.map((c) => (
        <option key={c.key} value={c.key}>
          {c.key === 'all' ? 'All types' : c.label}
        </option>
      ))}
    </TextField>
  ) : (
    <Box
      role="group"
      aria-label="Show one type of event"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
    >
      {choices.map((c) => {
        const active = filter === c.key;
        return (
          <Chip
            key={c.key}
            clickable
            aria-pressed={active}
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            onClick={() => onFilter(c.key)}
            label={c.label}
            sx={{ height: 40, borderRadius: 999, px: 0.5 }}
          />
        );
      })}
    </Box>
  );

  const periodChoice = (
    <TextField
      select
      label="When"
      size="small"
      value={fromOn ? 'from' : periodKey(period)}
      onChange={(e) => choosePeriod(e.target.value)}
      slotProps={{ select: { native: true } }}
      sx={FIELD_SX}
    >
      {PERIOD_CHOICES.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </TextField>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {phone ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {typeChoice}
          {periodChoice}
        </Box>
      ) : (
        <>
          {typeChoice}
          <Box sx={{ display: 'flex' }}>{periodChoice}</Box>
        </>
      )}
      {fromOn ? (
        <Box
          component="form"
          onSubmit={apply}
          noValidate
          aria-label="From a date"
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}
        >
          <TextField
            type="date"
            label="From"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                min: earliest !== undefined ? toDateInput(earliest) : undefined,
                max: toDateInput(nowMs),
              },
            }}
            sx={FIELD_SX}
          />
          <Button
            type="submit"
            variant="outlined"
            color="inherit"
            sx={{ minHeight: 44, flex: '0 0 auto' }}
          >
            Show
          </Button>
          {problem ? (
            <Typography role="alert" variant="body2" color="error" sx={{ flexBasis: '100%' }}>
              {problem}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
