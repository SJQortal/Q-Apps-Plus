import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { useAtomValue } from 'jotai';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useHubMessages } from '../../hooks/useHubMessages';
import { useInitializeUser } from '../../state/user';
import { userAtom } from '../../state/user';
import { notifyHubDisplayedPath } from '../../routes/hubLocation';
import { useLegacyRouteRedirect } from '../../routes/useLegacyRouteRedirect';
import { BottomNav, BOTTOM_NAV_HEIGHT } from './BottomNav';
import { NavRail } from './NavRail';

const Frame = styled('div')(({ theme }) => ({
  display: 'flex',
  minHeight: '100dvh',
  background: theme.qplus.appGradient,
}));

const Main = styled('main', {
  shouldForwardProp: (prop) => prop !== '$phone',
})<{ $phone: boolean }>(({ $phone }) => ({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: $phone ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
}));

/** Rail or bottom bar, the Hub listeners, the login, and the routed page. */
export function AppShell() {
  const phone = usePhoneLayout();
  const { pathname } = useLocation();
  const user = useAtomValue(userAtom);
  useHubMessages();
  useLegacyRouteRedirect();
  useInitializeUser();

  useEffect(() => {
    notifyHubDisplayedPath(pathname);
  }, [pathname]);

  return (
    <Frame>
      {phone ? null : <NavRail isAdmin={user.isAdmin} />}
      <Main $phone={phone}>
        <Outlet />
      </Main>
      {phone ? <BottomNav /> : null}
    </Frame>
  );
}
