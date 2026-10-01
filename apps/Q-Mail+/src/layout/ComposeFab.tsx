import { Fab } from '@mui/material';
import { styled } from '@mui/material/styles';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { BOTTOM_NAV_HEIGHT } from './BottomNav';

const Floating = styled(Fab, { shouldForwardProp: (p) => p !== '$aboveNav' })<{ $aboveNav: boolean }>(
  ({ theme, $aboveNav }) => ({
    position: 'absolute',
    right: theme.spacing(2),
    bottom: `calc(${$aboveNav ? BOTTOM_NAV_HEIGHT : 0}px + ${theme.spacing(2)} + env(safe-area-inset-bottom, 0px))`,
    zIndex: 20,
    boxShadow: theme.shadows[6],
    transition: 'transform 180ms ease, opacity 180ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
);

interface ComposeFabProps {
  onClick: () => void;
  aboveNav?: boolean;
  label?: string;
}

/** The floating main action on phones (docs/DESIGN.md → Mobile → Navigation). */
export function ComposeFab({ onClick, aboveNav = true, label = 'Compose' }: ComposeFabProps) {
  return (
    <Floating color="primary" onClick={onClick} aria-label={label} $aboveNav={aboveNav}>
      <EditOutlinedIcon />
    </Floating>
  );
}
