/**
 * A Minter Admin's answers, all time, on request (data/explorer/answers.ts):
 * "Show their answers" reads 5 pages of 100, newest first, and "Load more"
 * the next 5; Stop ends a step after the page being read. Each answer on a
 * MINTER decision: Approved or Rejected, the decision in the app's words,
 * who it was about, its block, and a link to the decision. Answers on
 * anything else are counted, not listed.
 */
import { useState, useSyncExternalStore } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { PersonInline } from '../../../../components/common/Person';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import {
  ANSWER_PAGE_SIZE,
  ANSWER_STEP_PAGES,
  answersProgress,
  loadAnswers,
  stopAnswers,
  subscribeAnswersProgress,
  type Answer,
  type AnswersRead,
} from '../../../../data/explorer/answers';
import { peekQuery } from '../../../../data/query';
import { useQuery } from '../../../../hooks/useQuery';
import { decisionTitle } from '../../../../rules/decision';
import { decisionPath } from '../../../../routes/paths';
import { formatCount, formatDate } from '../../../../utils/format';
import { answersLeftOut, answersSummary } from './mintershipWords';
import { useDecisionSubject } from './useDecisionSubject';
import { Note, SteppedList } from './parts';

function AnswerRow({ answer }: { answer: Answer }) {
  const d = answer.decision;
  const subject = useDecisionSubject(d);
  const title = decisionTitle(d);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" sx={{ overflowWrap: 'anywhere' }}>
          <strong>{answer.approval ? 'Approved' : 'Rejected'}</strong>
          {' · '}
          {title}
          {subject ? (
            <>
              {': '}
              <PersonInline address={subject} />
            </>
          ) : null}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {answer.height !== null ? `Block ${formatCount(answer.height)} · ` : ''}
          {formatDate(answer.timestamp)}
        </Typography>
      </Box>
      <Button
        component={RouterLink}
        to={decisionPath(d.signature)}
        aria-label={`Open the decision: ${title}`}
        sx={{ minHeight: 44, flexShrink: 0 }}
      >
        Open
      </Button>
    </Box>
  );
}

function useProgress(address: string) {
  return useSyncExternalStore(subscribeAnswersProgress, () => answersProgress(address));
}

export function AnswersPanel({ address }: { address: string }) {
  const key = `xanswers:${address}`;
  const [asked, setAsked] = useState(() => peekQuery<AnswersRead>(key) !== undefined);
  const query = useQuery(asked ? key : null, (force) => loadAnswers(address, { force }));
  const progress = useProgress(address);
  const data = query.data;
  const running = query.fetching;

  if (!asked)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
        <Button variant="outlined" onClick={() => setAsked(true)} sx={{ minHeight: 44 }}>
          Show their answers
        </Button>
        <Note>
          Reads their approvals and rejections on chain,{' '}
          {formatCount(ANSWER_PAGE_SIZE * ANSWER_STEP_PAGES)} at a time, newest first.
        </Note>
      </Box>
    );

  const more = () => void loadAnswers(address, { more: true }).catch(() => {});
  const status = running
    ? progress
      ? `Reading their answers: page ${progress.page} of ${progress.of}…`
      : 'Waiting to read their answers…'
    : data?.stopped
      ? 'Stopped. Load more to go on.'
      : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {data ? (
        <>
          <Note>{answersSummary(data)}</Note>
          {answersLeftOut(data).map((line) => (
            <Note key={line}>{line}</Note>
          ))}
          {data.decisionsCapped ? (
            <Note role="note">
              Matched against the newest {formatCount(data.decisionsRead)} MINTER decisions.
            </Note>
          ) : null}
          {data.answers.length ? (
            <SteppedList
              items={data.answers}
              label="Their answers on MINTER decisions, newest first"
              keyOf={(a) => a.signature}
              render={(answer) => <AnswerRow answer={answer} />}
            />
          ) : null}
        </>
      ) : query.isError ? (
        <ErrorState
          compact
          title="Couldn't read their answers."
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <ListSkeleton count={1} label="Reading their answers" />
      )}
      {data && query.error && !running ? (
        <ErrorState
          compact
          title="Couldn't read more of their answers."
          error={query.error}
          onRetry={more}
        />
      ) : null}
      <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        {status}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {running ? (
          <Button variant="outlined" onClick={() => stopAnswers(address)} sx={{ minHeight: 44 }}>
            Stop
          </Button>
        ) : data && !data.done ? (
          <Button variant="outlined" onClick={more} sx={{ minHeight: 44 }}>
            Load {formatCount(ANSWER_PAGE_SIZE * ANSWER_STEP_PAGES)} more
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}
