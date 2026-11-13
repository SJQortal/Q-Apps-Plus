import { createElement, type ElementType, type ReactNode } from 'react';
import { Card, Box, Typography, Divider } from '@mui/material';

interface Props {
  icon: ElementType;
  title?: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}

const NodeWidget = ({ icon, title, subtitle, children }: Props) => (
  <Card
    sx={{
      display: 'flex',
      flex: '1',
      flexDirection: 'column',
      minHeight: 52,
      minWidth: '280px',
    }}
  >
    <Box
      sx={(theme) => ({
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        '& .icon': {
          color: theme.palette.primary.main,
        },
        '&:before': {
          aspectRatio: '1',
          backgroundColor: theme.palette.primary.main,
          borderRadius: '50%',
          content: `''`,
          display: 'block',
          height: '200%',
          left: -65,
          opacity: 0.15,
          position: 'absolute',
          top: '30%',
          transform: 'translate(-30%, -60%)',
        },
      })}
    >
      <Box
        className="icon"
        sx={{
          width: '5em',
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: '30px',
          paddingRight: '48px',
        }}
      >
        {createElement(icon)}
      </Box>

      <Box
        sx={{
          textAlign: 'right',
        }}
      >
        <Typography color="textSecondary" variant="h6">
          {title}
        </Typography>
        <Typography variant="h4" component="h2">
          {subtitle || ' '}
        </Typography>
      </Box>
    </Box>
    {children && <Divider />}
    {children}
  </Card>
);

export default NodeWidget;
