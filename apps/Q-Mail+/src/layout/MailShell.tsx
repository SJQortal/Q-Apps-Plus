/**
 * The responsive frame of the mail client (docs/DESIGN.md → Layout):
 *
 *   desktop  | rail | list | reading |
 *   medium   | list | reading |          (rail in a drawer)
 *   phone    | list |  or  | reading |   (one pane; bottom nav; floating Compose)
 *
 * A `wide` view (composer, group threads, aliases, changelog) takes the place
 * of list + reading. The shell owns no mail state: Mail.tsx decides what goes
 * in each slot.
 */
import type { ReactNode } from 'react';
import { Drawer } from '@mui/material';
import { styled } from '@mui/material/styles';
import { appSurface, headerFill } from '../hub-theme';
import type { LayoutMode } from './useLayoutMode';
import { APP_HEIGHT_VAR } from './useAppViewport';
import { LANDSCAPE_FRAME_MEDIA, useLandscapeFrame } from '../utils/hubFrame';

export const RAIL_WIDTH = 240;
export const LIST_WIDTH_DESKTOP = 380;
export const LIST_WIDTH_MEDIUM = 300;
/** Room the floating Compose button needs below a list so it never covers the last row (pitfall 6). */
export const FAB_CLEARANCE = 88;
export const LIST_CLEARANCE_VAR = '--qmail-list-clearance';

const Frame = styled('div')(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: `var(${APP_HEIGHT_VAR}, 100dvh)`,
  overflow: 'hidden',
  color: theme.palette.text.primary,
  background: appSurface(theme),
}));

const Body = styled('div')({
  position: 'relative',
  display: 'flex',
  flex: 1,
  minHeight: 0,
  width: '100%',
});

const RailColumn = styled('aside')(({ theme }) => ({
  width: RAIL_WIDTH,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  backgroundColor: headerFill(theme),
  borderRight: `1px solid ${theme.palette.divider}`,
}));

const Main = styled('div')({
  position: 'relative',
  display: 'flex',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
});

const Pane = styled('section')({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
});

const ListPane = styled(Pane, { shouldForwardProp: (p) => p !== '$mode' && p !== '$fab' })<{
  $mode: LayoutMode;
  /** The floating button is over this pane: its scroller gets clearance (none in landscape, where the button hides). */
  $fab: boolean;
}>(({ theme, $mode, $fab }) => ({
  flex: $mode === 'phone' ? 1 : '0 0 auto',
  width: $mode === 'desktop' ? LIST_WIDTH_DESKTOP : $mode === 'medium' ? LIST_WIDTH_MEDIUM : '100%',
  borderRight: $mode === 'phone' ? 'none' : `1px solid ${theme.palette.divider}`,
  [LIST_CLEARANCE_VAR]: $fab ? `${FAB_CLEARANCE}px` : '0px',
  [`@media ${LANDSCAPE_FRAME_MEDIA}`]: { [LIST_CLEARANCE_VAR]: '0px' },
}));

const ReadingPane = styled(Pane)({ flex: 1 });

const PhoneOverlay = styled(Pane)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 5,
  background: appSurface(theme),
}));

const WidePane = styled(Pane, { shouldForwardProp: (p) => p !== '$fab' })<{ $fab: boolean }>(({ $fab }) => ({
  flex: 1,
  [LIST_CLEARANCE_VAR]: $fab ? `${FAB_CLEARANCE}px` : '0px',
  [`@media ${LANDSCAPE_FRAME_MEDIA}`]: { [LIST_CLEARANCE_VAR]: '0px' },
}));

/**
 * The scrolling body of a pane; put a <PaneHeader> before it. Its bottom
 * padding is the pane's clearance for the floating button, so the last row
 * can always scroll out from under it.
 */
export const PaneScroll = styled('div')({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
  overscrollBehavior: 'contain',
  paddingBottom: `var(${LIST_CLEARANCE_VAR}, 0px)`,
});

export interface MailShellProps {
  mode: LayoutMode;
  /** Rail content: shown in the left column on desktop, in a drawer otherwise. */
  rail: ReactNode;
  railOpen: boolean;
  onRailOpenChange: (open: boolean) => void;
  /** Phone only. Hidden while a reading pane or wide view is open. */
  bottomNav?: ReactNode;
  /** Phone only. Hidden while a reading pane or wide view is open. */
  fab?: ReactNode;
  /** Sticky strip above the panes, e.g. a loading banner. */
  banner?: ReactNode;
  list: ReactNode;
  /** Reading pane content; null shows `readingPlaceholder`. */
  reading?: ReactNode | null;
  readingPlaceholder?: ReactNode;
  /** On phones: show the reading pane full-screen instead of the list. */
  readingOpen?: boolean;
  /** Replaces list + reading (composer, threads of a group, aliases page…). */
  wide?: ReactNode | null;
  /** Keep the phone bottom nav and FAB while `wide` shows (a top-level page, not a sub-page). */
  wideKeepsChrome?: boolean;
  /** Rendered once, outside the panes (dialogs, tours). */
  overlays?: ReactNode;
}

export function MailShell({
  mode,
  rail,
  railOpen,
  onRailOpenChange,
  bottomNav,
  fab,
  banner,
  list,
  reading,
  readingPlaceholder,
  readingOpen = false,
  wide,
  wideKeepsChrome = false,
  overlays,
}: MailShellProps) {
  const isPhone = mode === 'phone';
  const isDesktop = mode === 'desktop';
  // A phone held sideways in Hub gives the medium layout about 201 px of
  // height: list and reading pane side by side are useless, so it shows one
  // at a time, the way a phone does, with the medium rail drawer and no
  // phone chrome (pitfall 3).
  const landscape = useLandscapeFrame();
  const onePane = isPhone || (mode === 'medium' && landscape);
  const showWide = wide !== null && wide !== undefined;
  const phoneShowsReading = onePane && readingOpen && !showWide;
  const showPhoneChrome = isPhone && !phoneShowsReading && (!showWide || wideKeepsChrome);
  const hasFab = showPhoneChrome && Boolean(fab);

  return (
    <Frame data-layout-mode={mode} data-one-pane={onePane ? 'true' : undefined}>
      {banner}
      <Body>
        {isDesktop ? (
          <RailColumn aria-label="Mailboxes">{rail}</RailColumn>
        ) : (
          <Drawer
            open={railOpen}
            onClose={() => onRailOpenChange(false)}
            slotProps={{ paper: { sx: { width: 'min(85vw, 320px)', display: 'flex', flexDirection: 'column' } } }}
          >
            {rail}
          </Drawer>
        )}
        <Main>
          {showWide ? (
            <WidePane aria-live="polite" $fab={hasFab}>
              {wide}
            </WidePane>
          ) : (
            <>
              {!phoneShowsReading && (
                <ListPane $mode={onePane ? 'phone' : mode} $fab={hasFab} aria-label="Messages">
                  {list}
                </ListPane>
              )}
              {!onePane && <ReadingPane aria-label="Reading pane">{reading ?? readingPlaceholder}</ReadingPane>}
              {phoneShowsReading && <PhoneOverlay aria-label="Reading pane">{reading}</PhoneOverlay>}
            </>
          )}
          {showPhoneChrome && fab}
        </Main>
      </Body>
      {showPhoneChrome && bottomNav}
      {overlays}
    </Frame>
  );
}
