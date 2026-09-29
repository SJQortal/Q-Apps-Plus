import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { useIframe } from '../hooks/useIframeListener';
import { useHandleNameData } from '../hooks/useHandleNameData';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { NavRail } from '../components/layout/NavRail';
import { BottomNav, BOTTOM_NAV_HEIGHT } from '../components/layout/BottomNav';

const Layout = () => {
  useHandleNameData();
  useIframe();
  const phone = usePhoneLayout();

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', width: '100%' }}>
      {phone ? null : <NavRail />}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100dvh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          pb: phone ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
        }}
      >
        <Outlet />
      </Box>
      {phone ? <BottomNav /> : null}
    </Box>
  );
};

export default Layout;
