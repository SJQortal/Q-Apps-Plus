/**
 * Back (GO's hardware button, the browser's Back) closes a full-screen dialog
 * or a sheet on a phone, instead of the pane underneath it: Back in an
 * attachment preview used to close the composer, and its files with it.
 *
 * Like usePhoneBackClose, it works through the router and never touches
 * `window.history` (shared by every Hub tab: docs/QORTAL.md → pitfall 8):
 * opening pushes an entry for the same path carrying this overlay's id;
 * Back pops it and the overlay closes; closing from the UI replaces the
 * entry with one without the id. Pane entries (`qmailSubPane`) are kept, so
 * the pane under the overlay stays open. Renders nothing, and does nothing
 * outside a router (tests, previews).
 */
import { useEffect, useId, useRef } from 'react';
import { useInRouterContext, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

export const OVERLAY_STATE_KEY = 'qmailOverlay';

const stateObject = (state: unknown): Record<string, unknown> =>
  state && typeof state === 'object' ? (state as Record<string, unknown>) : {};

const withoutOverlay = (state: unknown): Record<string, unknown> | null => {
  const rest = { ...stateObject(state) };
  delete rest[OVERLAY_STATE_KEY];
  return Object.keys(rest).length ? rest : null;
};

export interface OverlayBackCloseProps {
  open: boolean;
  onClose: () => void;
  /** Only where the overlay covers the screen (phones); elsewhere Back keeps its meaning. */
  enabled?: boolean;
}

export function OverlayBackClose(props: OverlayBackCloseProps) {
  return useInRouterContext() ? <OverlayBackCloseInRouter {...props} /> : null;
}

function OverlayBackCloseInRouter({ open, onClose, enabled = true }: OverlayBackCloseProps) {
  const id = useId();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const onCloseRef = useRef(onClose);
  const locationRef = useRef(location);
  const pushed = useRef(false);
  useEffect(() => {
    onCloseRef.current = onClose;
    locationRef.current = location;
  });

  const active = open && enabled;

  // Open: an entry of our own. Closed from the UI: take our id off again.
  useEffect(() => {
    const current = locationRef.current;
    const path = current.pathname + current.search + current.hash;
    if (active && !pushed.current) {
      pushed.current = true;
      navigate(path, { state: { ...stateObject(current.state), [OVERLAY_STATE_KEY]: id } });
    } else if (!active && pushed.current) {
      pushed.current = false;
      if (stateObject(current.state)[OVERLAY_STATE_KEY] === id) {
        navigate(path, { replace: true, state: withoutOverlay(current.state) });
      }
    }
  }, [active, id, navigate]);

  // Gone while open (the pane under it closed): leave no id behind.
  useEffect(
    () => () => {
      if (!pushed.current) return;
      pushed.current = false;
      const current = locationRef.current;
      if (stateObject(current.state)[OVERLAY_STATE_KEY] === id) {
        navigate(current.pathname + current.search + current.hash, { replace: true, state: withoutOverlay(current.state) });
      }
    },
    [id, navigate]
  );

  // Back popped our entry: close.
  useEffect(() => {
    if (!pushed.current || navigationType !== 'POP') return;
    if (stateObject(location.state)[OVERLAY_STATE_KEY] !== id) {
      pushed.current = false;
      onCloseRef.current();
    }
  }, [location, navigationType, id]);

  return null;
}
