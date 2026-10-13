/**
 * An open comments section (loaded on demand by CommentsSection): who may
 * write (anyone signed in with a registered name; otherwise how to sign in or
 * register one), the newest 20 comments with their replies and "Show more",
 * and replying, editing, deleting, hiding (Minter Admins) and muting (this
 * device). Every write is explained in its Hub step first, and shows at once
 * once Hub sends it. Refreshes every minute while open and visible.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { COMMENT_MAX, commentTextProblems, type CommentRecord } from '../../data/commentRecords';
import {
  COMMENTS_PAGE,
  commentThreadKey,
  loadCommentThread,
  type CommentThreadData,
} from '../../data/comments';
import { buildThreads, type CommentTarget, type CommentView } from '../../data/commentThread';
import { invalidate } from '../../data/query';
import { useAdmins } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { settleOptimistic, useMutedNames, useOptimisticComments } from '../../state/comments';
import { signIn, signerOf, useSession } from '../../state/session';
import { formatCount } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { deleteComment, editComment, postComment, setCommentHidden } from '../../writes/comments';
import type { WriteStage } from '../../writes/runner';
import { ErrorState, ListSkeleton, TruncatedNote } from '../common/states';
import { NAMES_APP_LINK } from '../ready/readyChecks';
import {
  DeleteCommentDialog,
  HideCommentDialog,
  PublishCommentDialog,
  type PublishMode,
} from './CommentDialogs';
import { CommentItem, type CommentViewer } from './CommentItem';

const REFRESH_MS = 60_000;

type Dialog =
  | { kind: 'publish'; mode: PublishMode; text: string; about: CommentView | null }
  | { kind: 'delete'; comment: CommentView }
  | { kind: 'hide'; comment: CommentView; hide: boolean };

interface Inline {
  mode: 'reply' | 'edit';
  comment: CommentView;
  /** The thread (its first comment's ref) the editor shows in. */
  thread: string;
  text: string;
  error: string | null;
}

export interface CommentsPanelProps {
  id: string;
  target: CommentTarget;
  label: string;
}

