/**
 * "In the original app, under any of their names": the cards they posted on
 * the original Q-Mintership's boards (each read as it shows, shared with
 * History), how many comments they wrote on cards, the encrypted admin
 * board as counts only, and their votes in the cards' chain polls on
 * request. Read when the section nears the screen
 * (data/explorer/legacyBy.ts).
 */
import { useState, useSyncExternalStore } from 'react';
import { Box, Button } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import type { LegacyCardRow, LegacyIndex } from '../../../../data/legacy';
import {
  loadLegacyBy,
  loadPollVotes,
  type LegacyBy,
  type PollVote,
} from '../../../../data/explorer/legacyBy';
import { getQueryState, peekQuery, subscribeQuery } from '../../../../data/query';
import { useInView } from '../../../../hooks/useInView';
import { useQuery } from '../../../../hooks/useQuery';
import { legacyCardPath } from '../../../../routes/paths';
import {
  formatBlock,
  formatCount,
  formatDate,
  plural,
  sentenceStart,
} from '../../../../utils/format';
import { LegacyCardItem } from '../../../history/parts/LegacyCardItem';
import { pollVotesCounted, pollVotesSummary } from './mintershipWords';
import { AlsoChecked, ItemLink, NamesFound, Note, SteppedList, SubHeading } from './parts';
import { ORIGINAL_WORDS } from '../../../../constants/plus';

function subscribeIndex(listener: () => void) {
  return subscribeQuery('legacy:index', listener);
}
function cachedIndex(): LegacyIndex | undefined {
  return getQueryState<LegacyIndex>('legacy:index').data;
}

/**
 * Their cards, less any posted under an identifier another name used first
 * (the original app, and History, show that first card), when History's
 * index of every card is already in hand: this never reads it.
 */
function useOwnCards(posted: LegacyBy): { own: LegacyCardRow[]; copies: number } {
  const index = useSyncExternalStore(subscribeIndex, cachedIndex);
  if (!index) return { own: posted.cards, copies: 0 };
  const names = new Set(posted.names);
  const first = new Map(index.cards.map((c) => [c.identifier, c.publisher]));
  const own = posted.cards.filter((c) => {
    const publisher = first.get(c.identifier);
    return !publisher || names.has(publisher);
  });
  return { own, copies: posted.cards.length - own.length };
}

function commentWords(count: { comments: number; cards: number }, what: string): string {
  return `${plural(count.comments, 'comment')} on ${plural(count.cards, what)}`;
}

function PostedBody({ address, posted }: { address: string; posted: LegacyBy }) {
  const { own, copies } = useOwnCards(posted);
  const none: string[] = [];
  const comments: string[] = [];
  if (posted.minterComments.comments)
    comments.push(commentWords(posted.minterComments, 'nomination card'));
  else none.push('comments on nomination cards');
  if (posted.arComments.comments) comments.push(commentWords(posted.arComments, 'admin proposal'));
  else none.push('comments on admin proposals');
  if (!own.length && !copies) none.unshift('cards');
  const admin = posted.adminCards || posted.adminComments;
  if (!admin) none.push('encrypted admin board posts');
  const hasNames = posted.names.length > 0;

  return (
    <>
      <NamesFound
        names={posted.names}
        withRecords={posted.namesWithRecords}
        truncated={posted.namesTruncated}
      />
      {own.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <SubHeading>Cards they posted · {formatCount(own.length)}</SubHeading>
          <SteppedList
            items={own}
            card={false}
            label={`${sentenceStart(ORIGINAL_WORDS.adjective)} cards they posted`}
            keyOf={(row) => row.identifier}
            render={(row) => <LegacyCardItem row={row} />}
          />
        </Box>
      ) : null}
      {copies ? (
        <Note>
          {plural(copies, own.length ? 'more post' : 'post')} under a card’s identifier another name
          used first ({ORIGINAL_WORDS.app} shows that first card).
        </Note>
      ) : null}
      {comments.length ? <Note>Comments: {comments.join('; ')}.</Note> : null}
      {admin ? (
        <Note>
          Encrypted admin board: {plural(posted.adminCards, 'card')} and{' '}
          {plural(posted.adminComments, 'comment')} (counted only, never opened).
        </Note>
      ) : null}
      {posted.truncated.length ? (
        <Note role="note">
          Some counts stopped at their ceiling (the newest 300 of a kind per 40 names).
        </Note>
      ) : null}
      {hasNames ? <AlsoChecked items={none} /> : null}
      <SubHeading>Poll votes</SubHeading>
      <PollVotesPanel address={address} />
    </>
  );
}

