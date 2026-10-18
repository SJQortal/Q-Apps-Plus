/**
 * The answers of a Minter Admin poll, as the asker writes them (Simon,
 * 2026-10-18: "the default is Yes, No, Netural. and then MAs can rename it,
 * change color (green, red, neutral) when they are creating the poll" and
 * "add more answers"): 2 to 6 rows, each its words and its colour, with
 * Remove; Add an answer under them. Yes, No and Neutral keep their ids when
 * renamed (votes on them read the same everywhere); added ones take the
 * next free id (data/adminPollRecords.ts).
 */
import { Box, Button, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import {
  ADDED_ANSWER_IDS,
  ANSWERS_MAX,
  ANSWERS_MIN,
  ANSWER_LABEL_MAX,
  ANSWER_TONES,
  type AnswerTone,
  type PollAnswer,
} from '../../data/adminPollRecords';
import { TONE_COLOUR, TONE_WORDS } from './pollAnswerTones';
import { visuallyHidden } from '@mui/utils';

export function PollAnswersEditor({
  answers,
  onChange,
  problem,
  legendHidden = false,
}: {
  answers: PollAnswer[];
  onChange: (answers: PollAnswer[]) => void;
  /** What is wrong with them, shown under the list once Review was pressed. */
  problem: string | null;
  /** Its "Answers" for screen readers only: a page's section already titles it so. */
  legendHidden?: boolean;
}) {
  const free = ADDED_ANSWER_IDS.find((id) => !answers.some((a) => a.id === id));
  const canAdd = answers.length < ANSWERS_MAX && free !== undefined;
  const set = (i: number, patch: Partial<PollAnswer>) =>
    onChange(answers.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
      <Typography
        component="legend"
        sx={legendHidden ? visuallyHidden : { fontWeight: 600, mb: 0.5 }}
      >
        Answers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        What the Minter Admins can vote: rename them, pick each one’s colour, add up to{' '}
        {ANSWERS_MAX} or keep at least {ANSWERS_MIN}.
      </Typography>
      <Box
        component="ol"
        aria-label="Answers"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {answers.map((a, i) => (
          <Box
            component="li"
            key={a.id}
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1 }}
          >
            <Box
              aria-hidden
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: TONE_COLOUR[a.tone],
                mt: 2.25,
                flexShrink: 0,
              }}
            />
            <TextField
              label={`Answer ${i + 1}`}
              size="small"
              value={a.label}
              onChange={(e) => set(i, { label: e.target.value })}
              slotProps={{ htmlInput: { maxLength: ANSWER_LABEL_MAX + 10 } }}
              sx={{ flex: '1 1 160px', minWidth: 0, '& .MuiInputBase-root': { minHeight: 44 } }}
            />
            <TextField
              select
              label={`Answer ${i + 1}’s colour`}
              size="small"
              value={a.tone}
              onChange={(e) => set(i, { tone: e.target.value as AnswerTone })}
              slotProps={{ select: { native: true } }}
              sx={{ flex: '0 1 150px', '& .MuiInputBase-root': { minHeight: 44 } }}
            >
              {ANSWER_TONES.map((tone) => (
                <option key={tone} value={tone}>
                  {TONE_WORDS[tone]}
                </option>
              ))}
            </TextField>
            <Tooltip
              title={answers.length <= ANSWERS_MIN ? `Keep at least ${ANSWERS_MIN}` : 'Remove'}
            >
              <span>
                <IconButton
                  aria-label={`Remove answer ${i + 1}${a.label.trim() ? `, ${a.label.trim()}` : ''}`}
                  onClick={() => onChange(answers.filter((_, j) => j !== i))}
                  disabled={answers.length <= ANSWERS_MIN}
                  sx={{ width: 44, height: 44 }}
                >
                  <DeleteOutlineOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ))}
      </Box>
      <Button
        startIcon={<AddOutlinedIcon />}
        onClick={() => free && onChange([...answers, { id: free, label: '', tone: 'neutral' }])}
        disabled={!canAdd}
        sx={{ minHeight: 44, mt: 0.5 }}
      >
        Add an answer
      </Button>
      {problem ? (
        <Typography role="alert" variant="body2" color="error" sx={{ mt: 0.5 }}>
          {problem}
        </Typography>
      ) : null}
    </Box>
  );
}
