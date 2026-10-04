import { Fab } from '@mui/material';
import { styled } from '@mui/material/styles';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { LANDSCAPE_FRAME_MEDIA } from '../utils/hubFrame';

/** The button's offset from the bottom of the list pane (16 px). */
export const FAB_BOTTOM_SPACING = 2;

const Floating = styled(Fab)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(2),
  // It sits inside the main pane, which already ends above the bottom nav
  // (and the nav's height already includes the safe-area inset), so 16 px
  // from that edge: FAB_CLEARANCE (88 px = 16 + 56 + 16) then clears it.
  bottom: theme.spacing(FAB_BOTTOM_SPACING),
  zIndex: 20,
  boxShadow: theme.shadows[6],
  transition: 'transform 180ms ease, opacity 180ms ease',
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  // A phone held sideways gives the app about 201 px in Hub: no floating button there (pitfall 3).
  [`@media ${LANDSCAPE_FRAME_MEDIA}`]: { display: 'none' },
}));

interface ComposeFabProps {
  onClick: () => void;
  label?: string;
}

/** The floating main action on phones (docs/DESIGN.md → Mobile → Navigation). */
export function ComposeFab({ onClick, label = 'Compose' }: ComposeFabProps) {
  return (
    <Floating color="primary" onClick={onClick} aria-label={label} data-qmail-tour="compose">
      <EditOutlinedIcon />
    </Floating>
  );
}
