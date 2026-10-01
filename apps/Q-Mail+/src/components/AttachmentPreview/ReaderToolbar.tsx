/**
 * One slim row of controls above a document (PDF, image, text). 44 px
 * targets, labelled buttons, colours from the theme.
 */
import type { MouseEvent, ReactNode } from 'react';
import { Box, ButtonBase, IconButton, Typography } from '@mui/material';

export function ReaderToolbar({ children, label = 'Reader controls' }: { children: ReactNode; label?: string }) {
  return (
    <Box
      role="toolbar"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: { xs: 'space-between', sm: 'center' },
        flexWrap: 'wrap',
        columnGap: { xs: 0.5, sm: 3 },
        flexShrink: 0,
        pb: 0.5,
        color: 'text.primary',
      }}
    >
      {children}
    </Box>
  );
}

export function ReaderGroup({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{children}</Box>;
}

export function ReaderButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <IconButton
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      color={pressed ? 'primary' : 'inherit'}
      disabled={disabled}
      onClick={onClick}
      sx={{ minWidth: 44, minHeight: 44, '& svg': { fontSize: 22 } }}
    >
      {children}
    </IconButton>
  );
}

/** Page count or zoom level between two buttons; tappable when it resets. */
export function ReaderLabel({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  const sx = {
    minWidth: 48,
    minHeight: onClick ? 44 : undefined,
    px: 0.5,
    py: 0.5,
    borderRadius: 1,
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'center',
    color: 'inherit',
  } as const;
  if (onClick) {
    return (
      <ButtonBase aria-label={label} title={label} onClick={onClick} sx={sx}>
        {children}
      </ButtonBase>
    );
  }
  return (
    <Typography component="span" aria-label={label} sx={sx}>
      {children}
    </Typography>
  );
}
