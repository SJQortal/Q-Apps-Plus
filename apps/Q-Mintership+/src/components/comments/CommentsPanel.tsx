/**
 * An open comments section (loaded on demand by CommentsSection): who may
 * write (anyone signed in with a registered name; otherwise how to sign in or
 * register one), the newest 20 comments with their replies and "Show more",
 * and replying, editing, deleting, hiding (Minter Admins) and muting (this
 * device). Every write is explained in its Hub step first, and shows at once
 * once Hub sends it. Refreshes every minute while open and visible.
 *
 * A Minter Admin also reads the comments for the Minter Admins only, in the
 * same thread (data/adminNotes.ts, decrypted with their key), and picks for
 * each new comment who can read it: everyone, or the Minter Admins only
 * (encrypted to them). A reply to one for the Minter Admins is one too; an
 * edit keeps its comment's kind. Nobody else reads or sees them.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { COMMENT_MAX, commentTextProblems, type CommentRecord } from '../../data/commentRecords';
import { adminThreadKey, loadAdminThread, type AdminThreadData } from '../../data/adminNotes';
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
import { formatCount, plural } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { deleteComment, editComment, postComment, setCommentHidden } from '../../writes/comments';
import { deleteAdminComment, editAdminComment, postAdminComment } from '../../writes/adminNotes';
import type { WriteStage } from '../../writes/runner';
import { focusElement } from '../../utils/focus';
import { ErrorState, ListSkeleton, TruncatedNote } from '../common/states';
import { NAMES_APP_LINK } from '../../constants/links';
import {
  DeleteCommentDialog,
  HideCommentDialog,
  PublishCommentDialog,
  type PublishMode,
} from './CommentDialogs';
import { CommentReplies, ReplyComposerBox } from './CommentReplies';
import { CommentItem, type CommentViewer } from './CommentItem';
import type { AnswerBadges } from './answerBadges';

const REFRESH_MS = 60_000;

/** Who a new comment is for: everyone, or the Minter Admins only (encrypted to them). */
export type CommentAudience = 'public' | 'admins';

type Dialog =
  | {
      kind: 'publish';
      mode: PublishMode;
      text: string;
      about: CommentView | null;
      audience: CommentAudience;
    }
  | { kind: 'delete'; comment: CommentView }
  | { kind: 'hide'; comment: CommentView; hide: boolean };

interface Inline {
  mode: 'reply' | 'edit';
  comment: CommentView;
  /** The thread (its first comment's ref) the editor shows in. */
  thread: string;
  text: string;
  error: string | null;
  /** A reply's: picked by a Minter Admin, or the Minter Admins only under one of theirs. */
  audience: CommentAudience;
}

/** Comments for the Minter Admins here that weren't encrypted to the viewer: why the count is higher. */
function lockedText(count: number): string {
  return count === 1
    ? '1 comment for the Minter Admins here wasn’t encrypted to you, so it isn’t shown.'
    : `${formatCount(count)} comments for the Minter Admins here weren’t encrypted to you, so they aren’t shown.`;
}

export interface CommentsPanelProps {
  id: string;
  target: CommentTarget;
  label: string;
  /** What each Minter Admin chose, for the badge next to their comments. */
  answers?: AnswerBadges;
}

