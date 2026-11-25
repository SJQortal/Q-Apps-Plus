/**
 * Side by side when there is room: as many columns as fit, each at least `min` px wide;
 * one column (a plain list) when there isn't. The comfortable column (PageBody) always has
 * room for one, so only Full window on a wide screen shows columns, and phones never do.
 */
export function flowColumns(min: number) {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}px), 1fr))`,
    alignItems: 'start',
    '& > *': { minWidth: 0 },
  } as const;
}

/** How narrow a decision or nomination card may get beside another (its three answer columns). */
export const CARD_COLUMN = 640;
/** How narrow a page's section may get beside another: Home's and Settings' sections, History's months. */
export const SECTION_COLUMN = 560;

/**
 * Where Full window applies: any frame but a phone held sideways (under 500 px tall,
 * utils/hubFrame.ts → SHORT_FRAME_MEDIA), which keeps its layout. Under 600 px wide the
 * page already spans the screen.
 */
export const FULL_WINDOW_MEDIA = '@media (min-height: 501px)';
