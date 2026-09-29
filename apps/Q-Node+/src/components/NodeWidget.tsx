import { FC, createElement } from 'react';
import { Card, Box, Typography, Divider } from '@mui/material';

interface Props {
  icon: FC<any>;
  title?: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

const NodeWidget = ({ icon, title, subtitle, children }: Props) => (
  <Card
    sx={{
      borderRadius: '10px',
      display: 'flex',
      flex: '1',
      flexDirection: 'column',
      minHeight: 52,
      minWidth: '280px',
    }}
  >
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        '& .icon': {
          color: '#05a2e4',
        },
        '&:before': {
          aspectRatio: '1',
          backgroundColor: '#05a2e4',
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
      }}
    >
      <Box
        width="5em"
        className="icon"
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          paddingBottom: '30px',
          paddingRight: '48px',
        }}
      >
        {createElement(icon)}
      </Box>

      <Box textAlign="right">
        <Typography color="textSecondary" variant='h6'>{title}</Typography>
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
