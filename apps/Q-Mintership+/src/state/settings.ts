/**
 * Per-app settings, saved in localStorage as JSON under the app's storage
 * prefix (constants/plus.ts), the way the theme is.
 */
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_PREFIX } from '../constants/plus';

export type MotionSetting = 'system' | 'reduce' | 'full';
export type TimeDisplay = 'time' | 'blocks' | 'both';
export type ActivityWindow = 30 | 60 | 90 | 180;

export const SETTINGS_KEYS = {
  motion: `${STORAGE_PREFIX}motion`,
  timeDisplay: `${STORAGE_PREFIX}time-display`,
  celebrate: `${STORAGE_PREFIX}celebrate`,
  activityWindow: `${STORAGE_PREFIX}activity-window`,
  // Still "hide-signed", from when it hid signatures only: the same key, so a
  // device's choice carries over now that it hides rejections too.
  decisionsHideAnswered: `${STORAGE_PREFIX}decisions-hide-signed`,
} as const;

/** Animations: follow the system, always reduce, or always play. */
export const motionAtom = atomWithStorage<MotionSetting>(SETTINGS_KEYS.motion, 'system');

/** Countdowns as time left, blocks left, or both. */
export const timeDisplayAtom = atomWithStorage<TimeDisplay>(SETTINGS_KEYS.timeDisplay, 'time');

/** The small celebration when someone becomes a minter. */
export const celebrateAtom = atomWithStorage<boolean>(SETTINGS_KEYS.celebrate, true);

/** Minter Admin Activity's default window, in days. */
export const activityWindowAtom = atomWithStorage<ActivityWindow>(SETTINGS_KEYS.activityWindow, 30);

/** Decisions: hide the ones you have already answered (signed or rejected). */
export const decisionsHideAnsweredAtom = atomWithStorage<boolean>(
  SETTINGS_KEYS.decisionsHideAnswered,
  false
);
