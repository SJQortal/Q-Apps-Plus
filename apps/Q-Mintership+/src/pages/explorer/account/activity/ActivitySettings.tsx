/**
 * Activity's settings (Simon, 2026-10-17: "a gear icon and once pressed
 * there user can adjust the default auto fetch to lower that amount to
 * whatever he wants, there can be examples as well like: 100, 500, 2000.
 * and in these settings user can also select to hide Milestones"): how many
 * of an account's newest transactions Activity reads when it opens (and
 * each Read older reads), and which kinds of milestones it shows. Saved at
 * once, on this device (state/settings.ts).
 */
import { useId, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useAtom } from 'jotai';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import {
  ACTIVITY_FIRST_READ_CHOICES,
  ACTIVITY_FIRST_READ_DEFAULT,
  ACTIVITY_FIRST_READ_MAX,
  ACTIVITY_FIRST_READ_MIN,
  activityFirstReadAtom,
  activityHiddenMarksAtom,
  clampActivityRead,
} from '../../../../state/settings';
import { formatCount } from '../../../../utils/format';
import { MARK_KIND_LABELS } from './activityWords';

const OTHER = 'other';

export function ActivitySettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stored, setFirstRead] = useAtom(activityFirstReadAtom);
  const [hidden, setHidden] = useAtom(activityHiddenMarksAtom);
  const firstRead = clampActivityRead(stored);
  const preset = (ACTIVITY_FIRST_READ_CHOICES as readonly number[]).includes(firstRead);
  const [other, setOther] = useState(!preset);
  const [typed, setTyped] = useState(preset ? '' : String(firstRead));
  const [problem, setProblem] = useState<string | null>(null);
  const readId = useId();
  const marksId = useId();

  const applyTyped = (text: string) => {
    const n = Number(text.replace(/[\s,]/g, ''));
    if (!text.trim() || !Number.isFinite(n) || n < ACTIVITY_FIRST_READ_MIN) {
      setProblem(
        `A number from ${formatCount(ACTIVITY_FIRST_READ_MIN)} to ${formatCount(ACTIVITY_FIRST_READ_MAX)}.`
      );
      return;
    }
    const value = clampActivityRead(n);
    setProblem(null);
    setFirstRead(value);
    setTyped(String(value));
  };

  const hiddenSet = new Set(hidden);
  const toggle = (kind: string) =>
    setHidden(hiddenSet.has(kind) ? hidden.filter((k) => k !== kind) : [...hidden, kind]);

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Activity settings"
      actions={
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
          Done
        </Button>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box component="section" aria-labelledby={readId}>
          <Typography id={readId} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
            Transactions read at first
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            How many of an account&rsquo;s newest transactions Activity reads when it opens, and how
            many more each Read older reads. Fewer is lighter on a slow device or connection.
          </Typography>
          <RadioGroup
            aria-labelledby={readId}
            value={other ? OTHER : String(firstRead)}
            onChange={(e) => {
              if (e.target.value === OTHER) {
                setOther(true);
                if (typed) applyTyped(typed);
                return;
              }
              setOther(false);
              setProblem(null);
              setFirstRead(Number(e.target.value));
            }}
          >
            {ACTIVITY_FIRST_READ_CHOICES.map((n) => (
              <FormControlLabel
                key={n}
                value={String(n)}
                control={<Radio />}
                label={
                  n === ACTIVITY_FIRST_READ_DEFAULT
                    ? `${formatCount(n)} (the default)`
                    : formatCount(n)
                }
                sx={{ minHeight: 44 }}
              />
            ))}
            <FormControlLabel
              value={OTHER}
              control={<Radio />}
              label="Another number"
              sx={{ minHeight: 44 }}
            />
          </RadioGroup>
          {other ? (
            <TextField
              label="Transactions"
              size="small"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onBlur={() => applyTyped(typed)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyTyped(typed);
              }}
              error={Boolean(problem)}
              helperText={
                problem ??
                `From ${formatCount(ACTIVITY_FIRST_READ_MIN)} to ${formatCount(ACTIVITY_FIRST_READ_MAX)}, read in hundreds.`
              }
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              sx={{ mt: 1, maxWidth: 260, '& .MuiInputBase-root': { minHeight: 44 } }}
            />
          ) : null}
        </Box>

        <Box component="section" aria-labelledby={marksId}>
          <Typography id={marksId} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
            Milestones shown
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            On the chart and in the list under it.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {MARK_KIND_LABELS.map(({ kind, label }) => (
              <FormControlLabel
                key={kind}
                control={<Checkbox checked={!hiddenSet.has(kind)} onChange={() => toggle(kind)} />}
                label={label}
                sx={{ minHeight: 44 }}
              />
            ))}
          </Box>
          <Button
            onClick={() => setHidden([])}
            disabled={!hidden.length}
            sx={{ minHeight: 44, mt: 0.5 }}
          >
            Show every milestone
          </Button>
        </Box>
      </Box>
    </ResponsiveDialog>
  );
}
