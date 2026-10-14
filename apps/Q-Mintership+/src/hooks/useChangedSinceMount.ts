/**
 * True once `value` is different from what it was when the component first
 * rendered, and from then on. It tells a change on screen (an answer just
 * given) from what was already there when the page opened, so only the
 * change is animated (index.css → .qmp-pop).
 */
import { useState } from 'react';

export function useChangedSinceMount<T>(value: T): boolean {
  const [first] = useState(value);
  const [changed, setChanged] = useState(false);
  const differs = !Object.is(value, first);
  // Set while rendering: React's pattern for state that follows props.
  if (differs && !changed) setChanged(true);
  return changed || differs;
}
