/**
 * Date and time fields in the app's own look (Simon, from Hub: the
 * browser's time pickers weren't themed, and were hard to use). The browser's
 * own pickers can't be themed, so:
 *
 * - TimeField: a list of times (every 30 or 15 minutes) in the viewer's
 *   clock, or type one: "9", "930", "9:30 pm", "17.30";
 * - DateField: a month calendar in a themed popup, with Today and Clear;
 * - DateTimeField: the two side by side, for a moment (auctions).
 *
 * Values stay in the shapes the forms already keep: "HH:MM", "YYYY-MM-DD"
 * and "YYYY-MM-DDTHH:MM" (local time), "" for none.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { alpha } from "@mui/material/styles";
import { Autocomplete, Box, Button, ButtonBase, IconButton, InputAdornment, Popover, TextField, Typography, type SxProps, type Theme } from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { autocompletePaperProps, dropdownPaperSx } from "./menuStyle";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";

const pad = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" from what someone typed ("9", "930", "9:30 pm", "17.30", "12am"), or null. */
export function parseTime(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm|a|p)?$/.exec(t);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.[0];
  if (half) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (half === "p" ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "HH:MM" in the viewer's clock ("5:30 PM" or "17:30"). */
export function timeLabel(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  return new Date(2000, 0, 1, Number(m[1]), Number(m[2])).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function timesEvery(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

export function TimeField({
  label,
  value,
  onChange,
  step = 30,
  disabled = false,
  required = false,
  helperText,
  sx,
}: {
  label: string;
  /** "HH:MM", or "" for none. */
  value: string;
  onChange: (time: string) => void;
  /** Minutes between the listed times (any time can be typed). */
  step?: number;
  disabled?: boolean;
  required?: boolean;
  helperText?: ReactNode;
  sx?: SxProps<Theme>;
}) {
  const times = useMemo(() => {
    const list = timesEvery(step);
    return value && !list.includes(value) ? [...list, value].sort() : list;
  }, [step, value]);
  const [typed, setTyped] = useState<string | null>(null);
  const wrong = typed !== null && typed.trim() !== "" && !parseTime(typed) && typed !== timeLabel(value);
  return (
    <Autocomplete<string, false, true, true>
      freeSolo
      autoSelect
      forcePopupIcon
      popupIcon={<AccessTimeIcon fontSize="small" />}
      disableClearable
      disablePortal
      options={times}
      value={value}
      getOptionLabel={timeLabel}
      disabled={disabled}
      onInputChange={(_, text, reason) => setTyped(reason === "input" ? text : null)}
      onChange={(_, next) => {
        const time = parseTime(next ?? "") ?? (times.includes(next ?? "") ? next : null);
        if (time) onChange(time);
        setTyped(null);
      }}
      // Typing "17" finds 17:00 and 17:30 in a 12-hour clock too.
      filterOptions={(options, state) => {
        const q = state.inputValue.trim().toLowerCase();
        if (!q || q === timeLabel(value).toLowerCase()) return options;
        const digits = q.replace(/\D/g, "");
        return options.filter((o) => timeLabel(o).toLowerCase().replace(/\s+/g, "").startsWith(q.replace(/\s+/g, "")) || (digits && o.replace(":", "").startsWith(digits.padStart(digits.length > 2 ? 4 : 2, "0"))));
      }}
      slotProps={{ paper: autocompletePaperProps, listbox: { sx: { maxHeight: 280 } } }}
      // The clock stays upright while the list is open.
      sx={[{ "& .MuiAutocomplete-popupIndicatorOpen": { transform: "none" } }, ...(Array.isArray(sx) ? sx : [sx])]}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={wrong || (required && !value)}
          helperText={wrong ? "Type a time like 9:30 or 17:30" : helperText}
          slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, inputMode: "text" }, inputLabel: { ...params.slotProps.inputLabel, shrink: true } }}
        />
      )}
    />
  );
}

/** "YYYY-MM-DD" of a date in local time. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "Tue, Nov 3, 2026", or "Nov 3, 2026" (`short`) where the field is narrow. */
export function dateLabel(text: string, short = false): string {
  const d = parseDay(text);
  return d ? d.toLocaleDateString(undefined, { ...(short ? {} : { weekday: "short" }), day: "numeric", month: "short", year: "numeric" }) : "";
}

