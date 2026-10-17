/**
 * The Explorer Quiz's history (Simon, 2026-10-17: so a player can see their
 * previous questions): every question asked on this device (the newest
 * 100), newest first, each with how it went (right, answer shown, or
 * skipped), its level and heading, the answer, a wrong pick, the fact and
 * how it is found, and a link to the page that shows it. A summary over
 * them (right of asked, best streak, by level), a filter by how they went,
 * and Clear the history (the score and the questions asked stay, so none
 * comes back).
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { ResponsiveDialog } from '../../common/ResponsiveDialog';
import { QUIZ_LEVELS } from '../../../rules/explorer/quiz/types';
import type { QuizHistoryEntry, QuizOutcome, QuizScore } from '../../../state/explorerQuiz';
import { formatCount, formatDateTime } from '../../../utils/format';
import { readableOn } from '../../../utils/readable';
import { LevelChip, QuestionText } from './quizParts';
import { clearQuizHistory } from './quizActions';

type Filter = 'all' | QuizOutcome;

const OUTCOME: Record<QuizOutcome, { label: string; tone: 'success' | 'info' | 'grey' }> = {
  right: { label: 'Right', tone: 'success' },
  shown: { label: 'Answer shown', tone: 'info' },
  skipped: { label: 'Skipped', tone: 'grey' },
};

function OutcomeMark({ outcome }: { outcome: QuizOutcome }) {
  const { label, tone } = OUTCOME[outcome];
  const Icon =
    outcome === 'right'
      ? CheckCircleOutlinedIcon
      : outcome === 'shown'
        ? VisibilityOutlinedIcon
        : SkipNextOutlinedIcon;
  return (
    <Box
      component="span"
      sx={(theme) => {
        const colour = tone === 'grey' ? theme.palette.text.secondary : theme.palette[tone].main;
        return {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          color: readableOn(theme, colour, 0.14),
          bgcolor: alpha(colour, 0.14),
          whiteSpace: 'nowrap',
          '& svg': { fontSize: 16 },
        };
      }}
    >
      <Icon aria-hidden />
      {label}
    </Box>
  );
}

function Entry({ entry, onLeave }: { entry: QuizHistoryEntry; onLeave: () => void }) {
  return (
    <Box
      component="li"
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        p: 1.5,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.03 : 0.02),
        minWidth: 0,
      })}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <OutcomeMark outcome={entry.outcome} />
        <LevelChip level={entry.level} />
        {entry.kicker ? (
          <Typography
            component="span"
            sx={(theme) => ({
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: readableOn(theme, theme.palette.primary.main, 0),
            })}
          >
            {entry.kicker}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 'auto' } }}>
          {formatDateTime(entry.at)}
        </Typography>
      </Box>
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        <QuestionText parts={entry.parts} />
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
        <strong>Answer:</strong> {entry.answer}
        {entry.picked && entry.outcome !== 'right' ? ` · your pick: ${entry.picked}` : ''}
        {entry.outcome === 'right' && entry.misses
          ? ` · after ${formatCount(entry.misses)} ${entry.misses === 1 ? 'miss' : 'misses'}`
          : ''}
        {entry.hints ? ` · ${entry.hints === 1 ? 'with a hint' : 'with both hints'}` : ''}
      </Typography>
      {entry.fact ? (
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {entry.fact}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {entry.how}
      </Typography>
      <Box>
        <Button
          component={RouterLink}
          to={entry.link}
          onClick={onLeave}
          endIcon={<ChevronRightOutlinedIcon />}
          sx={{ minHeight: 44, px: 1, ml: -1 }}
        >
          {entry.linkLabel}
        </Button>
      </Box>
    </Box>
  );
}

/** "9 of 12 right · best streak 4", and by level: "Easy 4 of 4 · Medium 3 of 5 …". */
function summary(history: readonly QuizHistoryEntry[], score: QuizScore) {
  const byLevel = QUIZ_LEVELS.map(({ value, label }) => {
    const of = history.filter((e) => e.level === value);
    return of.length
      ? `${label} ${formatCount(of.filter((e) => e.outcome === 'right').length)} of ${formatCount(of.length)}`
      : null;
  }).filter(Boolean);
  return {
    overall: `${formatCount(score.right)} of ${formatCount(score.asked)} right · best streak ${formatCount(score.best)}`,
    byLevel: byLevel.join(' · '),
  };
}

export function QuizHistory({
  open,
  onClose,
  history,
  score,
}: {
  open: boolean;
  onClose: () => void;
  history: readonly QuizHistoryEntry[];
  score: QuizScore;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [clearing, setClearing] = useState(false);
  const newest = [...history].reverse();
  const shown = filter === 'all' ? newest : newest.filter((e) => e.outcome === filter);
  const count = (outcome: QuizOutcome) => history.filter((e) => e.outcome === outcome).length;
  const { overall, byLevel } = summary(history, score);
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Your quiz history"
      maxWidth="md"
      actions={
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Close
        </Button>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>{overall}</Typography>
          {byLevel ? (
            <Typography variant="body2" color="text.secondary">
              {byLevel}
            </Typography>
          ) : null}
        </Box>
        {history.length ? (
          <>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={filter}
              onChange={(_, value: Filter | null) => value && setFilter(value)}
              aria-label="Show"
              sx={{ flexWrap: 'wrap' }}
            >
              <ToggleButton value="all" sx={{ minHeight: 44, textTransform: 'none' }}>
                All · {formatCount(history.length)}
              </ToggleButton>
              {(['right', 'shown', 'skipped'] as const).map((outcome) => (
                <ToggleButton
                  key={outcome}
                  value={outcome}
                  disabled={!count(outcome)}
                  sx={{ minHeight: 44, textTransform: 'none' }}
                >
                  {OUTCOME[outcome].label} · {formatCount(count(outcome))}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Box
              component="ul"
              aria-label="Questions asked, newest first"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              {shown.map((entry) => (
                <Entry key={entry.key} entry={entry} onLeave={onClose} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              {clearing ? (
                <>
                  <Typography variant="body2" sx={{ flex: '1 1 220px' }}>
                    Clear all {formatCount(history.length)} from this device? The score stays, and
                    these questions still won’t come back.
                  </Typography>
                  <Button
                    color="error"
                    variant="outlined"
                    onClick={() => {
                      clearQuizHistory();
                      setClearing(false);
                      setFilter('all');
                    }}
                    sx={{ minHeight: 44 }}
                  >
                    Clear
                  </Button>
                  <Button onClick={() => setClearing(false)} sx={{ minHeight: 44 }}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button color="inherit" onClick={() => setClearing(true)} sx={{ minHeight: 44 }}>
                  Clear the history
                </Button>
              )}
            </Box>
          </>
        ) : (
          <Typography color="text.secondary">
            No questions here yet: each one shows up once it is answered, shown or skipped.
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
