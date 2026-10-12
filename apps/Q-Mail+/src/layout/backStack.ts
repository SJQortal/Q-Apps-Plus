/**
 * What a swipe back closes (SwipeBack.tsx): every layer that Back already
 * closes on a phone registers here while it is open (a sub-pane through
 * usePhoneBackClose, an overlay through OverlayBackClose, the Settings page),
 * newest on top. A swipe closes the top one the way its own close button
 * does, never by going back in `window.history` (shared by every Hub tab:
 * docs/QORTAL.md → pitfall 8); the layer then tidies its router entry as for
 * any close from the UI.
 */
export type SwipeDirection = 'right' | 'left';

export interface BackLayer {
  close: () => void;
  /** An overlay (dialog, sheet, drawer, preview): a MUI modal on the page. */
  overlay: boolean;
  /** The swipe that closes it: right for most, left for the mailboxes drawer (it opens from the left). */
  direction: SwipeDirection;
}

const layers: BackLayer[] = [];

/** Registers an open layer; the returned function unregisters it. */
export function registerBackLayer(close: () => void, options: { overlay?: boolean; direction?: SwipeDirection } = {}): () => void {
  const layer: BackLayer = { close, overlay: Boolean(options.overlay), direction: options.direction ?? 'right' };
  layers.push(layer);
  return () => {
    const index = layers.indexOf(layer);
    if (index >= 0) layers.splice(index, 1);
  };
}

export function topBackLayer(): BackLayer | undefined {
  return layers[layers.length - 1];
}

export function overlayLayerCount(): number {
  return layers.filter((layer) => layer.overlay).length;
}

/** Tests only. */
export function resetBackLayers(): void {
  layers.length = 0;
}
