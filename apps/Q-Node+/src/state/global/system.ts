import { atom } from 'jotai';
import { readHostMode, type ColorMode } from '../../hub-theme';

/**
 * The light/dark mode Hub asked for. Hub sends THEME_CHANGED when the user
 * flips its own theme; useIframe writes it here and Root remounts the theme
 * provider with it.
 */
export const hostModeAtom = atom<ColorMode>(readHostMode());
