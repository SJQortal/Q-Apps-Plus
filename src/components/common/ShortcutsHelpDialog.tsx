/**
 * The "?" dialog: every keyboard shortcut (src/hooks/useKeyboardShortcuts.ts).
 */
import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { ResponsiveDialog } from './ResponsiveDialog';
import { SHORTCUT_HELP } from '../../hooks/useKeyboardShortcuts';

const Key = styled('kbd')(({ theme }) => ({
  display: 'inline-block',
  minWidth: 24,
  padding: '2px 7px',
  marginRight: 4,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.primary,
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 600,
  textAlign: 'center',
  lineHeight: 1.4,
}));

interface ShortcutsHelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={onClose} autoFocus>
          Done
        </Button>
      }
    >
      <Box data-qmail-shortcuts-help="" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Work while no text field has focus, in a window at least 600 px wide with a keyboard (not on phones or
          touch-only screens). Two-key sequences are typed one after the other.
        </Typography>
        {SHORTCUT_HELP.map((entry) => (
          <Box
            key={entry.action}
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 32 }}
          >
            <Typography sx={{ fontSize: '0.9375rem' }}>{entry.label}</Typography>
            <Box sx={{ flexShrink: 0 }}>
              {entry.keys.map((key, index) => (
                <span key={key}>
                  {index > 0 && entry.keys.length === 2 && entry.action === 'open' ? (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ mx: 0.5, fontSize: '0.875rem' }}>
                      or
                    </Typography>
                  ) : null}
                  <Key>{key}</Key>
                </span>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </ResponsiveDialog>
  );
}
