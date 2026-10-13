/**
 * A Minter Admin poll's comments, once opened (loaded on demand by the poll
 * card): the same thread as public comments (newest first, 20 at a time,
 * replies one level deep, edit, delete and mute on this device), but every
 * comment is encrypted to the Minter Admins and decrypted here with the
 * viewer's key. Comments the viewer can't read come from a share when one
 * carried them, and are left out otherwise (saying how many). No hiding:
 * only Minter Admins read these anyway. Refreshes every minute while open
 * and visible.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { CommentItem, type CommentViewer } from '../../components/comments/CommentItem';
import { Composer } from '../../components/comments/CommentsPanel';
import { ErrorState, ListSkeleton } from '../../components/common/states';
import { commentTextProblems } from '../../data/commentRecords';
import { buildThreads, type CommentView, type OptimisticComment } from '../../data/commentThread';
import {
  POLL_COMMENTS_PAGE,
  loadPollThread,
  pollThreadKey,
  type ThreadBody,
} from '../../data/adminPolls';
import { useQuery } from '../../hooks/useQuery';
import { pollThreadSources, toCommentRecord } from '../../rules/adminPolls';
import { setPendingPollComment, usePendingPollWrites } from '../../state/adminPolls';
import { useMutedNames } from '../../state/comments';
import { focusElement } from '../../utils/focus';
import { formatCount } from '../../utils/format';
import {
  commentAdminPoll,
  deleteAdminPollComment,
  editAdminPollComment,
  type PollAuthor,
} from '../../writes/adminPolls';
import type { WriteStage } from '../../writes/runner';
import {
  DeletePollCommentDialog,
  PollCommentDialog,
  type PollCommentMode,
} from './AdminPollDialogs';
import type { ShownPoll } from './adminPollUi';

const REFRESH_MS = 60_000;

/** Comments here the viewer can't read, which no share carries: why the count above is higher. */
function unreadableText(count: number, none: boolean): string {
  const which =
    count === 1
      ? '1 comment here wasn’t encrypted to you, and no share carries it.'
      : `${formatCount(count)} comments here weren’t encrypted to you, and no share carries them.`;
  return none ? `No comments you can read. ${which}` : which;
}
const PENDING_TEXT = 'Publishing… the Minter Admins see it once QDN has it.';

type Dialog =
  | { kind: 'publish'; mode: PollCommentMode; text: string; about: CommentView | null }
  | { kind: 'delete'; comment: CommentView };

interface Inline {
  mode: 'reply' | 'edit';
  comment: CommentView;
  thread: string;
  text: string;
  error: string | null;
}

export interface AdminPollCommentsProps {
  id: string;
  view: ShownPoll;
  author: PollAuthor;
  /** How many Minter Admins a comment is encrypted to. */
  admins: number;
  label: string;
}