export default function CommentsPanel({ id, target, label }: CommentsPanelProps) {
  const session = useSession();
  const signer = signerOf(session);
  const author = signer && session.name ? { ...signer, name: session.name } : null;
  const admins = useAdmins();
  const isAdmin = Boolean(signer && admins.data?.signers.some((a) => a.member === signer.address));
  const viewer: CommentViewer = {
    signedIn: Boolean(signer),
    address: signer?.address ?? '',
    name: signer ? session.name : null,
    isAdmin,
  };

  const [limit, setLimit] = useState(COMMENTS_PAGE);
  const query = useQuery(
    commentThreadKey(target, limit),
    (force) => loadCommentThread(target, limit, { force }),
    { refreshMs: REFRESH_MS }
  );
  // "Show more" reads under a new key: keep the comments on screen meanwhile.
  const [kept, setKept] = useState<CommentThreadData | null>(null);
  if (query.data && query.data !== kept) setKept(query.data);
  const data = query.data ?? kept;

  const { muted, setMuted } = useMutedNames();
  const keys = useMemo(() => target.keys.map((k) => k.key), [target]);
  const optimistic = useOptimisticComments(keys);
  const threads = useMemo(
    () =>
      data
        ? buildThreads({
            rows: data.rows,
            bodies: data.bodies,
            hides: data.hides,
            muted,
            optimistic: optimistic.comments,
            optimisticHides: optimistic.hides,
          })
        : null,
    [data, muted, optimistic]
  );
  useEffect(() => {
    if (!data) return;
    const loaded = new Map<string, CommentRecord>();
    for (const [ref, body] of data.bodies) if (body.status === 'ok') loaded.set(ref, body.record);
    settleOptimistic(loaded, data.hides);
  }, [data]);

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
  const closeDialog = () => setDialogOpen(false);

  // False when the text can't go: the field then takes focus, and its description says why.
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
  // Cancel on a reply or an edit: back to the comment it was about (the editor goes away).
  const cancelInline = () => {
    if (inline)
      document.querySelector<HTMLElement>(`[data-comment="${inline.comment.identifier}"]`)?.focus();
    setInline(null);
  };

  const publish = (onStage: (stage: WriteStage) => void) => {
    if (!dialog || dialog.kind !== 'publish' || !signer)
      return Promise.resolve({
        outcome: { status: 'blocked' as const, reason: 'Sign in to Hub first.' },
        identifier: '',
      });
    if (dialog.mode === 'edit' && dialog.about) {
      const c = dialog.about;
      return editComment(
        signer,
        { name: c.name, identifier: c.identifier, key: c.key, replyTo: c.replyTo },
        dialog.text,
        onStage
      );
    }
    if (!author)
      return Promise.resolve({
        outcome: {
          status: 'blocked' as const,
          reason: 'Commenting needs a registered name on your account.',
        },
        identifier: '',
      });
    return postComment(
      author,
      {
        key: target.postKey,
        text: dialog.text,
        replyTo: dialog.mode === 'reply' ? dialog.about?.identifier : null,
      },
      onStage
    );
  };

  // After a dialog, focus goes to the comment it was about (its menu item is gone).
  const about = dialog && dialog.kind !== 'publish' ? dialog.comment : dialog?.about;
  const returnFocus = () =>
    about ? document.querySelector<HTMLElement>(`[data-comment="${about.identifier}"]`) : null;

  const itemHandlers = {
    onEdit: (c: CommentView) =>
      setInline({ mode: 'edit', comment: c, thread: '', text: c.text, error: null }),
    onDelete: (c: CommentView) => openDialog({ kind: 'delete', comment: c }),
    onHide: (c: CommentView, hide: boolean) => openDialog({ kind: 'hide', comment: c, hide }),
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
  if (!data && query.isError) {
    list = (
      <ErrorState
        compact
        title="Couldn’t load the comments."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!data || !threads) {
    list = <ListSkeleton count={2} label="Loading comments" />;
  } else if (!threads.length) {
    list = (
      <Typography variant="body2" color="text.secondary">
        No comments yet.
      </Typography>
    );
  } else {
    const now = Date.now();
    const unread = data.rows.filter((r) => !data.bodies.has(r.ref)).length;
    list = (
      <>
        <Box
          component="ul"
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
                onReply={
                  author
                    ? (c) =>
                        setInline({
                          mode: 'reply',
                          comment: c,
                          thread: t.comment.ref,
                          text: '',
                          error: null,
                        })
                    : undefined
                }
                {...itemHandlers}
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
                        onReply={
                          author
                            ? (c) =>
                                setInline({
                                  mode: 'reply',
                                  comment: c,
                                  thread: t.comment.ref,
                                  text: '',
                                  error: null,
                                })
                            : undefined
                        }
                        {...itemHandlers}
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
        {data.truncated ? <TruncatedNote what="the comments" /> : null}
        {unread > 0 ? (
          <Box>
            <Button
              variant="outlined"
              onClick={() => setLimit((n) => n + COMMENTS_PAGE)}
              disabled={query.fetching && !query.data}
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
      <Gate
        status={session.status}
        hasName={Boolean(session.name)}
        address={session.address}
        composer={
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
            hint={`Public, under your name ${session.name ?? ''}.`}
          />
        }
      />
      {list}
      <Box role="status" aria-live="polite" className="qmp-visually-hidden">
        {said}
      </Box>

      {dialog?.kind === 'publish' && signer ? (
        <PublishCommentDialog
          open={dialogOpen}
          onClose={closeDialog}
          mode={dialog.mode}
          text={dialog.text}
          name={dialog.mode === 'edit' && dialog.about ? dialog.about.name : (author?.name ?? '')}
          replyingTo={dialog.mode === 'reply' ? dialog.about?.name : null}
          publish={publish}
          returnFocus={returnFocus}
          onSent={() => {
            if (dialog.mode === 'post') setDraft('');
            else setInline(null);
          }}
        />
      ) : null}
      {dialog?.kind === 'delete' && signer ? (
        <DeleteCommentDialog
          open={dialogOpen}
          onClose={closeDialog}
          name={dialog.comment.name}
          returnFocus={returnFocus}
          publish={(onStage) =>
            deleteComment(
              signer,
              {
                name: dialog.comment.name,
                identifier: dialog.comment.identifier,
                key: dialog.comment.key,
                replyTo: dialog.comment.replyTo,
              },
              onStage
            )
          }
        />
      ) : null}
      {dialog?.kind === 'hide' && author ? (
        <HideCommentDialog
          open={dialogOpen}
          onClose={closeDialog}
          hide={dialog.hide}
          author={dialog.comment.name}
          name={author.name}
          returnFocus={returnFocus}
          publish={(onStage) =>
            setCommentHidden(
              author,
              {
                name: dialog.comment.name,
                identifier: dialog.comment.identifier,
                key: dialog.comment.key,
              },
              dialog.hide,
              onStage
            )
          }
        />
      ) : null}
    </Box>
  );
}

function Gate({
  status,
  hasName,
  address,
  composer,
}: {
  status: ReturnType<typeof useSession>['status'];
  hasName: boolean;
  address: string;
  composer: ReactNode;
}) {
  if (status === 'ready' && hasName) return <>{composer}</>;
  if (status === 'ready') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        <Typography sx={{ fontWeight: 700 }}>Commenting needs a registered name</Typography>
        <Typography variant="body2" color="text.secondary">
          Comments are published on QDN under a name, so everyone can see who wrote them. A name is
          a short public name for your Qortal account; you register it once, in the Names app.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => void openQortalLink(NAMES_APP_LINK)}
            sx={{ minHeight: 44 }}
          >
            Register a name
          </Button>
          <Button
            onClick={() => {
              invalidate(`name:${address}`);
              void signIn();
            }}
            sx={{ minHeight: 44 }}
          >
            I’ve registered one
          </Button>
        </Box>
      </Box>
    );
  }
  if (status === 'signedOut' || status === 'error') {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Sign in to comment.
        </Typography>
        <Button variant="outlined" onClick={() => void signIn()} sx={{ minHeight: 44 }}>
          Sign in
        </Button>
      </Box>
    );
  }
  if (status === 'outside') {
    return (
      <Typography variant="body2" color="text.secondary">
        Open Q-Mintership+ in Qortal Hub to comment.
      </Typography>
    );
  }
  return null;
}

function Composer({
  label,
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  hint,
  autoFocus,
}: {
  label: string;
  value: string;
  error: string | null;
  onChange: (text: string) => void;
  /** False when the text can't go: focus then moves to the field. */
  onSubmit: (event: FormEvent) => boolean;
  onCancel?: () => void;
  submitLabel: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  // In an effect, not autoFocus: a menu that opened it (More → Edit) puts focus
  // back on its own button as it closes, after autoFocus has run.
  useEffect(() => {
    if (autoFocus) field.current?.focus();
  }, [autoFocus]);
  return (
    <Box
      component="form"
      noValidate
      onSubmit={(event: FormEvent) => {
        if (!onSubmit(event)) field.current?.focus();
      }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
    >
      <TextField
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        minRows={2}
        maxRows={8}
        fullWidth
        inputRef={field}
        error={Boolean(error)}
        helperText={
          error ??
          `${hint ? `${hint} ` : ''}${formatCount(value.trim().length)} / ${formatCount(COMMENT_MAX)}`
        }
        slotProps={{ htmlInput: { maxLength: COMMENT_MAX } }}
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 1 }}>
        {onCancel ? (
          <Button onClick={onCancel} sx={{ minHeight: 44 }}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="contained" sx={{ minHeight: 44 }}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}
