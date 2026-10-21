/**
 * One card from the original Q-Mintership, read-only: what it said, who it
 * was about and who posted it, its poll result and its comments. Old deep
 * links (#/minter/<card>/<section>) land here; "comments" scrolls to them.
 * Cards from the encrypted Admin Board are decrypted for Minter Admins
 * (data/legacyAdminBoard.ts), comments included; anyone else, or an admin
 * the card wasn't encrypted to, sees who posted it and when.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Chip, Skeleton, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
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
  type LegacyComment,
  type LegacyCommentRow,
} from '../../data/legacy';
import {
  adminCardKey,
  adminCommentKey,
  loadAdminCard,
  loadAdminComment,
} from '../../data/legacyAdminBoard';
import { useAdminViewer } from '../../hooks/useViewerIsAdmin';
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
import { PATHS, decisionsViewPath, legacyCardPath } from '../../routes/paths';
import { formatCount, formatDate, formatDateTime, plural, sentenceStart } from '../../utils/format';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { legacyKindLabel, legacyProblem } from './parts/legacyWords';
import { LegacyTextView } from './parts/LegacyText';
import { QortalLinks } from '../../components/common/QortalLinks';
import { PersonByName } from './parts/PersonByName';
import { ListCard } from './parts/TimelineList';
import { MarkedName } from '../../components/common/MarkedName';
import { APP_NAME, ORIGINAL_WORDS } from '../../constants/plus';
import { NOT_ENCRYPTED_TO_YOU } from './parts/LegacyCardItem';

const COMMENTS_PAGE = 20;

export default function LegacyCardPage() {
  const { card: identifier = '', section = '' } = useParams();
  const board = legacyBoardOf(identifier);
  const { viewer, isAdmin, known } = useAdminViewer();
  const found = useQuery(board ? `legacy:find:${identifier}` : null, (force) =>
    findLegacyCard(identifier, { force })
  );
  const row = found.data ?? null;

  let content;
  if (!board) {
    content = (
      <EmptyState
        title={`That isn't a card from ${ORIGINAL_WORDS.app}.`}
        description={`Links to ${ORIGINAL_WORDS.named}'s cards start with Minter-board-card, QM-AR-card or card-MAC.`}
      />
    );
  } else if (board === 'admin' && !known) {
    content = <CardSkeleton lines={4} />;
  } else if (board === 'admin' && !(isAdmin && viewer)) {
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
  } else if (board === 'admin' && viewer) {
    content = <AdminCardView key={row.identifier} row={row} viewer={viewer} section={section} />;
  } else {
    content = <CardView key={row.identifier} row={row} section={section} />;
  }

  return (
    <>
      <PageHeader
        title={
          board === 'ar'
            ? 'Admin proposal'
            : board === 'admin'
              ? 'Admin Board card'
              : ORIGINAL_WORDS.card
        }
        subtitle={
          board === 'admin'
            ? `Proposed ${ORIGINAL_WORDS.era}. Encrypted to the Minter Admins, read-only.`
            : `From ${ORIGINAL_WORDS.named}, read-only.`
        }
        back={PATHS.history}
        actions={
          board ? <CopyLinkButton path={legacyCardPath(identifier)} what="this card" /> : null
        }
      />
      <PageBody>{content}</PageBody>
    </>
  );
}

function EncryptedCard({
  row,
  loading,
  locked = false,
}: {
  row: LegacyCardRow | null;
  loading: boolean;
  /** A Minter Admin the card wasn't encrypted to (else: not a Minter Admin). */
  locked?: boolean;
}) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockOutlinedIcon aria-hidden sx={{ color: 'text.secondary' }} />
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
          {locked ? NOT_ENCRYPTED_TO_YOU : 'Encrypted to Minter Admins'}
        </Typography>
      </Box>
      <Typography>
        {locked
          ? `This card is from ${ORIGINAL_WORDS.adminBoard}. It was encrypted to the Minter Admins when it was posted, and not to your account, so it can't be read here.`
          : `This card is from ${ORIGINAL_WORDS.adminBoard}, which only Minter Admins can read.`}
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
    </Card>
  );
}

/** An Admin Board card, decrypted for the viewer (a Minter Admin). */
function AdminCardView({
  row,
  viewer,
  section,
}: {
  row: LegacyCardRow;
  viewer: string;
  section: string;
}) {
  const query = useQuery(adminCardKey(viewer, row), () => loadAdminCard(viewer, row));
  const read = query.data;
  if (read?.status === 'locked') return <EncryptedCard row={row} loading={false} locked />;
  if (!read) {
    if (query.isError) return <CardProblem row={row} error={query.error} onRetry={query.refetch} />;
    return <CardSkeleton lines={4} />;
  }
  return <CardParts card={read.value} section={section} viewer={viewer} />;
}

