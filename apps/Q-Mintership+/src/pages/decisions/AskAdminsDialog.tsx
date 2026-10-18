/**
 * Decisions → Propose → Ask the Minter Admins: a question (10–200
 * characters), optional details, its answers (Yes, No and Neutral to start
 * with, each renamed and coloured green, red or neutral, up to six:
 * PollAnswersEditor), and how long voting stays open (1–30 days, 7 by
 * default, with its end from the measured block time); Review;
 * then one Hub step that publishes it encrypted to the Minter Admins (0.01
 * QORT), explained before Hub opens. Needs a registered name, like
 * comments. Advisory only: nothing changes on chain from the result.
 */
import { useId, useRef, useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import {
  DEFAULT_ANSWERS,
  answersProblems,
  normaliseAnswerLabel,
  type PollAnswer,
  DETAILS_MAX,
  DURATION_DEFAULT_DAYS,
  DURATION_MAX_DAYS,
  DURATION_MIN_DAYS,
  QUESTION_MAX,
  QUESTION_MIN,
  normaliseDetails,
  normaliseQuestion,
  pollEnd,
} from '../../data/adminPollRecords';
import { useChainNow } from '../../hooks/useData';
import { formatCount, formatDateTime, plural } from '../../utils/format';
import { publishAdminPoll, type PollAuthor } from '../../writes/adminPolls';
import { NeedsName } from './NeedsName';
import { ADVISORY, encryptedCheck, encryptedTo } from './adminPollUi';
import { PollAnswersEditor } from './PollAnswersEditor';
import { TONE_COLOUR } from './pollAnswerTones';

const DAYS = Array.from(
  { length: DURATION_MAX_DAYS - DURATION_MIN_DAYS + 1 },
  (_, i) => DURATION_MIN_DAYS + i
);

export interface AskAdminsDialogProps {
  open: boolean;
  onClose: () => void;
  author: PollAuthor;
  /** How many Minter Admins can sign now (it is encrypted to all of them). */
  admins: number;
  /** Where focus goes once it is over (the menu item that opened it is gone). */
  returnFocus?: () => HTMLElement | null;
}

export default function AskAdminsDialog({
  open,
  onClose,
  author,
  admins,
  returnFocus,
}: AskAdminsDialogProps) {
  const [phase, setPhase] = useState<'form' | 'hub'>('form');
  const [question, setQuestion] = useState('');
  const [details, setDetails] = useState('');
  const [days, setDays] = useState(DURATION_DEFAULT_DAYS);
  const [answers, setAnswers] = useState<PollAnswer[]>(() =>
    DEFAULT_ANSWERS.map((a) => ({ ...a }))
  );
  const [touched, setTouched] = useState(false);
  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement | null>(null);
  const durationId = useId();
  const chain = useChainNow();

  const q = normaliseQuestion(question);
  const d = normaliseDetails(details);
  const questionError =
    q.length < QUESTION_MIN
      ? `Write a question of at least ${QUESTION_MIN} characters.`
      : q.length > QUESTION_MAX
        ? `Keep the question under ${QUESTION_MAX} characters.`
        : null;
  const detailsError =
    d.length > DETAILS_MAX
      ? `Keep the details under ${DETAILS_MAX.toLocaleString('en-US')} characters.`
      : null;
  const cleanAnswers = answers.map((a) => ({ ...a, label: normaliseAnswerLabel(a.label) }));
  const answersError = answersProblems(cleanAnswers)[0] ?? null;
  // Where it would end if asked now (the publish works it out again, fresh).
  const end = chain.data ? pollEnd(chain.data, days, Date.now()) : null;
  const endLine = end
    ? `Voting ends about ${formatDateTime(end.endsAt)}, at block ${formatCount(end.endHeight)} (from the measured block time, ${(chain.data!.msPerBlock / 1000).toFixed(1)} s a block).`
    : 'Working out the end from the measured block time…';

  const close = () => {
    onClose();
    setPhase('form');
  };
  const review = () => {
    setTouched(true);
    if (questionError) questionRef.current?.focus();
    else if (detailsError) detailsRef.current?.focus();
    else if (!answersError) setPhase('hub');
  };

  const hasName = Boolean(author.name);

  return (
    <>
      <ResponsiveDialog
        open={open && phase === 'form'}
        onClose={close}
        returnFocus={returnFocus}
        title="Ask the Minter Admins"
        actions={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="contained" onClick={review} disabled={!hasName}>
              Review
            </Button>
          </>
        }
      >
        <Typography color="text.secondary">
          A poll for the Minter Admins: they vote one of its answers (Yes, No or Neutral unless you
          change them), and each admin’s latest vote counts. {encryptedTo(admins)}
        </Typography>
        <Alert severity="info" role="note">
          {ADVISORY}
        </Alert>
        {!hasName ? (
          <NeedsName
            address={author.address}
            title="Asking needs a registered name"
            text="A poll is published on QDN under a name, so the Minter Admins can see who asked."
          />
        ) : (
          <>
            <TextField
              label="Question"
              required
              inputRef={questionRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={() => setTouched(true)}
              error={touched && Boolean(questionError)}
              helperText={
                touched && questionError
                  ? questionError
                  : `${formatCount(q.length)} / ${QUESTION_MAX} characters. It is one line: line breaks become spaces.`
              }
              // Wraps, so all of it shows on a phone.
              multiline
              minRows={2}
              maxRows={5}
              fullWidth
              slotProps={{ htmlInput: { maxLength: QUESTION_MAX + 20 } }}
            />
            <TextField
              label="Details (optional)"
              inputRef={detailsRef}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              error={Boolean(detailsError)}
              helperText={
                detailsError ??
                `Context for the question. ${formatCount(d.length)} / ${formatCount(DETAILS_MAX)}.`
              }
              multiline
              minRows={3}
              maxRows={10}
              fullWidth
            />
            <PollAnswersEditor
              answers={answers}
              onChange={setAnswers}
              problem={touched ? answersError : null}
            />
            <TextField
              select
              id={durationId}
              label="Voting stays open for"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value))}
              helperText={endLine}
              fullWidth
              slotProps={{ select: { native: true } }}
            >
              {DAYS.map((n) => (
                <option key={n} value={n}>
                  {plural(n, 'day')}
                  {n === DURATION_DEFAULT_DAYS ? ' (the default)' : ''}
                </option>
              ))}
            </TextField>
          </>
        )}
      </ResponsiveDialog>

      <HubStepDialog
        open={open && phase === 'hub'}
        onClose={close}
        returnFocus={returnFocus}
        title="Ask the Minter Admins"
        onBack={() => setPhase('form')}
        intro={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
              component="blockquote"
              sx={{
                m: 0,
                pl: 1.5,
                borderLeft: 3,
                borderColor: 'divider',
                fontWeight: 600,
                overflowWrap: 'anywhere',
              }}
            >
              {q}
            </Box>
            {d ? (
              <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{d}</Typography>
            ) : null}
            <Box
              component="ul"
              aria-label="Its answers"
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}
            >
              {cleanAnswers.map((a) => (
                <Box
                  component="li"
                  key={a.id}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 4,
                    border: 1,
                    borderColor: 'divider',
                    fontWeight: 600,
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: TONE_COLOUR[a.tone],
                    }}
                  />
                  {a.label}
                </Box>
              ))}
            </Box>
            <Typography variant="body2">{endLine}</Typography>
            <Typography variant="body2" color="text.secondary">
              Published under your name, {author.name}. {encryptedTo(admins)} Minter Admins added
              later can be shared with from the poll.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {ADVISORY}
            </Typography>
          </Box>
        }
        steps={[
          {
            action: 'PUBLISH_QDN_RESOURCE',
            title: `Publish, encrypted to the ${plural(admins, 'Minter Admin')}`,
            check: encryptedCheck(author.name ?? '', 'qmp-adminpoll-'),
            feeTxType: 'ARBITRARY',
          },
        ]}
        run={async (report) => ({
          outcome: (
            await publishAdminPoll(
              author,
              { question: q, details: d || null, durationDays: days, answers: cleanAnswers },
              (stage) => report(0, stage)
            )
          ).outcome,
        })}
        successTitle="Poll published"
        successText={
          <Typography variant="body2">
            It shows in Minter Admin polls now, and for the other Minter Admins once QDN has it,
            usually within a minute or two.
          </Typography>
        }
        onSuccess={() => {
          setQuestion('');
          setDetails('');
          setDays(DURATION_DEFAULT_DAYS);
          setAnswers(DEFAULT_ANSWERS.map((a) => ({ ...a })));
          setTouched(false);
        }}
      />
    </>
  );
}
