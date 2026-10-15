/**
 * One comment: who wrote it and when (edited), its text, Reply, and a
 * "More" menu (Edit and Delete for your own; Mute on this device for
 * others'; Hide for everyone or Show again for Minter Admins). A deleted
 * comment reads "Deleted" in its place; one a Minter Admin hid, or from a
 * name you muted, is folded away with "Show anyway".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { alpha, Box, Button, ButtonBase, Typography, type ChipProps } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VolumeOffOutlinedIcon from '@mui/icons-material/VolumeOffOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import { getNameOwner } from '../../data/accounts';
import type { CommentView } from '../../data/commentThread';
import { useQuery } from '../../hooks/useQuery';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { accentWash } from '../../hub-theme';
import { PersonByName } from '../../pages/history/parts/PersonByName';
import { formatDateTime, formatRelative } from '../../utils/format';
import { CommentMenu, type CommentAction } from './CommentMenu';
import { CommentText } from './CommentText';
import { ToneChip } from '../common/Section';
import {
  ANSWER_BADGE_LABEL,
  type AnswerBadge,
  type AnswerBadgeKind,
  type AnswerBadges,
} from './answerBadges';

export interface CommentViewer {
  signedIn: boolean;
  address: string;
  /** The name new comments go under, or null. */
  name: string | null;
  /** A Minter Admin with a name can hide comments for everyone. */
  isAdmin: boolean;
}

export interface CommentItemProps {
  comment: CommentView;
  viewer: CommentViewer;
  now: number;
  isReply?: boolean;
  /** Shown in place of the text while you edit it. */
  editor?: ReactNode;
  onReply?: (comment: CommentView) => void;
  onEdit: (comment: CommentView) => void;
  onDelete: (comment: CommentView) => void;
  onHide: (comment: CommentView, hide: boolean) => void;
  onMute: (name: string, mute: boolean) => void;
  /** The replies (and a reply being written), under a top-level comment. */
  children?: ReactNode;
  /** Under a comment that isn't on QDN yet (who sees it once it is). */
  pendingText?: string;
  /** What each Minter Admin chose: a badge next to the name of one who did. */
  answers?: AnswerBadges;
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  );
}

const BADGE_TONE: Record<AnswerBadgeKind, ChipProps['color']> = {
  approved: 'success',
  rejected: 'error',
  considering: 'default',
  yes: 'success',
  no: 'error',
  neutral: 'default',
};

/** Next to a Minter Admin's name: what they chose on what the thread is about. */
function AnswerBadgeChip({ badge }: { badge: AnswerBadge }) {
  const label = `${ANSWER_BADGE_LABEL[badge.kind]}${badge.confirming ? ' (confirming…)' : ''}`;
  return (
    <ToneChip
      size="small"
      variant="outlined"
      color={BADGE_TONE[badge.kind]}
      icon={badge.kind === 'considering' ? <VisibilityOutlinedIcon aria-hidden /> : undefined}
      label={label}
      sx={{ fontWeight: 600 }}
    />
  );
}

/** How long the comment a reply answers stays highlighted after going to it. */
const FLASH_MS = 1600;

/**
 * Above a reply's text: whose comment it answers and how that began. Pressing
 * it goes to that comment (scrolled to the middle, focused and briefly
 * highlighted), which may be another reply in the same thread.
 */
