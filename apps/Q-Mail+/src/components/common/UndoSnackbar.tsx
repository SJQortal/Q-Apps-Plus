/**
 * A short confirmation with Undo, for actions that take something out of a
 * list (archiving or moving mail, hiding a name). It is announced politely
 * (role=status), reads in every theme (the paper colour and the theme's text,
 * not MUI's inverted bar), and its Undo takes focus, so keyboard and screen
 * reader users can reach it before it goes; with a mouse no ring shows. When
 * it closes while focused, focus moves to `returnFocus()` (the next row), not
 * to the page.
 */
import type { ReactNode } from 'react';
import { Button, Snackbar, type Theme } from '@mui/material';

export interface UndoToast {
  /** A new key per action: a second action replaces the first toast. */
  key: number;
  message: ReactNode;
  onUndo?: () => void;
  /** Where focus goes when the toast closes with focus inside it. */
  returnFocus?: () => HTMLElement | null | undefined;
}

export const UNDO_TOAST_MS = 6000;

export function UndoSnackbar({ toast, onDone }: { toast: UndoToast | null; onDone: () => void }) {
  const close = (undo: boolean) => {
    const current = toast;
    const focusInside = Boolean(
      current && document.activeElement instanceof HTMLElement && document.activeElement.closest('[data-undo-toast]')
    );
    onDone();
    if (undo) current?.onUndo?.();
    if (focusInside) current?.returnFocus?.()?.focus();
  };
  return (
    <Snackbar
      key={toast?.key}
      open={Boolean(toast)}
      autoHideDuration={UNDO_TOAST_MS}
      onClose={(_, reason) => {
        if (reason !== 'clickaway') close(false);
      }}
      slotProps={{
        content: {
          role: 'status',
          'data-undo-toast': '',
          sx: (theme: Theme) => ({
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[6],
          }),
        } as any,
      }}
      message={toast?.message}
      action={
        toast?.onUndo ? (
          <Button color="primary" autoFocus onClick={() => close(true)} sx={{ minHeight: 44, fontWeight: 700 }}>
            Undo
          </Button>
        ) : undefined
      }
    />
  );
}
