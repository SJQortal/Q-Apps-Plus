/**
 * The responsive frame of the mail client (docs/DESIGN.md → Layout):
 *
 *   desktop  | rail | list | reading |
 *   medium   | list | reading |          (rail in a drawer)
 *   phone    | list |  or  | reading |   (one pane; bottom nav; floating Compose)
 *
 * With nothing open there is no reading pane and no "Select a message"
 * placeholder: the list takes the whole main area, and the reading pane
 * appears beside it when a message or thread opens.
 *
 * On desktop (and medium while two panes show) the borders between rail,
 * list and reading pane can be dragged or moved with the keyboard
 * (PaneResizer); the widths are saved per account (usePaneWidths). Never on
 * phones or in the landscape one-pane mode.
 *
 * A `wide` view (composer, group threads, aliases, changelog) takes the place
 * of list + reading. The shell owns no mail state: Mail.tsx decides what goes
 * in each slot.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Drawer } from '@mui/material';
import { styled } from '@mui/material/styles';
import { appSurface, headerFill } from '../hub-theme';
import type { LayoutMode } from './useLayoutMode';
import { APP_HEIGHT_VAR } from './useAppViewport';
import { LANDSCAPE_FRAME_MEDIA, useLandscapeFrame } from '../utils/hubFrame';
import { PaneResizer } from './PaneResizer';
import { PANE_LIMITS, clampListWidth, clampRailWidth, listWidthBounds, usePaneWidths } from './usePaneWidths';

export const RAIL_WIDTH = 240;
export const LIST_WIDTH_DESKTOP = 380;
export const LIST_WIDTH_MEDIUM = 300;
/** Room the floating Compose button needs below a list so it never covers the last row (pitfall 6). */
export const FAB_CLEARANCE = 88;
export const LIST_CLEARANCE_VAR = '--qmail-list-clearance';
/** Container name of the list pane: rows lay out in columns when it is wide (MailMessageRow). */
export const LIST_CONTAINER = 'qmail-list';

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

/** Its width comes from the `style` prop (resizable), so a drag adds no CSS rules. */
const RailColumn = styled('aside')(({ theme }) => ({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden',
  backgroundColor: headerFill(theme),
  borderRight: `1px solid ${theme.palette.divider}`,
}));

const Main = styled('main')({
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

const ListPane = styled(Pane, { shouldForwardProp: (p) => p !== '$mode' && p !== '$fab' && p !== '$full' })<{
  $mode: LayoutMode;
  /** The floating button is over this pane: its scroller gets clearance (none in landscape, where the button hides). */
  $fab: boolean;
  /** Nothing is open beside it: the list takes the whole main area. */
  $full: boolean;
}>(({ theme, $mode, $fab, $full }) => ({
  // Beside a reading pane the width comes from the `style` prop (resizable).
  flex: $mode === 'phone' || $full ? 1 : '0 0 auto',
  ...($mode === 'phone' || $full ? { width: '100%' } : {}),
  borderRight: $mode === 'phone' || $full ? 'none' : `1px solid ${theme.palette.divider}`,
  containerType: 'inline-size',
  containerName: LIST_CONTAINER,
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
  /** Reading pane content. Null: no reading pane, the list takes the full width (one-pane layouts: the list). */
  reading?: ReactNode | null;
  /** On phones: show the reading pane full-screen instead of the list. */
  readingOpen?: boolean;
  /** Replaces list + reading (composer, threads of a group, aliases page…). */
  wide?: ReactNode | null;
  /** Keep the phone bottom nav and FAB while `wide` shows (a top-level page, not a sub-page). */
  wideKeepsChrome?: boolean;
  /** Rendered once, outside the panes (dialogs, tours). */
  overlays?: ReactNode;
  /** The signed-in address: pane widths are saved per account. Empty: kept for the session only. */
  paneWidthsAccount?: string;
}

/** The rendered width of an element, kept up to date; null until it has been laid out. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const next = node.getBoundingClientRect().width;
      setWidth(next > 0 ? Math.round(next) : null);
    };
    measure();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return [ref, width] as const;
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
  readingOpen = false,
  wide,
  wideKeepsChrome = false,
  overlays,
  paneWidthsAccount = '',
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
  const hasReading = reading !== null && reading !== undefined;
  const twoPanes = !onePane && hasReading;
  const phoneShowsReading = onePane && readingOpen && !showWide;
  const showPhoneChrome = isPhone && !phoneShowsReading && (!showWide || wideKeepsChrome);
  const hasFab = showPhoneChrome && Boolean(fab);

  // Resizable panes (desktop, and medium while two panes show).
  const paneWidths = usePaneWidths(paneWidthsAccount);
  const [mainRef, mainWidth] = useElementWidth<HTMLElement>();
  const railId = useId();
  const listId = useId();
  const railWidth = clampRailWidth(paneWidths.widths.rail ?? RAIL_WIDTH);
  const listBounds = listWidthBounds(mainWidth);
  const listWidth = clampListWidth(
    paneWidths.widths.list ?? (isDesktop ? LIST_WIDTH_DESKTOP : LIST_WIDTH_MEDIUM),
    mainWidth
  );
  const listResizable = twoPanes && !showWide;

  return (
    <Frame data-layout-mode={mode} data-one-pane={onePane ? 'true' : undefined}>
      {banner}
      <Body>
        {isDesktop ? (
          <RailColumn id={railId} aria-label="Mailboxes" style={{ width: railWidth }}>
            {rail}
          </RailColumn>
        ) : (
          <Drawer
            open={railOpen}
            onClose={() => onRailOpenChange(false)}
            slotProps={{ paper: { 'aria-label': 'Mailboxes menu', sx: { width: 'min(85vw, 320px)', display: 'flex', flexDirection: 'column' } } }}
          >
            {rail}
          </Drawer>
        )}
        <Main ref={mainRef}>
          {/* The rail's handle opens <main> rather than sitting between the two
              landmarks, so no content is outside a region (axe "region"). It
              resizes from the drag distance, so where it sits doesn't matter. */}
          {isDesktop && (
            <PaneResizer
              label="Resize the mailboxes column"
              controls={railId}
              value={railWidth}
              min={PANE_LIMITS.railMin}
              max={PANE_LIMITS.railMax}
              onChange={(width) => paneWidths.preview('rail', width)}
              onCommit={(width) => paneWidths.commit('rail', width)}
              onReset={() => paneWidths.reset('rail')}
            />
          )}
          {showWide ? (
            <WidePane $fab={hasFab}>
              {/* Not a live region: every keystroke in the composer and every row of a
                  page would be read out. Views and forms carry their own status regions. */}
              {wide}
            </WidePane>
          ) : (
            <>
              {!phoneShowsReading && (
                <ListPane
                  id={listId}
                  $mode={onePane ? 'phone' : mode}
                  $full={!onePane && !twoPanes}
                  $fab={hasFab}
                  aria-label="Messages"
                  style={listResizable ? { width: listWidth } : undefined}
                >
                  {list}
                </ListPane>
              )}
              {listResizable && (
                <PaneResizer
                  label="Resize the message list"
                  controls={listId}
                  value={listWidth}
                  min={listBounds.min}
                  max={listBounds.max}
                  onChange={(width) => paneWidths.preview('list', width)}
                  onCommit={(width) => paneWidths.commit('list', width)}
                  onReset={() => paneWidths.reset('list')}
                />
              )}
              {twoPanes && <ReadingPane aria-label="Reading pane">{reading}</ReadingPane>}
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
