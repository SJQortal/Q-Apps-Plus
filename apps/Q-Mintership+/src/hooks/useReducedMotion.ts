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

/**
 * Mirror the setting on <html data-motion> so the CSS rules in index.css
 * apply it everywhere: "reduce" turns motion down, "full" keeps it even when
 * the system asks for less.
 */
export function useApplyMotionSetting(): void {
  const setting = useAtomValue(motionAtom);
  useEffect(() => {
    const root = document.documentElement;
    if (setting === 'system') root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', setting);
  }, [setting]);
}
