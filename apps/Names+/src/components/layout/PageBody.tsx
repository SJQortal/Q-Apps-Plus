import { styled } from '@mui/material/styles';

/** The centred content column under a PageHeader. */
export const PageBody = styled('div', {
  shouldForwardProp: (prop) => prop !== '$maxWidth',
})<{ $maxWidth?: number }>(({ theme, $maxWidth = 960 }) => ({
  width: '100%',
  maxWidth: $maxWidth,
  margin: '0 auto',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  },
}));
