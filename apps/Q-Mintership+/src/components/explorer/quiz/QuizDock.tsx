/**
 * The Explorer Quiz at the bottom of the screen (Simon, 2026-10-16): the
 * open question and a field for its answer stay there on every Explorer
 * page, so the answer can be looked for anywhere in the Explorer. Above
 * the phone's bottom bar; its height kept clear for focus (BOTTOM_BAR_VAR).
 *
 * Each question has a heading for its theme ("Follow the money") and its
 * level. A typed answer can be tried again and again; a multiple-choice
 * one has one go. A hint says where to look, a closer hint narrows it and
 * offers the page that shows it. The answer comes with how it is found, a
 * fact, and a link. Then the next question, at any level or one picked.
 * Folds to one line; × closes it (the score and the questions asked stay).
 * Quiz history opens every question asked so far, with how it went
 * (QuizHistory). Loaded only while the quiz is on (AppShell).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import { BOTTOM_NAV_HEIGHT } from '../../layout/BottomNav';
import { explorerAccountPath } from '../../../routes/paths';
import { useBottomNavShown } from '../../layout/useBottomNav';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../../hooks/useOverlayPadding';
import { answerWords } from '../../../rules/explorer/quiz/check';
import { QUIZ_LEVELS, type QuizQuestion } from '../../../rules/explorer/quiz/types';
import {
  MISSED_CHOICE_LINES,
  RIGHT_LINES,
  say,
  SHOWN_LINES,
  streakLine,
  THINKING_LINES,
  WRONG_LINES,
} from '../../../rules/explorer/quiz/words';
import { useQuiz, useQuizBusy, useQuizFailed, type QuizState } from '../../../state/explorerQuiz';
import { formatCount } from '../../../utils/format';
import { LevelChip, QuestionText } from './quizParts';
import { QuizHistory } from './QuizHistory';
import { readableOn } from '../../../utils/readable';
import {
  askNext,
  closeQuiz,
  foldQuiz,
  revealAnswer,
  setQuizLevel,
  showHint,
  submitAnswer,
  submitChoice,
} from './quizActions';

function scoreWords(score: { asked: number; right: number; streak: number }): string {
  const base = `${formatCount(score.right)} of ${formatCount(score.asked)} right`;
  return score.streak >= 2 ? `${base} · ${formatCount(score.streak)} in a row` : base;
}

/** While a question is made: a line that changes now and then (read out once, plainly). */
function Thinking() {
  const [line, setLine] = useState(() => say(Math.random, THINKING_LINES));
  useEffect(() => {
    const timer = setInterval(() => setLine(say(Math.random, THINKING_LINES)), 1600);
    return () => clearInterval(timer);
  }, []);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1 }}>
      <CircularProgress size={20} aria-hidden />
      <Typography aria-hidden>{line}</Typography>
      <span role="status" className="qmp-visually-hidden">
        Thinking of a question
      </span>
    </Box>
  );
}

/** A multiple-choice question's options: one go, then the right one green and a wrong pick red. */
function Options({
  question,
  state,
  onPick,
}: {
  question: QuizQuestion;
  state: QuizState;
  onPick: (index: number) => void;
}) {
  if (question.answer.kind !== 'choice') return null;
  const { options, correct } = question.answer;
  const done = state.status !== 'asking';
  return (
    <Box
      role="group"
      aria-label="Pick one (one go)"
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {options.map((option, i) => {
        const isRight = done && i === correct;
        const wrongPick = done && state.picked === i && i !== correct;
        return (
          <Button
            key={i}
            variant="outlined"
            onClick={() => (done ? undefined : onPick(i))}
            aria-disabled={done || undefined}
            startIcon={
              isRight ? (
                <CheckCircleOutlinedIcon className="qmp-pop" />
              ) : wrongPick ? (
                <CancelOutlinedIcon />
              ) : (
                <RadioButtonUncheckedOutlinedIcon />
              )
            }
            sx={(theme) => ({
              justifyContent: 'flex-start',
              textAlign: 'left',
              textTransform: 'none',
              minHeight: 44,
              fontSize: 15,
              color: 'text.primary',
              overflowWrap: 'anywhere',
              borderColor: isRight
                ? theme.palette.success.main
                : wrongPick
                  ? theme.palette.error.main
                  : theme.palette.divider,
              bgcolor: isRight
                ? alpha(theme.palette.success.main, 0.12)
                : wrongPick
                  ? alpha(theme.palette.error.main, 0.1)
                  : undefined,
              '& .MuiButton-startIcon': {
                color: isRight ? 'success.main' : wrongPick ? 'error.main' : 'text.secondary',
              },
            })}
          >
            <span>
              <QuestionText parts={option.parts} />
              {isRight ? <span className="qmp-visually-hidden">, the answer</span> : null}
              {wrongPick ? <span className="qmp-visually-hidden">, your pick</span> : null}
            </span>
          </Button>
        );
      })}
    </Box>
  );
}

