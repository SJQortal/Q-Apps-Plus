import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useHubMessages } from '../../hooks/useHubMessages';
import { useAppViewport } from '../../hooks/useAppViewport';
import { useTrackInAppHistory } from '../../hooks/useSafeBack';
import { useApplyMotionSetting } from '../../hooks/useReducedMotion';
import { BOTTOM_NAV_VAR, usePublishOffset } from '../../hooks/useOverlayPadding';
import { useDecisions, useMyStatus } from '../../hooks/useData';
import { useHistoryNews } from '../../hooks/useHistoryNews';
import { useRecordVisit } from '../../hooks/useLastVisit';
import { useScrollTopOnNewPage } from '../../hooks/useScrollTopOnNewPage';
import { useSettleConfirmingWrites } from '../../hooks/useSettleConfirmingWrites';
import { notifyHubDisplayedPath } from '../../routes/hubLocation';
import { useLegacyRouteRedirect } from '../../routes/useLegacyRouteRedirect';
import { useSession, useStartSession } from '../../state/session';
import { useQuiz } from '../../state/explorerQuiz';
import { PATHS } from '../../routes/paths';
import { signerState } from '../../rules/tally';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { ListSkeleton } from '../common/states';
import { BottomNav, BOTTOM_NAV_HEIGHT } from './BottomNav';
import { NavRail } from './NavRail';
import { isBottomBarLayout, isBottomNavShown, useFrameFacts } from './useBottomNav';

/** The Explorer Quiz's bar, loaded only while the quiz is on. */
const QuizDock = lazy(() => import('../explorer/quiz/QuizDock'));

const Frame = styled('div')(({ theme }) => ({
  display: 'flex',
  minHeight: 'var(--qmp-app-height, 100dvh)',
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

/** Decisions the signed-in admin can still sign: open, not answered by them, not a double. */
function useDecisionsBadge(isAdmin: boolean, publicKey: string): number {
  const decisions = useDecisions(isAdmin);
  if (!isAdmin || !decisions.data) return 0;
  return decisions.data.decisions.filter(
    (d) =>
      d.tally &&
      !d.double &&
      (d.phase === 'open' || d.phase === 'early') &&
      signerState(d.tally, publicKey) === 'none'
  ).length;
}

/** While a page's code loads: shown only if that takes a moment (.qmp-fade-late). */
function PageFallback() {
  return (
    <Box className="qmp-fade-late" sx={{ p: 2, maxWidth: 760, mx: 'auto', width: '100%' }}>
      <ListSkeleton count={3} />
    </Box>
  );
}

/** Rail or bottom bar, the Hub listeners, the session, and the routed page. */
export function AppShell() {
  const frame = useFrameFacts();
  const { pathname } = useLocation();
  const session = useSession();
  const { status } = useMyStatus();
  const isAdmin = Boolean(status?.isAdmin);
  const badge = useDecisionsBadge(isAdmin, session.publicKey);
  const historyBadge = useHistoryNews(isAdmin, session.status === 'ready' ? session.address : null);
  const quizOn = useQuiz().on;
  const onExplorer = pathname === PATHS.explorer || pathname.startsWith(`${PATHS.explorer}/`);

  useStartSession();
  useHubMessages();
  useLegacyRouteRedirect();
  useTrackInAppHistory();
  useScrollTopOnNewPage();
  useAppViewport();
  useApplyMotionSetting();
  useRecordVisit();
  useSettleConfirmingWrites();

  useEffect(() => {
    notifyHubDisplayedPath(pathname);
  }, [pathname]);

  // The bottom-bar layout keeps the rail away; the bar itself steps aside for the keyboard.
  const bottomBar = isBottomBarLayout(frame);
  const navShown = isBottomNavShown(frame);
  usePublishOffset(
    BOTTOM_NAV_VAR,
    navShown ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : null
  );
  return (
    <Frame>
      {bottomBar ? null : <NavRail decisionsBadge={badge} historyBadge={historyBadge} />}
      <Main $phone={navShown}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
        {/* On every Explorer page while the quiz is on, at the bottom of the screen. */}
        {quizOn && onExplorer ? (
          <ErrorBoundary resetKey="explorer-quiz">
            <Suspense fallback={null}>
              <QuizDock />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </Main>
      {navShown ? <BottomNav decisionsBadge={badge} historyBadge={historyBadge} /> : null}
    </Frame>
  );
}
