/**
 * The Explorer Quiz at the bottom of the screen (Simon, 2026-10-16): the
 * open question and a field for its answer stay there on every Explorer
 * page, so the answer can be looked for anywhere in the Explorer. Above
 * the phone's bottom bar; its height kept clear for focus (BOTTOM_BAR_VAR).
 *
 * It says how the answer went ("Right!", "Not quite"), offers a hint (where
 * to look), shows the answer with how it is found and a link to the page
 * that shows it, and makes the next question, at any level or one picked.
 * Folds to one line; × closes it (the score and the questions asked stay).
 * Loaded only while the quiz is on (AppShell).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { MarkedName } from '../../common/MarkedName';
import { BOTTOM_NAV_HEIGHT } from '../../layout/BottomNav';
import { useBottomNavShown } from '../../layout/useBottomNav';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../../hooks/useOverlayPadding';
import { answerWords } from '../../../rules/explorer/quiz/check';
import { QUIZ_LEVELS, type QuizLevel, type QuizPart } from '../../../rules/explorer/quiz/types';
import { useQuiz, useQuizBusy, useQuizFailed } from '../../../state/explorerQuiz';
import { formatCount } from '../../../utils/format';
import { withHue } from '../../../pages/decisions/sectionAccents';
import { readableOn } from '../../../utils/readable';
import {
  askNext,
  closeQuiz,
  foldQuiz,
  revealAnswer,
  setQuizLevel,
  showHint,
  submitAnswer,
} from './quizActions';

const LEVEL_HUE: Record<QuizLevel, number> = { easy: 150, medium: 210, tricky: 285 };

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** The question's parts as text: names in bold, an address whole, blocks with their number. */
export function QuestionText({ parts }: { parts: readonly QuizPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case 'text':
            return <span key={i}>{part.text}</span>;
          case 'account':
            return part.name ? (
              <Box component="strong" key={i}>
                <bdi dir="auto">
                  <MarkedName name={part.name} />
                </bdi>
              </Box>
            ) : (
              <Box
                component="code"
                key={i}
                sx={{ fontFamily: MONO, fontSize: '0.92em', wordBreak: 'break-all' }}
              >
                {part.address}
              </Box>
            );
          case 'name':
            return (
              <Box component="strong" key={i}>
                “
                <bdi dir="auto">
                  <MarkedName name={part.name} />
                </bdi>
                ”
              </Box>
            );
          case 'group':
            return (
              <Box component="strong" key={i}>
                {part.name ? (
                  <>
                    “<bdi dir="auto">{part.name}</bdi>” (#{part.id})
                  </>
                ) : (
                  `#${part.id}`
                )}
              </Box>
            );
          case 'block':
            return (
              <Box component="strong" key={i} sx={{ whiteSpace: 'nowrap' }}>
                block {formatCount(part.height)}
              </Box>
            );
        }
      })}
    </>
  );
}

function LevelChip({ level }: { level: QuizLevel }) {
  const label = QUIZ_LEVELS.find((l) => l.value === level)?.label ?? level;
  return (
    <Box
      component="span"
      sx={(theme) => {
        const colour = withHue(theme.palette.info.main, LEVEL_HUE[level]);
        return {
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.25,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          color: readableOn(theme, colour, 0.14),
          bgcolor: alpha(colour, 0.14),
          border: 1,
          borderColor: alpha(colour, 0.45),
          whiteSpace: 'nowrap',
        };
      }}
    >
      {label}
    </Box>
  );
}

function scoreWords(score: { asked: number; right: number; streak: number }): string {
  const base = `${formatCount(score.right)} of ${formatCount(score.asked)} right`;
  return score.streak >= 2 ? `${base} · ${formatCount(score.streak)} in a row` : base;
}

