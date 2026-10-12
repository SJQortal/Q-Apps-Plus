import { useEffect } from 'react';
import { useMediaQuery } from '@mui/material';
import { useAtomValue } from 'jotai';
import { motionAtom } from '../state/settings';

/**
 * True when animations should be skipped: the system's reduced-motion
 * setting, or Settings → Appearance → Motion → Reduce.
 */
export function useReducedMotion(): boolean {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const setting = useAtomValue(motionAtom);
  return setting === 'reduce' || (setting === 'system' && system);
}

/** Mirror the setting on <html data-motion> so the CSS rule in index.css applies it everywhere. */
export function useApplyMotionSetting(): void {
  const setting = useAtomValue(motionAtom);
  useEffect(() => {
    const root = document.documentElement;
    if (setting === 'reduce') root.setAttribute('data-motion', 'reduce');
    else root.removeAttribute('data-motion');
  }, [setting]);
}