function VoteRow({ vote }: { vote: PollVote }) {
  const said =
    vote.answer === 'yes'
      ? 'Voted Yes'
      : vote.answer === 'no'
        ? 'Voted No'
        : vote.option
          ? `Voted “${vote.option}”`
          : 'A vote this screen couldn’t read';
  const what = vote.board === 'minter' ? 'Nomination card poll' : 'Admin proposal poll';
  return (
    <ItemLink
      to={legacyCardPath(vote.card)}
      title={said}
      label={`${said}: open the card`}
      secondary={
        <>
          {vote.description ? (
            <>
              <bdi dir="auto">{vote.description}</bdi>
              {' · '}
            </>
          ) : null}
          {what} · {vote.height !== null ? `${formatBlock(vote.height)} · ` : ''}
          {formatDate(vote.timestamp)}
        </>
      }
    />
  );
}

/** Their votes in the original app's chain polls, read when asked (the search is heavy). */
export function PollVotesPanel({ address }: { address: string }) {
  const key = `xpollvotes:${address}`;
  const [asked, setAsked] = useState(() => peekQuery(key) !== undefined);
  const votes = useQuery(asked ? key : null, (force) => loadPollVotes(address, { force }));
  if (!asked)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
        <Button variant="outlined" onClick={() => setAsked(true)} sx={{ minHeight: 44 }}>
          Show their poll votes
        </Button>
        <Note>Reads their newest 100 votes in chain polls.</Note>
      </Box>
    );
  if (!votes.data)
    return votes.isError ? (
      <ErrorState
        compact
        title="Couldn't read their poll votes."
        error={votes.error}
        onRetry={() => void votes.refetch()}
      />
    ) : (
      <ListSkeleton count={1} label="Reading their poll votes" />
    );
  const data = votes.data;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Note>{pollVotesSummary(data)}</Note>
      {pollVotesCounted(data).map((line) => (
        <Note key={line}>{line}</Note>
      ))}
      {data.votes.length ? (
        <SteppedList
          items={data.votes}
          label={`Their ${ORIGINAL_WORDS.adjective} poll votes, newest first`}
          keyOf={(v) => v.signature}
          render={(vote) => <VoteRow vote={vote} />}
        />
      ) : null}
    </Box>
  );
}

export function OriginalPosted({ address, eager = false }: { address: string; eager?: boolean }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const near = useInView(node);
  const posted = useQuery(`xlegacyby:${address}`, (force) => loadLegacyBy(address, { force }), {
    enabled: near || eager,
  });
  return (
    <Section
      title={`In ${ORIGINAL_WORDS.app}, under any of their names`}
      id="explorer-mintership-original"
    >
      <Box ref={setNode} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {posted.data ? (
          <PostedBody address={address} posted={posted.data} />
        ) : posted.isError ? (
          <ErrorState
            compact
            title={`Couldn't read what they posted in ${ORIGINAL_WORDS.app}.`}
            error={posted.error}
            onRetry={() => void posted.refetch()}
          />
        ) : (
          <ListSkeleton count={1} label={`Reading what they posted in ${ORIGINAL_WORDS.app}`} />
        )}
      </Box>
    </Section>
  );
}