function ReplyQuote({ comment: c }: { comment: CommentView }) {
  const reduced = useReducedMotion();
  const goToParent = (from: HTMLElement) => {
    const thread = from.closest<HTMLElement>('[data-thread-root]');
    const target = [
      ...(thread ? [thread] : []),
      ...(thread?.querySelectorAll<HTMLElement>('[data-comment-ref]') ?? []),
    ].find((el) => el.dataset.commentRef === c.replyToRef);
    if (!target) return;
    target.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
    target.dataset.flash = 'true';
    window.setTimeout(() => delete target.dataset.flash, FLASH_MS);
  };
  return (
    <ButtonBase
      onClick={(e) => goToParent(e.currentTarget)}
      sx={(theme) => ({
        alignSelf: 'flex-start',
        maxWidth: '100%',
        minHeight: 44,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        textAlign: 'left',
        px: 1.25,
        py: 0.5,
        borderLeft: 3,
        borderColor: 'primary.main',
        borderRadius: `0 ${theme.shape.borderRadius}px ${theme.shape.borderRadius}px 0`,
        color: 'text.secondary',
        '&:hover': { bgcolor: accentWash(theme, 0.08) },
        '&.Mui-focusVisible': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      })}
    >
      <Typography
        variant="body2"
        component="span"
        sx={{ fontWeight: 600, color: 'text.primary', overflowWrap: 'anywhere' }}
      >
        Replying to {c.replyToName}
      </Typography>
      {c.replyToExcerpt ? (
        <Typography
          variant="body2"
          component="span"
          sx={{
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {c.replyToExcerpt}
        </Typography>
      ) : null}
      <Box component="span" sx={visuallyHidden}>
        (go to that comment)
      </Box>
    </ButtonBase>
  );
}

export function CommentItem(props: CommentItemProps) {
  const { comment: c, viewer, now, isReply, editor, children } = props;
  const [revealed, setRevealed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const revealedNow = useRef(false);
  const ownName = viewer.signedIn && c.name === viewer.name;
  const answers = props.answers;
  const owner = useQuery(
    !ownName && (viewer.signedIn || (answers && answers.size > 0)) ? `nameowner:${c.name}` : null,
    () => getNameOwner(c.name)
  );
  const mine = viewer.signedIn && (ownName || owner.data === viewer.address);
  const ownerAddress = ownName ? viewer.address : (owner.data ?? null);
  const badge = ownerAddress ? (answers?.get(ownerAddress) ?? null) : null;

  // "Show anyway" leaves; focus goes to what it showed.
  useEffect(() => {
    if (revealed && revealedNow.current) {
      revealedNow.current = false;
      bodyRef.current?.focus();
    }
  }, [revealed]);
  const reveal = () => {
    revealedNow.current = true;
    setRevealed(true);
  };

  const folded = !c.pending && !c.deleted && !revealed && (c.hidden || (c.muted && !mine));
  const readable = c.status === 'shown' && !c.deleted && !folded;

  const actions: CommentAction[] = [];
  if (!c.pending && viewer.signedIn) {
    if (mine) {
      if (readable)
        actions.push({
          key: 'edit',
          label: 'Edit',
          icon: <EditOutlinedIcon />,
          onSelect: () => props.onEdit(c),
        });
      if (!c.deleted && c.status === 'shown')
        actions.push({
          key: 'delete',
          label: 'Delete',
          icon: <DeleteOutlineOutlinedIcon />,
          onSelect: () => props.onDelete(c),
        });
    } else {
      actions.push(
        c.muted
          ? {
              key: 'unmute',
              label: `Unmute ${c.name}`,
              icon: <VolumeUpOutlinedIcon />,
              onSelect: () => props.onMute(c.name, false),
            }
          : {
              key: 'mute',
              label: `Mute ${c.name} on this device`,
              icon: <VolumeOffOutlinedIcon />,
              onSelect: () => props.onMute(c.name, true),
            }
      );
      if (viewer.isAdmin && viewer.name && !c.deleted)
        actions.push(
          c.hidden
            ? {
                key: 'show',
                label: 'Show for everyone again',
                icon: <VisibilityOutlinedIcon />,
                onSelect: () => props.onHide(c, false),
              }
            : {
                key: 'hide',
                label: 'Hide for everyone',
                icon: <VisibilityOffOutlinedIcon />,
                onSelect: () => props.onHide(c, true),
              }
        );
    }
  }

  const when = (
    <>
      <time dateTime={new Date(c.postedAt).toISOString()} title={formatDateTime(c.postedAt)}>
        {formatRelative(c.postedAt, now)}
      </time>
      {!c.deleted && (c.edited || c.editedAt !== null) ? ' · edited' : ''}
      {/* A poll comment the viewer can't read directly, shown from a share. */}
      {c.from ? ` · from ${c.from}’s copy` : ''}
    </>
  );

  let body: ReactNode;
  if (folded) {
    body = (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
        <Muted>
          {c.hidden ? 'Hidden by a Minter Admin.' : `You muted ${c.name} on this device.`}
        </Muted>
        <Button
          size="small"
          onClick={reveal}
          aria-label={c.hidden ? 'Show anyway: hidden comment' : `Show anyway: ${c.name}`}
          sx={{ minHeight: 44 }}
        >
          Show anyway
        </Button>
      </Box>
    );
  } else {
    body = (
      <>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}>
          <PersonByName name={c.name} size={isReply ? 24 : 28} secondary={when} />
          {badge ? <AnswerBadgeChip badge={badge} /> : null}
        </Box>
        {isReply && c.replyToName ? <ReplyQuote comment={c} /> : null}
        <Box ref={bodyRef} tabIndex={-1} sx={{ outline: 'none', minWidth: 0 }}>
          {editor ? (
            editor
          ) : c.deleted ? (
            <Muted>
              <Box component="span" sx={{ fontStyle: 'italic' }}>
                Deleted
              </Box>
            </Muted>
          ) : c.status === 'unavailable' ? (
            <Muted>
              {c.fetching
                ? 'Fetching this comment from peers…'
                : 'This comment isn’t available on your node right now.'}
            </Muted>
          ) : (
            <>
              {c.hidden ? <Muted>Hidden by a Minter Admin. You chose to show it.</Muted> : null}
              <CommentText text={c.text} />
            </>
          )}
        </Box>
        {c.pending ? (
          <Muted>{props.pendingText ?? 'Publishing… everyone sees it once QDN has it.'}</Muted>
        ) : readable && !editor && props.onReply ? (
          <Box>
            <Button
              size="small"
              startIcon={<ReplyOutlinedIcon />}
              onClick={() => props.onReply?.(c)}
              aria-label={`Reply to ${c.name}`}
              sx={{ minHeight: 44, ml: -0.5 }}
            >
              Reply
            </Button>
          </Box>
        ) : null}
      </>
    );
  }

  return (
    <Box
      component="li"
      tabIndex={-1}
      data-comment={c.identifier}
      data-comment-ref={c.ref}
      data-thread-root={isReply ? undefined : ''}
      sx={(theme) => ({
        py: 1.25,
        outline: 'none',
        borderRadius: `${theme.shape.borderRadius}px`,
        transition: theme.transitions.create('background-color'),
        // A comment (with its replies) in a subtle frame of its own; replies sit in its block.
        ...(isReply
          ? {}
          : {
              px: { xs: 1.25, sm: 1.5 },
              border: 1,
              borderColor: alpha(theme.palette.text.primary, 0.24),
            }),
        // Focus comes here when a dialog or an editor about it closes.
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
        // A reply's quote went here.
        '&[data-flash="true"]': { bgcolor: accentWash(theme, 0.18) },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {body}
        </Box>
        {actions.length ? (
          <CommentMenu label={`Comment by ${c.name}: more actions`} actions={actions} />
        ) : null}
      </Box>
      {children}
    </Box>
  );
}
