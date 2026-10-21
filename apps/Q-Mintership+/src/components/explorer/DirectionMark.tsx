/**
 * Which way a transaction went, from the account's viewpoint: a small
 * arrow in green (incoming: ↙) or red (outgoing: ↗), with the word for
 * screen readers. `badge` sits it on the corner of a row's icon.
 */
import { Box } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import CallMadeOutlinedIcon from '@mui/icons-material/CallMadeOutlined';
import CallReceivedOutlinedIcon from '@mui/icons-material/CallReceivedOutlined';
import { FLOW_WORD, directionColor, type Flow } from './directionTone';

export function DirectionMark({ flow, badge = false }: { flow: Flow; badge?: boolean }) {
  const Icon = flow === 'in' ? CallReceivedOutlinedIcon : CallMadeOutlinedIcon;
  return (
    <>
      <Box
        component="span"
        aria-hidden
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
          color: directionColor(theme, flow),
          '& svg': { fontSize: badge ? 12 : 16 },
          ...(badge
            ? {
                position: 'absolute',
                right: -3,
                bottom: -3,
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                boxShadow: `0 0 0 1px ${theme.palette.divider}`,
              }
            : { mr: 0.5 }),
        })}
      >
        <Icon />
      </Box>
      <Box component="span" sx={visuallyHidden}>
        {`${FLOW_WORD[flow]}: `}
      </Box>
    </>
  );
}
