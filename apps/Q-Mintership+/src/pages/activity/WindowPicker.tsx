/**
 * The window Activity counts over: 30, 60, 90 or 180 days (remembered in
 * Settings), or a custom range of dates. Under it, the window in blocks, so
 * it's clear the count is by block, at the live block time.
 */
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Box, Button, Skeleton, TextField, Typography } from '@mui/material';
import { primarySoft } from '../../hub-theme';
import type { ActivityRange } from '../../data/activity';
import type { ChainNow } from '../../data/chain';
import type { ActivityWindow } from '../../state/settings';
import { SectionTitle } from '../../components/common/Section';
import { formatCount, formatDate } from '../../utils/format';
import { blockTimeWords } from './format';
import {
  customRangeProblem,
  DAY_MS,
  fromDateInput,
  toDateInput,
  WINDOW_DAYS,
  type CustomRange,
} from './range';

/** A window choice: a pill that shows when it's the one in use (aria-pressed). */
function WindowButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outlined"
      aria-pressed={selected}
      onClick={onClick}
      sx={(theme) => ({
        minHeight: 44,
        px: 2,
        borderRadius: 999,
        fontWeight: 600,
        textTransform: 'none',
        color: selected ? theme.palette.primary.main : theme.palette.text.primary,
        borderColor: selected ? theme.palette.primary.main : theme.palette.divider,
        bgcolor: selected ? primarySoft(theme) : 'transparent',
      })}
    >
      {children}
    </Button>
  );
}

export function WindowPicker({
  days,
  custom,
  onDays,
  onCustom,
  range,
  now,
  earliest,
}: {
  days: ActivityWindow;
  custom: CustomRange | null;
  onDays: (days: ActivityWindow) => void;
  onCustom: (range: CustomRange) => void;
  /** The window being shown (null while loading). */
  range: ActivityRange | null;
  now: ChainNow | null;
  /** MINTER's creation time, the earliest a range can start. */
  earliest?: number;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const today = Date.now();
  const [from, setFrom] = useState(() => toDateInput(custom?.fromMs ?? today - 30 * DAY_MS));
  const [to, setTo] = useState(() => toDateInput(custom?.toMs ?? today));
  const [problem, setProblem] = useState<string | null>(null);
  const customOn = editing || custom !== null;

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const fromMs = fromDateInput(from);
    const toMs = fromDateInput(to, true);
    const why = customRangeProblem(fromMs, toMs, { earliest, latest: Date.now() });
    setProblem(why);
    if (why) return;
    setEditing(false);
    onCustom({
      fromMs: Math.max(fromMs as number, earliest ?? 0),
      toMs: Math.min(toMs as number, Date.now()),
    });
  };

  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <SectionTitle id={`${id}-title`} variant="h2">
        Window
      </SectionTitle>
      <Box
        role="group"
        aria-labelledby={`${id}-title`}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
      >
        {WINDOW_DAYS.map((d) => (
          <WindowButton
            key={d}
            selected={!customOn && days === d}
            onClick={() => {
              setEditing(false);
              setProblem(null);
              onDays(d);
            }}
          >
            {d} days
          </WindowButton>
        ))}
        <WindowButton selected={customOn} onClick={() => setEditing(true)}>
          Custom
        </WindowButton>
      </Box>

      {customOn ? (
        <Box
          component="form"
          onSubmit={apply}
          noValidate
          aria-label="Custom range"
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, pt: 1 }}
        >
          <TextField
            type="date"
            label="From"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: earliest ? toDateInput(earliest) : undefined, max: to },
            }}
            sx={{ flex: '1 1 140px', '& .MuiInputBase-root': { minHeight: 44 } }}
          />
          <TextField
            type="date"
            label="To"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: from, max: toDateInput(today) },
            }}
            sx={{ flex: '1 1 140px', '& .MuiInputBase-root': { minHeight: 44 } }}
          />
          <Button type="submit" variant="contained" sx={{ minHeight: 44, flex: '0 0 auto' }}>
            Show
          </Button>
          {problem ? (
            <Typography role="alert" variant="body2" color="error" sx={{ flexBasis: '100%' }}>
              {problem}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {range && now ? (
        <Typography variant="body2" color="text.secondary">
          {formatDate(range.startTime)} to {formatDate(range.endTime)}: blocks{' '}
          {formatCount(range.startBlock)} to {formatCount(range.endBlock)} (
          {formatCount(range.endBlock - range.startBlock + 1)} blocks, one every{' '}
          {blockTimeWords(now)}
          {now.estimated || range.estimated ? ', estimated' : ''}).
        </Typography>
      ) : (
        <Skeleton variant="text" width="70%" aria-hidden />
      )}
    </Box>
  );
}
