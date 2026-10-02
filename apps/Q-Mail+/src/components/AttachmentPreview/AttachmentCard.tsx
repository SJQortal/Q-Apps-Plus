/**
 * One attachment in a message: MIME icon, filename, human size and state
 * (fetching %, ready). Tap opens the preview; the kebab or a long-press
 * offers Open and Save. 44 px targets, colours from the theme.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography, useTheme } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useDispatch } from 'react-redux';
import { setNotification } from '../../state/features/notificationsSlice';
import { fetchingLabel } from '../../layout/states';
import { attachmentDisplayName, attachmentKind, attachmentSizeHint, formatFileSize, type AttachmentRef } from '../../utils/attachmentMeta';
import { AttachmentIcon } from './AttachmentIcon';
import { useAttachment } from './useAttachment';

const LONG_PRESS_MS = 500;

export interface AttachmentCardProps {
  attachment: AttachmentRef;
  onOpen: () => void;
  compact?: boolean;
}

export function AttachmentCard({ attachment, onOpen, compact }: AttachmentCardProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const state = useAttachment(attachment);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const name = attachmentDisplayName(attachment);
  const kind = attachmentKind(attachment, state.entry?.mimeType);
  const size = state.entry?.size ?? attachmentSizeHint(attachment);

  let stateLabel = '';
  if (state.phase === 'fetching') {
    const pct = typeof state.percent === 'number' && state.percent > 0 && state.percent < 100 ? ` ${Math.round(state.percent)}%` : '';
    stateLabel = `${fetchingLabel(state.status)}${pct}`;
  } else if (state.phase === 'decrypting') {
    stateLabel = 'Preparing…';
  } else if (state.phase === 'ready') {
    stateLabel = 'Ready';
  } else if (state.phase === 'error') {
    stateLabel = 'Could not open';
  }
  const secondary = [formatFileSize(size), stateLabel].filter(Boolean).join(' · ');

  const clearPress = useCallback(() => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  useEffect(() => clearPress, [clearPress]);

  const save = async () => {
    setMenuAnchor(null);
    if (saving) return;
    setSaving(true);
    try {
      await state.save();
    } catch (error: any) {
      const msg = typeof error === 'string' ? error : typeof error?.error === 'string' ? error.error : error?.message || 'The file could not be saved.';
      dispatch(setNotification({ msg, alertType: 'error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        minWidth: 0,
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        overflow: 'hidden',
      }}
    >
      <ButtonBase
        ref={cardRef}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          onOpen();
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse') return;
          longPressed.current = false;
          clearPress();
          pressTimer.current = window.setTimeout(() => {
            longPressed.current = true;
            setMenuAnchor(cardRef.current);
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearPress}
        onPointerCancel={clearPress}
        onPointerLeave={clearPress}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuAnchor(cardRef.current);
        }}
        aria-label={`Open ${name}`}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: compact ? 44 : 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 1.5,
          px: 1.5,
          py: compact ? 0.5 : 1,
          textAlign: 'left',
          color: 'text.primary',
          '&:hover': { backgroundColor: theme.palette.action.hover },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        }}
      >
        <AttachmentIcon kind={kind} sx={{ fontSize: compact ? 24 : 28, color: 'primary.main', flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {name}
          </Typography>
          {secondary && (
            <Typography noWrap variant="body2" color={state.phase === 'error' ? 'error.main' : 'text.secondary'}>
              {secondary}
            </Typography>
          )}
        </Box>
      </ButtonBase>
      <IconButton
        aria-label={`More options for ${name}`}
        aria-haspopup="menu"
        onClick={(event) => setMenuAnchor(event.currentTarget)}
        sx={{ minWidth: 44, minHeight: 44, borderRadius: 0, alignSelf: 'center' }}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onOpen();
          }}
          sx={{ minHeight: 44 }}
        >
          <ListItemIcon>
            <OpenInNewOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Open" />
        </MenuItem>
        <MenuItem onClick={() => void save()} disabled={saving} sx={{ minHeight: 44 }}>
          <ListItemIcon>
            <DownloadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={saving ? 'Saving…' : 'Save'} />
        </MenuItem>
      </Menu>
    </Box>
  );
}
