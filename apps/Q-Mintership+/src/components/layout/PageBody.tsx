import type { ComponentProps } from 'react';
import { styled } from '@mui/material/styles';

const Column = styled('div', {
  shouldForwardProp: (prop) => prop !== '$maxWidth',
})<{ $maxWidth?: number }>(({ theme, $maxWidth = 760 }) => ({
  width: '100%',
  maxWidth: $maxWidth,
  margin: '0 auto',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
    gap: theme.spacing(2),
  },
}));

/**
 * The centred content column under a PageHeader: 760 px for lists, wider
 * when asked. Its blocks fade in and rise 4 px as they arrive: the page as
 * it opens, and data as it replaces a skeleton (index.css → .qmp-reveal;
 * its padding holds the rise, so the page never grows a scrollbar for it).
 */
export function PageBody({ className, ...rest }: ComponentProps<typeof Column>) {
  return <Column className={className ? `qmp-reveal ${className}` : 'qmp-reveal'} {...rest} />;
}
