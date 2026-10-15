/**
 * One card from the original Q-Mintership, read-only: what it said, who it
 * was about and who posted it, its poll result and its comments. Old deep
 * links (#/minter/<card>/<section>) land here; "comments" scrolls to them.
 * Cards from the encrypted admin board are not decrypted: they link out to
 * the original app.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Skeleton, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import {
  findLegacyCard,
  legacyBoardOf,
  legacyCardKey,
  legacyCommentKey,
  loadLegacyCard,
  loadLegacyComment,
  loadLegacyComments,
  loadLegacyPoll,
  type LegacyCard,
  type LegacyCardRow,
  type LegacyCommentRow,
} from '../../data/legacy';
import { QdnDeletedError } from '../../data/qdn';
import { useQuery } from '../../hooks/useQuery';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { PersonChip } from '../../components/common/Person';
import { Card, Section } from '../../components/common/Section';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { PATHS, legacyCardPath } from '../../routes/paths';
import { formatCount, formatDate, formatDateTime, plural } from '../../utils/format';
import { ORIGINAL_APP_LINK, openQortalLink } from '../../utils/links';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { legacyKindLabel, legacyProblem } from './parts/legacyWords';
import { LegacyTextView } from './parts/LegacyText';
import { QortalLinks } from '../../components/common/QortalLinks';
import { PersonByName } from './parts/PersonByName';
import { ListCard } from './parts/TimelineList';

const COMMENTS_PAGE = 20;

export default function LegacyCardPage() {
  const { card: identifier = '', section = '' } = useParams();
  const board = legacyBoardOf(identifier);
  const found = useQuery(board ? `legacy:find:${identifier}` : null, (force) =>
    findLegacyCard(identifier, { force })
  );
  const row = found.data ?? null;

  let content;
  if (!board) {
    content = (
      <EmptyState
        title="That isn't a card from the original app."
        description="Links to the original Q-Mintership's cards start with Minter-board-card, QM-AR-card or card-MAC."
      />
    );
  } else if (board === 'admin') {
    content = <EncryptedCard row={row} loading={found.isLoading} />;
  } else if (found.isError) {
    content = (
      <ErrorState
        title="Couldn't look for this card."
        error={found.error}
        onRetry={() => void found.refetch()}
      />
    );
  } else if (found.isLoading) {
    content = <CardSkeleton lines={4} />;
  } else if (!row) {
    content = (
      <EmptyState
        title="Your node doesn't know this card."
        description="It may have been deleted by its publisher, or your node hasn't seen it yet."
        actionLabel="Try again"
        onAction={() => void found.refetch()}
      />
    );
  } else {
    content = <CardView key={row.identifier} row={row} section={section} />;
  }

  return (
    <>
      <PageHeader
        title={board === 'ar' ? 'Admin proposal' : 'Original card'}
        subtitle="From the original Q-Mintership, read-only."
        back={PATHS.history}
        actions={
          board ? <CopyLinkButton path={legacyCardPath(identifier)} what="this card" /> : null
        }
      />
      <PageBody>{content}</PageBody>
    </>
  );
}

function EncryptedCard({ row, loading }: { row: LegacyCardRow | null; loading: boolean }) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockOutlinedIcon aria-hidden sx={{ color: 'text.secondary' }} />
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
          Encrypted to Minter Admins
        </Typography>
      </Box>
      <Typography>
        This card is from the original Minter Admin board, which only Minter Admins can read.
        Q-Mintership+ doesn&apos;t decrypt it; open it in the original app instead.
      </Typography>
      {row ? (
        <PersonByName
          name={row.publisher}
          secondary={`Posted ${formatDate(row.createdAt)}`}
          size={32}
        />
      ) : loading ? null : (
        <Typography variant="body2" color="text.secondary">
          Your node doesn&apos;t list this card right now.
        </Typography>
      )}
      <Box>
        <Button
          variant="contained"
          endIcon={<OpenInNewOutlinedIcon />}
          onClick={() => void openQortalLink(ORIGINAL_APP_LINK)}
          sx={{ minHeight: 44 }}
        >
          Open in the original app
        </Button>
      </Box>
    </Card>
  );
}

function CardView({ row, section }: { row: LegacyCardRow; section: string }) {
  const query = useQuery(legacyCardKey(row), () => loadLegacyCard(row));
  const card = query.data;
  if (!card) {
    if (query.isError) {
      return query.error instanceof QdnDeletedError ? (
        <EmptyState
          title="This card was deleted by its publisher."
          description={`${row.publisher} removed it from QDN.`}
        />
      ) : (
        <EmptyState
          title={`${legacyProblem(query.error)}.`}
          description="Your node may still be fetching it from peers. Try again in a moment."
          actionLabel="Try again"
          onAction={() => void query.refetch()}
        />
      );
    }
    return <CardSkeleton lines={4} />;
  }
  return (
    <>
      <CardBody card={card} />
      <PollResult card={card} />
      <Alert
        severity="info"
        variant="outlined"
        action={
          card.board === 'minter' ? (
            <Button
              component={RouterLink}
              to={PATHS.nominations}
              color="inherit"
              sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
            >
              Nominations
            </Button>
          ) : undefined
        }
        sx={{
          flexWrap: 'wrap',
          '& .MuiAlert-message': { flex: '1 1 240px', minWidth: 0 },
          '& .MuiAlert-action': { pl: { xs: 0, sm: 2 }, ml: { xs: 0, sm: 'auto' } },
        }}
      >
        {card.board === 'minter'
          ? 'This board is read-only now, and Q-Mintership+ has no votes. New nominations happen in Nominations, and Minter Admins decide by signing.'
          : 'This board is read-only now. Admin changes are proposed and signed by Minter Admins in Decisions.'}
      </Alert>
      <Comments card={card} scrollTo={section === 'comments'} />
    </>
  );
}

function subjectLabel(card: LegacyCard): string {
  if (card.board === 'minter') return 'Nominee';
  if (card.promotion === false) return 'Minter Admin to remove';
  return card.promotion === true ? 'Proposed Minter Admin' : 'About';
}

function CardBody({ card }: { card: LegacyCard }) {
  const edited = card.updatedAt && card.updatedAt > card.createdAt + 60_000;
  return (
    <Card as="article" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box>
          <Chip size="small" variant="outlined" label={legacyKindLabel(card)} />
        </Box>
        <Typography
          component="h2"
          sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 }, overflowWrap: 'anywhere' }}
        >
          {card.title}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}
      >
        <Fact label={subjectLabel(card)}>
          {card.subject.address ? (
            <PersonChip address={card.subject.address} name={card.subject.name} size={32} />
          ) : card.subject.name ? (
            <PersonByName name={card.subject.name} />
          ) : (
            <Typography color="text.secondary">Not named on the card</Typography>
          )}
        </Fact>
        <Fact label={card.selfPosted ? 'Posted by the nominee' : 'Published by'}>
          <PersonByName
            name={card.publisher}
            secondary={`${formatDate(card.createdAt)}${edited ? ` · edited ${formatDate(card.updatedAt as number)}` : ''}`}
          />
        </Fact>
      </Box>
      {card.nominator && card.nominator !== card.publisher ? (
        <Typography variant="body2" color="text.secondary">
          The card names {card.nominator} as the nominator.
        </Typography>
      ) : null}

      {card.body.paragraphs.length ? (
        <LegacyTextView text={card.body} />
      ) : (
        <Typography color="text.secondary">This card has no text.</Typography>
      )}
      <QortalLinks links={card.links} />
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function PollResult({ card }: { card: LegacyCard }) {
  const poll = useQuery(card.pollName ? `legacy:poll:${card.pollName}` : null, (force) =>
    loadLegacyPoll(card, { force })
  );
  let body;
  if (!card.pollName || poll.data === null) {
    body = (
      <Typography variant="body2" color="text.secondary">
        No poll result on chain for this card.
      </Typography>
    );
  } else if (poll.isError) {
    body = (
      <ErrorState
        compact
        title="Couldn't read the poll."
        error={poll.error}
        onRetry={() => void poll.refetch()}
      />
    );
  } else if (!poll.data) {
    body = <Typography color="text.secondary">Reading the poll…</Typography>;
  } else {
    const { yes, no, total } = poll.data;
    const yesShare = yes + no > 0 ? yes / (yes + no) : 0;
    body = (
      <>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'baseline' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
            {formatCount(yes)} yes
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
            {formatCount(no)} no
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {plural(total, 'vote')}, one per account
          </Typography>
        </Box>
        <Box
          role="img"
          aria-label={`${formatCount(yes)} yes and ${formatCount(no)} no`}
          sx={{
            display: 'flex',
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <Box sx={{ width: `${Math.round(yesShare * 100)}%`, bgcolor: 'success.main' }} />
          <Box sx={{ flex: 1, bgcolor: no > 0 ? 'error.main' : 'transparent' }} />
        </Box>
        {poll.data.ownerMatches === false ? (
          <Typography variant="body2" color="text.secondary">
            The original app didn&apos;t list this card: its poll belongs to a different account
            than the card&apos;s publisher.
          </Typography>
        ) : null}
      </>
    );
  }
  return (
    <Section title="Poll result" id="legacy-poll">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>{body}</Card>
    </Section>
  );
}

function Comments({ card, scrollTo }: { card: LegacyCard; scrollTo: boolean }) {
  const comments = useQuery(`legacy:comments:${card.identifier}`, (force) =>
    loadLegacyComments(card.identifier, { force })
  );
  const [shown, setShown] = useState(COMMENTS_PAGE);
  const anchor = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const ready = Boolean(comments.data);
  useEffect(() => {
    if (!scrollTo || !ready || scrolled.current) return;
    scrolled.current = true;
    anchor.current?.scrollIntoView?.({ block: 'start' });
  }, [scrollTo, ready]);

  const rows = comments.data?.rows ?? [];
  let body;
  if (comments.isError && !comments.data) {
    body = (
      <ErrorState
        compact
        title="Couldn't load the comments."
        error={comments.error}
        onRetry={() => void comments.refetch()}
      />
    );
  } else if (!comments.data) {
    body = <ListSkeleton count={2} label="Loading comments" />;
  } else if (!rows.length) {
    body = (
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        No one commented on this card.
      </Typography>
    );
  } else {
    body = (
      <>
        <ListCard>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {rows.slice(0, shown).map((row) => (
              <CommentItem key={`${row.author}:${row.identifier}`} row={row} />
            ))}
          </Box>
        </ListCard>
        {comments.data.truncated ? <TruncatedNote what="the comments" /> : null}
        {rows.length > shown ? (
          <Box>
            <Button
              variant="outlined"
              onClick={() => setShown((n) => n + COMMENTS_PAGE)}
              sx={{ minHeight: 44 }}
            >
              Show more comments ({formatCount(rows.length - shown)})
            </Button>
          </Box>
        ) : null}
      </>
    );
  }
  return (
    <Box ref={anchor} sx={{ scrollMarginTop: 72 }}>
      <Section
        title={comments.data ? `Comments (${formatCount(rows.length)})` : 'Comments'}
        id="legacy-comments"
      >
        {body}
      </Section>
    </Box>
  );
}

function CommentItem({ row }: { row: LegacyCommentRow }) {
  const query = useQuery(legacyCommentKey(row), () => loadLegacyComment(row));
  const comment = query.data;
  if (!comment && query.error instanceof QdnDeletedError) return null;
  const edited = row.editedAt && row.editedAt > row.postedAt + 60_000;
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <PersonByName
        name={row.author}
        size={28}
        secondary={`${formatDateTime(row.postedAt)}${edited ? ' · edited' : ''}`}
      />
      {comment?.replyTo ? (
        <Box
          sx={{
            borderLeft: 3,
            borderColor: 'divider',
            pl: 1.25,
            color: 'text.secondary',
            minWidth: 0,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Replying to {comment.replyTo.author ?? 'a comment'}
          </Typography>
          {comment.replyTo.excerpt ? (
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {comment.replyTo.excerpt}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      {comment ? (
        <>
          <LegacyTextView text={comment.body} />
          <QortalLinks links={comment.body.links} />
        </>
      ) : query.isError ? (
        <Typography variant="body2" color="text.secondary">
          {legacyProblem(query.error, 'comment')}.
        </Typography>
      ) : (
        <Box aria-hidden>
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="60%" />
        </Box>
      )}
    </Box>
  );
}