export default function AdminPollComments({
  id,
  view,
  author,
  admins,
  label,
}: AdminPollCommentsProps) {
  const [limit, setLimit] = useState(POLL_COMMENTS_PAGE);
  const rows = view.commentRows;
  const query = useQuery(
    pollThreadKey(author.address, view.id, rows, limit),
    (force) => loadPollThread(author.address, view.id, rows, limit, { force }),
    { refreshMs: REFRESH_MS }
  );
  // A new key (Show more, a new comment listed): keep the thread on screen meanwhile.
  const [kept, setKept] = useState<Map<string, ThreadBody> | null>(null);
  if (query.data && query.data !== kept) setKept(query.data);
  const loaded = query.data ?? kept;

  const { muted, setMuted } = useMutedNames();
  const pending = usePendingPollWrites().comments;
  const optimistic = useMemo<OptimisticComment[]>(
    () =>
      Object.values(pending)
        .filter((p) => p.pollId === view.id)
        .map((p) => ({
          ref: p.ref,
          name: p.name,
          identifier: p.identifier,
          key: view.id,
          record: toCommentRecord(view.id, p.record),
          at: p.at,
        })),
    [pending, view.id]
  );
  const sources = useMemo(
    () =>
      loaded
        ? pollThreadSources({ pollId: view.id, rows, bodies: loaded, copies: view.shareComments })
        : null,
    [loaded, rows, view.id, view.shareComments]
  );
  const threads = useMemo(
    () =>
      sources
        ? buildThreads({
            rows: sources.rows,
            bodies: sources.bodies,
            hides: new Map(),
            muted,
            optimistic,
          })
        : null,
    [sources, muted, optimistic]
  );

  // What QDN shows now needs no "Publishing…" any more.
  useEffect(() => {
    if (!sources) return;
    for (const entry of optimistic) {
      const body = sources.bodies.get(entry.ref);
      if (
        body?.status === 'ok' &&
        body.record.text === entry.record.text &&
        Boolean(body.record.deleted) === Boolean(entry.record.deleted)
      )
        setPendingPollComment(entry.ref, null);
    }
  }, [sources, optimistic]);

  // Show more: focus goes to the first comment it brought.
  const shownBefore = useRef<Set<string> | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    const before = shownBefore.current;
    if (before && query.isError && !query.data) shownBefore.current = null;
    if (!before || !query.data || !threads) return;
    shownBefore.current = null;
    const fresh = threads.find((t) => !before.has(t.comment.ref));
    const target = fresh
      ? document.querySelector<HTMLElement>(`[data-comment="${fresh.comment.identifier}"]`)
      : listRef.current;
    if (target) focusElement(target);
  }, [threads, query.data, query.isError]);

  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [inline, setInline] = useState<Inline | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [said, setSaid] = useState('');
  const openDialog = (next: Dialog) => {
    setDialog(next);
    setDialogOpen(true);
  };

  const viewer: CommentViewer = {
    signedIn: true,
    address: author.address,
    name: author.name,
    // Hiding is for public comments: every reader here is a Minter Admin.
    isAdmin: false,
  };

  const submitDraft = (event: FormEvent) => {
    event.preventDefault();
    const problems = commentTextProblems(draft);
    setDraftError(problems[0] ?? null);
    if (problems.length) return false;
    openDialog({ kind: 'publish', mode: 'post', text: draft, about: null });
    return true;
  };
  const submitInline = (event: FormEvent) => {
    event.preventDefault();
    if (!inline) return true;
    const problems = commentTextProblems(inline.text);
    if (problems.length) {
      setInline({ ...inline, error: problems[0] });
      return false;
    }
    setInline({ ...inline, error: null });
    openDialog({ kind: 'publish', mode: inline.mode, text: inline.text, about: inline.comment });
    return true;
  };
  const cancelInline = () => {
    if (inline)
      document.querySelector<HTMLElement>(`[data-comment="${inline.comment.identifier}"]`)?.focus();
    setInline(null);
  };

  const publish = (onStage: (stage: WriteStage) => void) => {
    if (!dialog || dialog.kind !== 'publish')
      return Promise.resolve({
        outcome: { status: 'blocked' as const, reason: 'Nothing to publish.' },
        identifier: '',
      });
    if (dialog.mode === 'edit' && dialog.about) {
      const c = dialog.about;
      return editAdminPollComment(
        author,
        { name: c.name, identifier: c.identifier, replyTo: c.replyTo },
        dialog.text,
        onStage
      );
    }
    return commentAdminPoll(
      author,
      view.id,
      { text: dialog.text, replyTo: dialog.mode === 'reply' ? dialog.about?.identifier : null },
      onStage
    );
  };

  const about = dialog && dialog.kind === 'delete' ? dialog.comment : dialog?.about;
  const returnFocus = () =>
    about ? document.querySelector<HTMLElement>(`[data-comment="${about.identifier}"]`) : null;

  const reply = (thread: string) => (c: CommentView) =>
    setInline({ mode: 'reply', comment: c, thread, text: '', error: null });
  const handlers = {
    onEdit: (c: CommentView) =>
      setInline({ mode: 'edit', comment: c, thread: '', text: c.text, error: null }),
    onDelete: (c: CommentView) => openDialog({ kind: 'delete', comment: c }),
    onHide: () => undefined,
    onMute: (name: string, mute: boolean) => {
      setMuted(name, mute);
      setSaid(mute ? `Muted ${name} on this device.` : `Unmuted ${name}.`);
    },
  };
  const editorFor = (c: CommentView) =>
    inline && inline.mode === 'edit' && inline.comment.ref === c.ref ? (
      <Composer
        label="Edit your comment"
        value={inline.text}
        error={inline.error}
        onChange={(text) => setInline({ ...inline, text })}
        onSubmit={submitInline}
        onCancel={cancelInline}
        submitLabel="Save"
        autoFocus
      />
    ) : undefined;

  let list;
  if (!loaded && query.isError) {
    list = (
      <ErrorState
        compact
        title="Couldn’t load the comments."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!threads || !sources) {
    list = <ListSkeleton count={2} label="Loading comments" />;
  } else if (!threads.length) {
    list = (
      <Typography variant="body2" color="text.secondary">
        {sources.unreadable ? unreadableText(sources.unreadable, true) : 'No comments yet.'}
      </Typography>
    );
  } else {
    const now = Date.now();
    const unread = rows.filter((r) => !loaded?.has(r.ref)).length;
    list = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label={`Comments on ${label}, newest first`}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {threads.map((t) => {
            const replying =
              inline?.mode === 'reply' && inline.thread === t.comment.ref ? inline : null;
            return (
              <CommentItem
                key={t.comment.ref}
                comment={t.comment}
                viewer={viewer}
                now={now}
                editor={editorFor(t.comment)}
                onReply={author.name ? reply(t.comment.ref) : undefined}
                pendingText={PENDING_TEXT}
                {...handlers}
              >
                {t.replies.length ? (
                  <Box
                    component="ul"
                    aria-label={`Replies to ${t.comment.name}`}
                    sx={{
                      listStyle: 'none',
                      m: 0,
                      mt: 0.5,
                      p: 0,
                      pl: 1.5,
                      borderLeft: 2,
                      borderColor: 'divider',
                    }}
                  >
                    {t.replies.map((r) => (
                      <CommentItem
                        key={r.ref}
                        comment={r}
                        viewer={viewer}
                        now={now}
                        isReply
                        editor={editorFor(r)}
                        onReply={author.name ? reply(t.comment.ref) : undefined}
                        pendingText={PENDING_TEXT}
                        {...handlers}
                      />
                    ))}
                  </Box>
                ) : null}
                {replying ? (
                  <Box sx={{ pl: 1.5, pt: 1 }}>
                    <Composer
                      label={`Reply to ${replying.comment.name}`}
                      value={replying.text}
                      error={replying.error}
                      onChange={(text) => setInline({ ...replying, text })}
                      onSubmit={submitInline}
                      onCancel={cancelInline}
                      submitLabel="Post reply"
                      autoFocus
                    />
                  </Box>
                ) : null}
              </CommentItem>
            );
          })}
        </Box>
        {sources.unreadable ? (
          <Typography variant="body2" color="text.secondary">
            {unreadableText(sources.unreadable, false)}
          </Typography>
        ) : null}
        {unread > 0 ? (
          <Box>
            <Button
              variant="outlined"
              onClick={() => {
                if (shownBefore.current) return;
                shownBefore.current = new Set(threads.map((t) => t.comment.ref));
                setLimit((n) => n + POLL_COMMENTS_PAGE);
              }}
              sx={{ minHeight: 44 }}
            >
              Show more comments ({formatCount(unread)})
            </Button>
          </Box>
        ) : null}
      </>
    );
  }

  return (
    <Box
      id={id}
      role="region"
      aria-label={`Comments on ${label}`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5, minWidth: 0 }}
    >
      {author.name ? (
        <Composer
          label="Write a comment"
          value={draft}
          error={draftError}
          onChange={(text) => {
            setDraft(text);
            if (draftError) setDraftError(null);
          }}
          onSubmit={submitDraft}
          submitLabel="Post"
          hint={`Encrypted to the Minter Admins, under your name ${author.name}.`}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Commenting needs a registered name: comments are published under it.
        </Typography>
      )}
      {list}
      <Box role="status" aria-live="polite" className="qmp-visually-hidden">
        {said}
      </Box>

      {dialog?.kind === 'publish' ? (
        <PollCommentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          mode={dialog.mode}
          text={dialog.text}
          name={dialog.mode === 'edit' && dialog.about ? dialog.about.name : (author.name ?? '')}
          replyingTo={dialog.mode === 'reply' ? dialog.about?.name : null}
          admins={admins}
          publish={publish}
          returnFocus={returnFocus}
          onSent={() => {
            if (dialog.mode === 'post') setDraft('');
            else setInline(null);
          }}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <DeletePollCommentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          name={dialog.comment.name}
          returnFocus={returnFocus}
          publish={(onStage) =>
            deleteAdminPollComment(
              author,
              {
                name: dialog.comment.name,
                identifier: dialog.comment.identifier,
                replyTo: dialog.comment.replyTo,
              },
              onStage
            )
          }
        />
      ) : null}
    </Box>
  );
}