export default function QuizDock() {
  const quiz = useQuiz();
  const busy = useQuizBusy();
  const navShown = useBottomNavShown();
  const [node, setNode] = useState<HTMLElement | null>(null);
  usePublishOverlay(node, BOTTOM_BAR_VAR, { gap: navShown ? 8 : 16 });

  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [said, setSaid] = useState('');
  const failed = useQuizFailed();
  const fieldRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const { question, status, folded } = quiz;
  const key = question?.key ?? null;

  // A new question: an empty field, nothing said yet.
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setInput('');
    setSaid('');
  }
  // A question just made (by Next, or by the Explorer's button): into its field.
  const wasBusy = useRef(busy);
  useEffect(() => {
    if (wasBusy.current && !busy && key && status === 'asking') fieldRef.current?.focus();
    wasBusy.current = busy;
  }, [busy, key, status]);
  // Answered or shown while open: on to Next question (not when a page opens with it so).
  const lastStatus = useRef(status);
  useEffect(() => {
    if (lastStatus.current === 'asking' && status !== 'asking') nextRef.current?.focus();
    lastStatus.current = status;
  }, [status]);

  const next = () => void askNext();

  const check = async (event: FormEvent) => {
    event.preventDefault();
    if (checking || !input.trim()) return;
    setChecking(true);
    setSaid('');
    try {
      const right = await submitAnswer(input);
      setSaid(right ? 'Right!' : 'Not quite. Look again, or take a hint.');
    } finally {
      setChecking(false);
    }
  };

  const bodyId = 'explorer-quiz-body';

  return (
    <Box
      ref={setNode}
      component="section"
      aria-label="Explorer Quiz"
      className="qmp-fade"
      sx={(theme) => ({
        position: 'sticky',
        bottom: navShown ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom) + 8px)` : 16,
        zIndex: theme.zIndex.appBar - 2,
        mt: 'auto',
        mx: 'auto',
        mb: navShown ? 1 : 2,
        width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 32px)' },
        maxWidth: 880,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: { xs: 1.25, sm: 1.5 },
        borderRadius: 2,
        border: 1,
        borderColor: alpha(theme.palette.primary.main, 0.55),
        bgcolor: 'background.paper',
        boxShadow: theme.shadows[8],
        maxHeight: folded ? undefined : 'min(60vh, 520px)',
        overflowY: folded ? undefined : 'auto',
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            flexShrink: 0,
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.14),
          })}
        >
          <QuizOutlinedIcon fontSize="small" />
        </Box>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          Explorer Quiz
        </Typography>
        {question ? <LevelChip level={question.level} /> : null}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            ml: 'auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            // Phones have no room beside the title: the score is under the buttons there.
            display: { xs: 'none', sm: 'block' },
          }}
        >
          {quiz.score.asked ? scoreWords(quiz.score) : null}
        </Typography>
        <Tooltip title={folded ? 'Show the question' : 'Fold'}>
          <IconButton
            onClick={() => foldQuiz(!folded)}
            aria-expanded={!folded}
            aria-controls={bodyId}
            aria-label={folded ? 'Show the question' : 'Fold the quiz'}
            sx={{ width: 44, height: 44, flexShrink: 0, ml: { xs: 'auto', sm: 0 } }}
          >
            {folded ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Close the quiz">
          <IconButton
            onClick={closeQuiz}
            aria-label="Close the quiz"
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          >
            <CloseOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {folded ? (
        question ? (
          <Typography
            variant="body2"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            <QuestionText parts={question.parts} />
          </Typography>
        ) : null
      ) : (
        <Box id={bodyId} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
          {busy ? (
            <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}>
              <CircularProgress size={20} aria-hidden />
              <Typography>Thinking of a question…</Typography>
            </Box>
          ) : failed || !question ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              <Typography role="status" sx={{ flex: '1 1 240px' }}>
                {failed
                  ? 'Couldn’t make a question just now. Your node may be busy.'
                  : 'No question open.'}
              </Typography>
              <Button variant="contained" onClick={next} sx={{ minHeight: 44 }}>
                {failed ? 'Try again' : 'Ask me one'}
              </Button>
            </Box>
          ) : (
            <>
              <Typography
                sx={{ fontSize: { xs: 16, sm: 17 }, lineHeight: 1.5, overflowWrap: 'anywhere' }}
              >
                <QuestionText parts={question.parts} />
              </Typography>

              {status === 'asking' ? (
                <Box
                  component="form"
                  onSubmit={(event) => void check(event)}
                  noValidate
                  aria-label="Your answer"
                  sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1 }}
                >
                  <TextField
                    inputRef={fieldRef}
                    label="Your answer"
                    placeholder={question.placeholder}
                    size="small"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    slotProps={{
                      htmlInput: {
                        autoComplete: 'off',
                        spellCheck: false,
                        enterKeyHint: 'done',
                        'aria-describedby': 'explorer-quiz-said',
                      },
                    }}
                    sx={{ flex: '1 1 220px', '& .MuiInputBase-root': { minHeight: 44 } }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    aria-disabled={checking || !input.trim() || undefined}
                    sx={{ minHeight: 44, flex: '0 0 auto' }}
                  >
                    {checking ? 'Checking…' : 'Check'}
                  </Button>
                </Box>
              ) : null}

              <Typography
                id="explorer-quiz-said"
                role="status"
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: (theme) => readableOn(theme, theme.palette.warning.main, 0),
                  display: said && status === 'asking' ? 'block' : 'none',
                }}
              >
                {status === 'asking' ? said : ''}
              </Typography>

              {quiz.hinted && status === 'asking' ? (
                <Box
                  sx={(theme) => ({
                    display: 'flex',
                    gap: 1,
                    alignItems: 'flex-start',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                  })}
                >
                  <LightbulbOutlinedIcon
                    fontSize="small"
                    sx={{ color: 'warning.main', mt: '2px' }}
                  />
                  <Typography variant="body2">{question.hint}</Typography>
                </Box>
              ) : null}

              {status !== 'asking' ? (
                <Box
                  role="status"
                  sx={(theme) => ({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    p: 1.25,
                    borderRadius: 1,
                    bgcolor: alpha(
                      status === 'right' ? theme.palette.success.main : theme.palette.info.main,
                      0.1
                    ),
                  })}
                >
                  <Typography
                    sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700 }}
                  >
                    {status === 'right' ? (
                      <CheckCircleOutlinedIcon
                        className="qmp-pop"
                        fontSize="small"
                        sx={{ color: 'success.main' }}
                      />
                    ) : null}
                    {status === 'right' ? 'Right!' : 'The answer'}
                  </Typography>
                  <Typography sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {answerWords(question)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {question.how}
                  </Typography>
                  <Box>
                    <Button
                      component={RouterLink}
                      to={question.link}
                      endIcon={<ChevronRightOutlinedIcon />}
                      sx={{ minHeight: 44, px: 1 }}
                    >
                      {question.linkLabel}
                    </Button>
                  </Box>
                </Box>
              ) : null}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                {status === 'asking' ? (
                  <>
                    <Button
                      startIcon={<LightbulbOutlinedIcon />}
                      onClick={showHint}
                      aria-disabled={quiz.hinted || undefined}
                      sx={{ minHeight: 44 }}
                    >
                      Hint
                    </Button>
                    <Button onClick={revealAnswer} sx={{ minHeight: 44 }}>
                      Show the answer
                    </Button>
                  </>
                ) : null}
                <Button
                  ref={nextRef}
                  variant={status === 'asking' ? 'text' : 'contained'}
                  onClick={next}
                  sx={{ minHeight: 44 }}
                >
                  {status === 'asking' ? 'Another question' : 'Next question'}
                </Button>
                <TextField
                  select
                  label="Level"
                  size="small"
                  value={quiz.level ?? 'any'}
                  onChange={(e) =>
                    setQuizLevel(QUIZ_LEVELS.find((l) => l.value === e.target.value)?.value ?? null)
                  }
                  slotProps={{ select: { native: true } }}
                  sx={{
                    ml: { sm: 'auto' },
                    width: 150,
                    '& .MuiInputBase-root': { minHeight: 44 },
                  }}
                >
                  <option value="any">Any level</option>
                  {QUIZ_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </TextField>
              </Box>
              {quiz.score.asked ? (
                // Phones: the score here, under the buttons (the title row has no room).
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ display: { xs: 'block', sm: 'none' } }}
                >
                  {scoreWords(quiz.score)}
                </Typography>
              ) : null}
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
