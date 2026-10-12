import { styled } from '@mui/material/styles';

/** The centred content column under a PageHeader: 760 px for lists, wider when asked. */
export const PageBody = styled('div', {
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