export default function CommentsPanel({ id, target, label, answers }: CommentsPanelProps) {
  const session = useSession();
  const signer = signerOf(session);
  const author = signer && session.name ? { ...signer, name: session.name } : null;
  const admins = useAdmins();
  const isAdmin = Boolean(signer && admins.data?.signers.some((a) => a.member === signer.address));
  const adminCount = admins.data?.signers.length ?? 0;
  const viewer: CommentViewer = {
    signedIn: Boolean(signer),
    address: signer?.address ?? '',
    name: signer ? session.name : null,
    isAdmin,
  };
  // What a Minter Admin writes for the Minter Admins only goes under their name, encrypted.
  const adminWriter = isAdmin && signer ? { ...signer, name: session.name } : null;

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

  // A Minter Admin's: the comments for the Minter Admins, once the public ones are in
  // (a reply among them may answer one of those).
  const viewerAddress = signer?.address ?? '';
  const adminQuery = useQuery(
    isAdmin && data ? adminThreadKey(viewerAddress, target, limit) : null,
    (force) => loadAdminThread(viewerAddress, target, data?.rows ?? [], limit, { force }),
    { refreshMs: REFRESH_MS }
  );
  const [keptAdmin, setKeptAdmin] = useState<AdminThreadData | null>(null);
  if (adminQuery.data && adminQuery.data !== keptAdmin) setKeptAdmin(adminQuery.data);
  const adminData = isAdmin ? (adminQuery.data ?? keptAdmin) : null;

  const { muted, setMuted } = useMutedNames();
  const keys = useMemo(() => target.keys.map((k) => k.key), [target]);
  const optimistic = useOptimisticComments(keys);
  // Both kinds in one thread: the public bodies win for public comments.
  const merged = useMemo(() => {
    if (!data) return null;
    if (!adminData) return { rows: data.rows, bodies: data.bodies };
    return {
      rows: [...data.rows, ...adminData.rows],
      bodies: new Map([...adminData.bodies, ...data.bodies]),
    };
  }, [data, adminData]);
  const threads = useMemo(
    () =>
      merged && data
        ? buildThreads({
            rows: merged.rows,
            bodies: merged.bodies,
            hides: data.hides,
            muted,
            optimistic: isAdmin
              ? optimistic.comments
              : optimistic.comments.filter((o) => !o.adminOnly),
            optimisticHides: optimistic.hides,
          })
        : null,
    [merged, data, muted, optimistic, isAdmin]
  );
  // Show more: once the next comments are in, focus goes to the first of them
  // (the button may have gone with the last page).
  const shownBefore = useRef<Set<string> | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  useEffect(() => {
    const before = shownBefore.current;
    // A failed read lets Show more be pressed again.
    if (before && query.isError && !query.data) shownBefore.current = null;
    if (!before || !query.data || !threads) return;
    shownBefore.current = null;
    const fresh = threads.find((t) => !before.has(t.comment.ref));
    const target = fresh
      ? document.querySelector<HTMLElement>(`[data-comment="${fresh.comment.identifier}"]`)
      : listRef.current;
    if (target) focusElement(target);
  }, [threads, query.data, query.isError]);
  const showMore = () => {
    // Stays enabled while it reads (a disabled button would drop focus); a second press waits.
    if (shownBefore.current) return;
    shownBefore.current = new Set(threads?.map((t) => t.comment.ref) ?? []);
    setLimit((n) => n + COMMENTS_PAGE);
  };

  useEffect(() => {
    if (!merged || !data) return;
    const loaded = new Map<string, CommentRecord>();
    for (const [ref, body] of merged.bodies) if (body.status === 'ok') loaded.set(ref, body.record);
    settleOptimistic(loaded, data.hides);
  }, [merged, data]);

  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftAudience, setDraftAudience] = useState<CommentAudience>('public');
  // Only a Minter Admin picks; everyone else writes in public.
  const audienceOf = (picked: CommentAudience): CommentAudience =>
    adminWriter ? picked : 'public';
  const audienceHint = (audience: CommentAudience) =>
    audience === 'admins'
      ? `Encrypted to the ${plural(adminCount, 'Minter Admin')}, under your name ${session.name ?? ''}.`
      : `Public, under your name ${session.name ?? ''}.`;
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
    openDialog({
      kind: 'publish',
      mode: 'post',
      text: draft,
      about: null,
      audience: audienceOf(draftAudience),
    });
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
    openDialog({
      kind: 'publish',
      mode: inline.mode,
      text: inline.text,
      about: inline.comment,
      // An edit keeps its comment's kind.
      audience:
        inline.mode === 'edit'
          ? inline.comment.adminOnly
            ? 'admins'
            : 'public'
          : audienceOf(inline.audience),
    });
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
      const ref = { name: c.name, identifier: c.identifier, key: c.key, replyTo: c.replyTo };
      if (c.adminOnly) {
        if (!adminWriter)
          return Promise.resolve({
            outcome: {
              status: 'blocked' as const,
              reason: 'Only Minter Admins can edit a comment for the Minter Admins.',
            },
            identifier: '',
          });
        return editAdminComment(adminWriter, ref, dialog.text, onStage);
      }
      return editComment(signer, ref, dialog.text, onStage);
    }
    if (dialog.audience === 'admins' && adminWriter)
      return postAdminComment(
        adminWriter,
        {
          key: target.postKey,
          text: dialog.text,
          replyTo: dialog.mode === 'reply' ? dialog.about?.identifier : null,
        },
        onStage
      );
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

  // A reply to one for the Minter Admins is one too; otherwise a Minter Admin picks.
  const startReply = (c: CommentView, thread: string) =>
    setInline({
      mode: 'reply',
      comment: c,
      thread,
      text: '',
      error: null,
      audience: c.adminOnly ? 'admins' : 'public',
    });
  const itemHandlers = {
    answers,
    onEdit: (c: CommentView) =>
      setInline({
        mode: 'edit',
        comment: c,
        thread: '',
        text: c.text,
        error: null,
        audience: c.adminOnly ? 'admins' : 'public',
      }),
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
    const lockedCount = adminData?.locked ?? 0;
    const unread =
      data.rows.filter((r) => !data.bodies.has(r.ref)).length +
      (adminData
        ? Math.max(
            0,
            adminData.rows.filter((r) => !adminData.bodies.has(r.ref)).length - lockedCount
          )
        : 0);
    list = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label={`Comments on ${label}, newest first`}
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
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
                onReply={author ? (c) => startReply(c, t.comment.ref) : undefined}
                {...itemHandlers}
              >
                {t.replies.length ? (
                  <CommentReplies name={t.comment.name}>
                    {t.replies.map((r) => (
                      <CommentItem
                        key={r.ref}
                        comment={r}
                        viewer={viewer}
                        now={now}
                        isReply
                        editor={editorFor(r)}
                        onReply={author ? (c) => startReply(c, t.comment.ref) : undefined}
                        {...itemHandlers}
                      />
                    ))}
                  </CommentReplies>
                ) : null}
                {replying ? (
                  <ReplyComposerBox>
                    <Composer
                      label={`Reply to ${replying.comment.name}`}
                      value={replying.text}
                      error={replying.error}
                      onChange={(text) => setInline({ ...replying, text })}
                      onSubmit={submitInline}
                      onCancel={cancelInline}
                      submitLabel="Post reply"
                      autoFocus
                      hint={audienceHint(audienceOf(replying.audience))}
                      audience={
                        adminWriter
                          ? {
                              value: replying.audience,
                              onChange: (audience) => setInline({ ...replying, audience }),
                              fixed: Boolean(replying.comment.adminOnly),
                            }
                          : undefined
                      }
                    />
                  </ReplyComposerBox>
                ) : null}
              </CommentItem>
            );
          })}
        </Box>
        {data.truncated || adminData?.truncated ? <TruncatedNote what="the comments" /> : null}
        {lockedCount ? (
          <Typography variant="body2" color="text.secondary">
            {lockedText(lockedCount)}
          </Typography>
        ) : null}
        {unread > 0 ? (
          <Box>
            <Button variant="outlined" onClick={showMore} sx={{ minHeight: 44 }}>
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
            hint={audienceHint(audienceOf(draftAudience))}
            audience={
              adminWriter ? { value: draftAudience, onChange: setDraftAudience } : undefined
            }
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
          adminsOnly={dialog.audience === 'admins' ? adminCount : null}
          publish={publish}
          returnFocus={returnFocus}
          onSent={() => {
            // The choice of who reads it stays: a follow-up never goes public by surprise.
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
          adminsOnly={dialog.comment.adminOnly ? adminCount : null}
          returnFocus={returnFocus}
          publish={(onStage) => {
            const ref = {
              name: dialog.comment.name,
              identifier: dialog.comment.identifier,
              key: dialog.comment.key,
              replyTo: dialog.comment.replyTo,
            };
            if (!dialog.comment.adminOnly) return deleteComment(signer, ref, onStage);
            if (!adminWriter)
              return Promise.resolve({
                outcome: {
                  status: 'blocked' as const,
                  reason: 'Only Minter Admins can delete a comment for the Minter Admins.',
                },
                identifier: '',
              });
            return deleteAdminComment(adminWriter, ref, onStage);
          }}
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

export function Composer({
  label,
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  hint,
  autoFocus,
  audience,
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
  /**
   * A Minter Admin's choice of who can read it (none for anyone else); `fixed`
   * for a reply under a comment for the Minter Admins, which is one too.
   */
  audience?: {
    value: CommentAudience;
    onChange?: (audience: CommentAudience) => void;
    fixed?: boolean;
  };
}) {
  const field = useRef<HTMLTextAreaElement | null>(null);
  const audienceLabel = useId();
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
      {audience?.fixed ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <LockOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
          For the Minter Admins only, like the comment it answers.
        </Typography>
      ) : audience ? (
        <Box>
          <Typography id={audienceLabel} variant="body2" sx={{ fontWeight: 600 }}>
            Who can read it
          </Typography>
          <RadioGroup
            row
            aria-labelledby={audienceLabel}
            value={audience.value}
            onChange={(e) => audience.onChange?.(e.target.value as CommentAudience)}
          >
            <FormControlLabel
              value="public"
              control={<Radio />}
              label="Everyone (public)"
              sx={{ minHeight: 44, mr: 3 }}
            />
            <FormControlLabel
              value="admins"
              control={<Radio />}
              label={
                <Box
                  component="span"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <LockOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
                  Minter Admins only
                </Box>
              }
              sx={{ minHeight: 44 }}
            />
          </RadioGroup>
        </Box>
      ) : null}
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
