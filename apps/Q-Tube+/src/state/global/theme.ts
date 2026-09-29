import { atom } from 'jotai';
import { readHostMode, type ColorMode } from '../../hub-theme';

/**
 * The light/dark mode Hub asked for. Hub sends THEME_CHANGED when the user
 * flips its own theme; useIframe writes it here and App remounts the theme
 * provider with it. The look itself (Hub 3.0, Q-Tube Classic, Black, White)
 * is chosen in Settings and kept by the kit under THEME_STORAGE_KEY.
 */
export const hostModeAtom = atom<ColorMode>(readHostMode());
