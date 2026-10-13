/**
 * One comment: who wrote it and when (edited), its text, Reply, and a
 * "More" menu (Edit and Delete for your own; Mute on this device for
 * others'; Hide for everyone or Show again for Minter Admins). A deleted
 * comment reads "Deleted" in its place; one a Minter Admin hid, or from a
 * name you muted, is folded away with "Show anyway".
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
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
import { PersonByName } from '../../pages/history/parts/PersonByName';
import { formatDateTime, formatRelative } from '../../utils/format';
import { CommentMenu, type CommentAction } from './CommentMenu';
import { CommentText } from './CommentText';

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
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  );
}

export function CommentItem(props: CommentItemProps) {
  const { comment: c, viewer, now, isReply, editor, children } = props;
  const [revealed, setRevealed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const revealedNow = useRef(false);
  const owner = useQuery(
    viewer.signedIn && c.name !== viewer.name ? `nameowner:${c.name}` : null,
    () => getNameOwner(c.name)
  );
  const mine = viewer.signedIn && (c.name === viewer.name || owner.data === viewer.address);

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
        <PersonByName name={c.name} size={isReply ? 24 : 28} secondary={when} />
        {c.replyToName ? <Muted>Replying to {c.replyToName}</Muted> : null}
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
          <Muted>Publishing… everyone sees it once QDN has it.</Muted>
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
      sx={(theme) => ({
        py: 1.25,
        outline: 'none',
        // Focus comes here when a dialog or an editor about it closes.
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
        '& + &': isReply ? {} : { borderTop: 1, borderColor: 'divider' },
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
