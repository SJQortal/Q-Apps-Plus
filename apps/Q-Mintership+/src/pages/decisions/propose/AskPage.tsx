/**
 * + Propose → Ask the Minter Admins, a page as every + Propose choice is
 * (Simon, 2026-10-18: "Make all of these "+ Propose" windows in the style of
 * the "+ Propose" Nomination"), at `/propose/ask-minter-admins`, for Minter
 * Admins with a registered name: a question (10–200 characters), optional
 * details, its answers (Yes, No and Neutral to start with, each renamed and
 * coloured green, red or neutral, up to six: PollAnswersEditor), and how long
 * voting stays open (1–30 days, 7 by default, with its end from the measured
 * block time); What happens next; then the submit bar, whose button opens the
 * one Hub step that publishes it encrypted to the Minter Admins (0.01 QORT),
 * explained before Hub opens. Advisory only: nothing changes on chain from
 * the result. Once it is published, the page says so, with the poll's own
 * page, Decisions and Ask another.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, TextField, Typography } from '@mui/material';
import { HubStepDialog } from '../../../components/common/HubStepDialog';
import { Card, Section } from '../../../components/common/Section';
import { EmptyState, ErrorState, HeroSkeleton } from '../../../components/common/states';
import { BOTTOM_NAV_HEIGHT } from '../../../components/layout/BottomNav';
import { PageBody } from '../../../components/layout/PageBody';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useBottomNavShown } from '../../../components/layout/useBottomNav';
import {
  DEFAULT_ANSWERS,
  DETAILS_MAX,
  DURATION_DEFAULT_DAYS,
  DURATION_MAX_DAYS,
  DURATION_MIN_DAYS,
  QUESTION_MAX,
  QUESTION_MIN,
  answersProblems,
  normaliseAnswerLabel,
  normaliseDetails,
  normaliseQuestion,
  pollEnd,
  type PollAnswer,
} from '../../../data/adminPollRecords';
import { headerFill } from '../../../hub-theme';
import { useAdmins, useChainNow, useMyStatus } from '../../../hooks/useData';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../../hooks/useOverlayPadding';
import { adminPollPath } from '../../../routes/paths';
import { signIn, useSession } from '../../../state/session';
import { focusElement } from '../../../utils/focus';
import { formatCount, formatDateTime, plural } from '../../../utils/format';
import { useLandscapeFrame } from '../../../utils/hubFrame';
import { publishAdminPoll, type PollAuthor } from '../../../writes/adminPolls';
import { ADVISORY, encryptedCheck, encryptedTo } from '../adminPollUi';
import { decisionsKindPath, decisionsViewPath } from '../decisionsViews';
import { NeedsName } from '../NeedsName';
import { PollAnswersEditor } from '../PollAnswersEditor';
import { TONE_COLOUR } from '../pollAnswerTones';
import { APP_NAME } from '../../../constants/plus';

export const ASK_TITLE = 'Ask the Minter Admins';

const DAYS = Array.from(
  { length: DURATION_MAX_DAYS - DURATION_MIN_DAYS + 1 },
  (_, i) => DURATION_MIN_DAYS + i
);

export default function AskPage() {
  const session = useSession();
  const { status, isError, error, refetch } = useMyStatus();
  let body: ReactNode;
  if (session.status === 'outside') {
    body = (
      <EmptyState
        title={`Open ${APP_NAME} in Qortal Hub or GO`}
        description="A poll is published and encrypted through Hub, so it needs Hub."
      />
    );
  } else if (session.status === 'signedOut' || session.status === 'error') {
    body = (
      <EmptyState
        title="Sign in to ask"
        description="Minter Admins ask each other questions here, and vote on them."
        actionLabel="Sign in"
        onAction={() => void signIn()}
      />
    );
  } else if (!status && isError) {
    body = (
      <ErrorState
        title="Couldn’t check your account."
        error={error}
        onRetry={() => void refetch()}
      />
    );
  } else if (!status || session.status !== 'ready') {
    body = <HeroSkeleton />;
  } else if (!status.isAdmin) {
    body = (
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Only Minter Admins ask here
        </Typography>
        <Typography>
          Minter Admin polls are questions the Minter Admins ask each other, encrypted to them.
        </Typography>
        <Box>
          <Button
            component={RouterLink}
            to={decisionsViewPath('decisions')}
            variant="outlined"
            sx={{ minHeight: 44 }}
          >
            Open Decisions
          </Button>
        </Box>
      </Card>
    );
  } else {
    const author: PollAuthor = {
      address: session.address,
      publicKey: session.publicKey,
      name: status.name ?? session.name ?? null,
    };
    body = <AskForm author={author} />;
  }
  return (
    <>
      <PageHeader
        title={ASK_TITLE}
        subtitle="Ask a question, pick its answers and how long."
        back={decisionsKindPath('askAdmins')}
      />
      <PageBody $maxWidth={680}>{body}</PageBody>
    </>
  );
}

function AskForm({ author }: { author: PollAuthor }) {
  const [question, setQuestion] = useState('');
  const [details, setDetails] = useState('');
  const [days, setDays] = useState(DURATION_DEFAULT_DAYS);
  const [answers, setAnswers] = useState<PollAnswer[]>(() =>
    DEFAULT_ANSWERS.map((a) => ({ ...a }))
  );
  const [attempted, setAttempted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  // The poll just published: the page says so once its Hub step is closed.
  const pollId = useRef<string | null>(null);
  const doneTitleId = useId();
  const chain = useChainNow();
  const adminList = useAdmins().data;
  const admins = adminList?.signers.length ?? 0;
  const landscape = useLandscapeFrame();
  const navShown = useBottomNavShown();
  const [submitBar, setSubmitBar] = useState<HTMLElement | null>(null);
  usePublishOverlay(submitBar, BOTTOM_BAR_VAR, { enabled: !landscape && !published });
  // Once published, the form (and the button that opened the dialog) is gone: focus goes to the news.
  useEffect(() => {
    if (published) {
      const title = document.getElementById(doneTitleId);
      if (title) focusElement(title);
    }
  }, [published, doneTitleId]);

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

  if (!author.name)
    return (
      <NeedsName
        address={author.address}
        title="Asking needs a registered name"
        text="A poll is published on QDN under a name, so the Minter Admins can see who asked."
      />
    );

  if (published)
    return (
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography
          id={doneTitleId}
          tabIndex={-1}
          component="h2"
          sx={{ fontSize: 18, fontWeight: 700, outline: 'none' }}
        >
          Poll published
        </Typography>
        <Typography variant="body2">
          It shows in Minter Admin polls now, and for the other Minter Admins once QDN has it,
          usually within a minute or two.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            component={RouterLink}
            to={adminPollPath(published)}
            variant="contained"
            sx={{ minHeight: 44 }}
          >
            Open the poll
          </Button>
          <Button component={RouterLink} to={decisionsKindPath('askAdmins')} sx={{ minHeight: 44 }}>
            Open Decisions
          </Button>
          <Button
            onClick={() => {
              setPublished(null);
              setQuestion('');
              setDetails('');
              setDays(DURATION_DEFAULT_DAYS);
              setAnswers(DEFAULT_ANSWERS.map((a) => ({ ...a })));
              setAttempted(false);
            }}
            sx={{ minHeight: 44 }}
          >
            Ask another
          </Button>
        </Box>
      </Card>
    );

  const hint = questionError ?? detailsError ?? answersError ?? 'Ready to ask.';
  const ready = !questionError && !detailsError && !answersError;
  const submit = () => {
    setAttempted(true);
    if (ready) setDialogOpen(true);
    else if (questionError) questionRef.current?.focus();
    else if (detailsError) detailsRef.current?.focus();
  };

  return (
    <>
      <Section title="Question" id="question">
        <TextField
          label="Question"
          required
          inputRef={questionRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          error={attempted && Boolean(questionError)}
          helperText={
            attempted && questionError
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
      </Section>

      <Section title="Answers" id="answers">
        <PollAnswersEditor
          answers={answers}
          onChange={setAnswers}
          problem={attempted ? answersError : null}
          legendHidden
        />
      </Section>

      <Section title="How long" id="how-long">
        <TextField
          select
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
      </Section>

      <Section title="What happens next" id="next">
        <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">
            The Minter Admins vote one of its answers, and each admin’s latest vote counts, until it
            ends. They can comment on it too.
          </Typography>
          <Typography variant="body2">
            Published under your name, {author.name}. {encryptedTo(admins)} Minter Admins added
            later can be shared with from the poll.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ADVISORY} One Hub step, 0.01 QORT.
          </Typography>
        </Card>
      </Section>

      <Box
        ref={setSubmitBar}
        sx={{
          position: landscape ? 'static' : 'sticky',
          bottom: navShown ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
          zIndex: 2,
          mx: { xs: -1.5, sm: -2 },
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1, sm: 1.5 },
          bgcolor: (theme) => headerFill(theme),
          backdropFilter: 'blur(12px)',
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography
            variant="body2"
            role="status"
            color={attempted && !ready ? 'error' : 'text.secondary'}
          >
            {attempted && !ready ? `Can’t ask yet: ${hint}` : hint}
          </Typography>
        </Box>
        <Button
          ref={submitRef}
          variant="contained"
          size="large"
          onClick={submit}
          sx={{ minHeight: 48, flexShrink: 0 }}
        >
          {ASK_TITLE}
        </Button>
      </Box>

      <HubStepDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          if (pollId.current) {
            setPublished(pollId.current);
            pollId.current = null;
          }
        }}
        returnFocus={() => document.getElementById(doneTitleId) ?? submitRef.current}
        title={ASK_TITLE}
        onBack={() => setDialogOpen(false)}
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
        run={async (report) => {
          const result = await publishAdminPoll(
            author,
            { question: q, details: d || null, durationDays: days, answers: cleanAnswers },
            (stage) => report(0, stage)
          );
          if (result.outcome.status === 'sent') pollId.current = result.pollId;
          return { outcome: result.outcome };
        }}
        successTitle="Poll published"
        successText={
          <Typography variant="body2">
            It shows in Minter Admin polls now, and for the other Minter Admins once QDN has it,
            usually within a minute or two.
          </Typography>
        }
      />
    </>
  );
}