function HintBox({ children }: { children: React.ReactNode }) {
  return (
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
      <LightbulbOutlinedIcon fontSize="small" sx={{ color: 'warning.main', mt: '2px' }} />
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export default function QuizDock() {
  const quiz = useQuiz();
  const busy = useQuizBusy();
  const failed = useQuizFailed();
  const navShown = useBottomNavShown();
  const [node, setNode] = useState<HTMLElement | null>(null);
  usePublishOverlay(node, BOTTOM_BAR_VAR, { gap: navShown ? 8 : 16 });

  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  /** What was said to the last typed answer that missed. */
  const [said, setSaid] = useState('');
  /** The words over the answer once it is answered or shown. */
  const [cheer, setCheer] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyButton = quiz.history.length ? (
    <Button
      startIcon={<HistoryOutlinedIcon />}
      onClick={() => setHistoryOpen(true)}
      sx={{ minHeight: 44 }}
    >
      Quiz history
    </Button>
  ) : null;
  const { question, status, folded } = quiz;
  const key = question?.key ?? null;
  const choice = question?.answer.kind === 'choice';

  // A new question: an empty field, nothing said yet.
  const [shownKey, setShownKey] = useState(key);
  if (shownKey !== key) {
    setShownKey(key);
    setInput('');
    setSaid('');
    setCheer('');
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
      if (right) setCheer(say(Math.random, RIGHT_LINES));
      else setSaid(say(Math.random, WRONG_LINES));
    } finally {
      setChecking(false);
    }
  };

  const pick = (index: number) => {
    const right = submitChoice(index);
    setCheer(say(Math.random, right ? RIGHT_LINES : MISSED_CHOICE_LINES));
  };

  const reveal = () => {
    setCheer(say(Math.random, SHOWN_LINES));
    void revealAnswer();
  };

  const bodyId = 'explorer-quiz-body';
  const streak = status === 'right' ? streakLine(quiz.score.streak, quiz.score.best) : null;
  const closer = question?.hint2 ?? 'Here is the page that shows it.';

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
        maxHeight: folded ? undefined : 'min(62vh, 560px)',
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
            <QuestionText parts={question.parts} links />
          </Typography>
        ) : null
      ) : (
        <Box id={bodyId} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
          {busy ? (
            <Thinking />
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
              {historyButton}
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {question.kicker ? (
                  <Typography
                    sx={(theme) => ({
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: readableOn(theme, theme.palette.primary.main, 0),
                    })}
                  >
                    {question.kicker}
                  </Typography>
                ) : null}
                <Typography
                  sx={{ fontSize: { xs: 16, sm: 17 }, lineHeight: 1.5, overflowWrap: 'anywhere' }}
                >
                  <QuestionText parts={question.parts} links />
                </Typography>
              </Box>

              {choice ? <Options question={question} state={quiz} onPick={pick} /> : null}

              {!choice && status === 'asking' ? (
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

              {quiz.hints >= 1 && status === 'asking' ? (
                <HintBox>
                  <Typography variant="body2">{question.hint}</Typography>
                </HintBox>
              ) : null}
              {quiz.hints >= 2 && status === 'asking' ? (
                <HintBox>
                  <Typography variant="body2">{closer}</Typography>
                  <Button
                    component={RouterLink}
                    to={question.link}
                    size="small"
                    endIcon={<ChevronRightOutlinedIcon />}
                    sx={{ minHeight: 44, px: 1, ml: -1 }}
                  >
                    Show me where
                  </Button>
                </HintBox>
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
                    {cheer || (status === 'right' ? 'Right!' : 'The answer')}
                  </Typography>
                  {streak ? (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {streak}
                    </Typography>
                  ) : null}
                  {/* The options already show a multiple-choice answer. */}
                  {choice ? null : (
                    <Typography sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {question.answer.kind === 'account' ? (
                        // An account answer opens it, a step of the trail.
                        <Link
                          component={RouterLink}
                          to={explorerAccountPath(question.answer.address)}
                          state={{ via: 'explorer' }}
                          color="inherit"
                          underline="always"
                        >
                          {answerWords(question)}
                        </Link>
                      ) : (
                        answerWords(question)
                      )}
                    </Typography>
                  )}
                  {question.fact ? (
                    <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                      {question.fact}
                    </Typography>
                  ) : null}
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
                      aria-disabled={quiz.hints >= 2 || undefined}
                      sx={{ minHeight: 44 }}
                    >
                      {quiz.hints === 0 ? 'Hint' : 'Closer hint'}
                    </Button>
                    <Button onClick={reveal} sx={{ minHeight: 44 }}>
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
                {historyButton}
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
      <QuizHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={quiz.history}
        score={quiz.score}
      />
    </Box>
  );
}