/** Monday first. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function Calendar({ value, min, onPick }: { value: string; min?: string; onPick: (day: string) => void }) {
  const chosen = parseDay(value);
  const today = new Date();
  const [month, setMonth] = useState(() => {
    const start = chosen ?? parseDay(min ?? "") ?? today;
    return new Date(start.getFullYear(), start.getMonth(), 1);
  });
  const lead = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const weekday = (day: number) => new Date(2024, 0, day === 0 ? 7 : day).toLocaleDateString(undefined, { weekday: "narrow" });
  return (
    <Box sx={{ p: 1.5, width: 308, maxWidth: "calc(100vw - 32px)" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <IconButton aria-label="Previous month" onClick={() => shift(-1)} sx={{ width: 44, height: 44 }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography aria-live="polite" sx={{ fontWeight: 700 }}>
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Typography>
        <IconButton aria-label="Next month" onClick={() => shift(1)} sx={{ width: 44, height: 44 }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>
      <Box role="group" aria-label={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {WEEK.map((d) => (
          <Typography key={d} aria-hidden variant="caption" color="text.secondary" sx={{ textAlign: "center", fontWeight: 600, py: 0.5 }}>
            {weekday(d)}
          </Typography>
        ))}
        {cells.map((d, i) => {
          if (!d) return <Box key={`blank-${i}`} />;
          const key = dayKey(d);
          const isChosen = key === value.slice(0, 10);
          const isToday = key === dayKey(today);
          const early = !!min && key < min;
          return (
            <ButtonBase
              key={key}
              aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              aria-pressed={isChosen}
              disabled={early}
              onClick={() => onPick(key)}
              sx={(theme) => ({
                height: 40,
                borderRadius: "50%",
                fontSize: 14,
                fontWeight: isChosen || isToday ? 700 : 400,
                color: early ? theme.palette.text.disabled : isChosen ? theme.palette.primary.contrastText : theme.palette.text.primary,
                bgcolor: isChosen ? theme.palette.primary.main : "transparent",
                border: isToday && !isChosen ? `1px solid ${theme.palette.primary.main}` : "1px solid transparent",
                "&:hover": { bgcolor: isChosen ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.12) },
                "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
              })}
            >
              {d.getDate()}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

export function DateField({
  label,
  value,
  onChange,
  min,
  disabled = false,
  required = false,
  clearable = !required,
  helperText,
  sx,
  short = false,
}: {
  label: string;
  /** "YYYY-MM-DD", or "" for none. */
  value: string;
  onChange: (day: string) => void;
  /** The first day that can be picked ("YYYY-MM-DD"). */
  min?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  helperText?: ReactNode;
  sx?: SxProps<Theme>;
  /** Without the weekday ("Nov 3, 2026"): beside the time on a phone, "Tue, Nov 3, 2026" lost its year at 360 px. */
  short?: boolean;
}) {
  const field = useRef<HTMLDivElement>(null);
  // The field the calendar opens under, while it's open.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const setOpen = (open: boolean) => setAnchor(open ? field.current : null);
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };
  return (
    <>
      <TextField
        ref={field}
        label={label}
        value={dateLabel(value, short)}
        placeholder="Choose a date"
        required={required}
        disabled={disabled}
        helperText={helperText}
        onClick={() => !disabled && setOpen(true)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        sx={[{ "& input": { cursor: disabled ? "default" : "pointer" } }, ...(Array.isArray(sx) ? sx : [sx])]}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { readOnly: true, "aria-haspopup": "dialog" },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton aria-label={`Choose: ${label}`} edge="end" disabled={disabled} onClick={() => setOpen(true)} sx={{ width: 44, height: 44 }}>
                  <CalendarMonthOutlinedIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: dropdownPaperSx, role: "dialog", "aria-label": label } }}
      >
        <Calendar value={value} min={min} onPick={pick} />
        <Box sx={{ display: "flex", justifyContent: "space-between", px: 1.5, pb: 1.5 }}>
          <Button onClick={() => pick(dayKey(new Date()))} disabled={!!min && dayKey(new Date()) < min} sx={{ minHeight: 44 }}>
            Today
          </Button>
          {clearable && value && (
            <Button color="inherit" onClick={() => pick("")} sx={{ minHeight: 44 }}>
              Clear
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
}

/** A day and a time ("YYYY-MM-DDTHH:MM", local), side by side; a new day keeps the time (noon to start with). */
export function DateTimeField({
  label,
  value,
  onChange,
  min,
  step = 15,
  disabled = false,
  required = false,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (moment: string) => void;
  min?: string;
  step?: number;
  disabled?: boolean;
  required?: boolean;
  helperText?: ReactNode;
}) {
  const day = value.slice(0, 10);
  const time = value.slice(11, 16);
  const phone = usePhoneLayout();
  return (
    <Box role="group" aria-label={label} sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 1, alignItems: "start" }}>
      <DateField
        label={label}
        value={day}
        short={phone}
        min={min?.slice(0, 10)}
        onChange={(next) => onChange(next ? `${next}T${time || "12:00"}` : "")}
        disabled={disabled}
        required={required}
        clearable={false}
        helperText={helperText}
      />
      <TimeField label="Time" value={time} step={step} onChange={(next) => onChange(`${day || dayKey(new Date())}T${next}`)} disabled={disabled} required={required} />
    </Box>
  );
}