function CardProblem({
  row,
  error,
  onRetry,
}: {
  row: LegacyCardRow;
  error: unknown;
  onRetry: () => unknown;
}) {
  return error instanceof QdnDeletedError ? (
    <EmptyState
      title="This card was deleted by its publisher."
      description={`${row.publisher} removed it from QDN.`}
    />
  ) : (
    <EmptyState
      title={`${legacyProblem(error)}.`}
      description="Your node may still be fetching it from peers. Try again in a moment."
      actionLabel="Try again"
      onAction={() => void onRetry()}
    />
  );
}

function CardView({ row, section }: { row: LegacyCardRow; section: string }) {
  const query = useQuery(legacyCardKey(row), () => loadLegacyCard(row));
  const card = query.data;
  if (!card) {
    if (query.isError) return <CardProblem row={row} error={query.error} onRetry={query.refetch} />;
    return <CardSkeleton lines={4} />;
  }
  return <CardParts card={card} section={section} />;
}

/** A card's body, poll and comments; `viewer` decrypts an Admin Board card's comments. */
function CardParts({
  card,
  section,
  viewer = null,
}: {
  card: LegacyCard;
  section: string;
  viewer?: string | null;
}) {
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
              to={decisionsViewPath('nominations')}
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
          ? `This board is read-only now, and ${APP_NAME} has no votes. New nominations happen in Nominations, and Minter Admins decide by approving or rejecting.`
          : card.board === 'admin'
            ? 'This board is read-only now. Minter Admins decide in Decisions, and write for each other there: polls, notes and comments for the Minter Admins only.'
            : 'This board is read-only now. Admin changes are proposed and approved by Minter Admins in Decisions.'}
      </Alert>
      <Comments card={card} scrollTo={section === 'comments'} viewer={viewer} />
    </>
  );
}

function subjectLabel(card: LegacyCard): string {
  if (card.board === 'minter') return 'Nominee';
  if (card.board === 'admin') return 'About';
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
        {card.topic ? null : (
          <Fact label={subjectLabel(card)}>
            {card.subject.address ? (
              <PersonChip address={card.subject.address} name={card.subject.name} size={32} />
            ) : card.subject.name ? (
              <PersonByName name={card.subject.name} />
            ) : (
              <Typography color="text.secondary">Not named on the card</Typography>
            )}
          </Fact>
        )}
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
            {sentenceStart(ORIGINAL_WORDS.app)} didn&apos;t list this card: its poll belongs to a
            different account than the card&apos;s publisher.
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

function Comments({
  card,
  scrollTo,
  viewer,
}: {
  card: LegacyCard;
  scrollTo: boolean;
  /** Decrypts an Admin Board card's comments. */
  viewer: string | null;
}) {
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
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              '& > li + li': { borderTop: 1, borderColor: 'divider' },
            }}
          >
            {rows.slice(0, shown).map((row) => (
              <li key={`${row.author}:${row.identifier}`}>
                {card.board === 'admin' && viewer ? (
                  <AdminCommentItem row={row} viewer={viewer} />
                ) : (
                  <CommentItem row={row} />
                )}
              </li>
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
  if (!query.data && query.error instanceof QdnDeletedError) return null;
  return (
    <CommentView
      row={row}
      comment={query.data}
      problem={!query.data && query.isError ? `${legacyProblem(query.error, 'comment')}.` : null}
    />
  );
}

function AdminCommentItem({ row, viewer }: { row: LegacyCommentRow; viewer: string }) {
  const query = useQuery(adminCommentKey(viewer, row), () => loadAdminComment(viewer, row));
  const read = query.data;
  if (!read && query.error instanceof QdnDeletedError) return null;
  return (
    <CommentView
      row={row}
      comment={read?.status === 'ok' ? read.value : undefined}
      problem={
        read?.status === 'locked'
          ? `${NOT_ENCRYPTED_TO_YOU}.`
          : !read && query.isError
            ? `${legacyProblem(query.error, 'comment')}.`
            : null
      }
    />
  );
}

function CommentView({
  row,
  comment,
  problem,
}: {
  row: LegacyCommentRow;
  comment: LegacyComment | undefined;
  problem: string | null;
}) {
  const edited = row.editedAt && row.editedAt > row.postedAt + 60_000;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
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
            Replying to{' '}
            {comment.replyTo.author ? <MarkedName name={comment.replyTo.author} /> : 'a comment'}
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
      ) : problem ? (
        <Typography variant="body2" color="text.secondary">
          {problem}
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
