/**
 * Per-app settings, saved in localStorage as JSON under the app's storage
 * prefix (constants/plus.ts), the way the theme is.
 */
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_PREFIX } from '../constants/plus';

export type MotionSetting = 'system' | 'reduce' | 'full';
export type TimeDisplay = 'time' | 'blocks' | 'both';
export type ActivityWindow = 30 | 60 | 90 | 180;
/** Decisions: one queue, most urgent first, or a section per type. */
export type DecisionsOrder = 'urgency' | 'type';

export const SETTINGS_KEYS = {
  motion: `${STORAGE_PREFIX}motion`,
  timeDisplay: `${STORAGE_PREFIX}time-display`,
  celebrate: `${STORAGE_PREFIX}celebrate`,
  activityWindow: `${STORAGE_PREFIX}activity-window`,
  // Still "hide-signed", from when it hid signatures only: the same key, so a
  // device's choice carries over now that it hides rejections too.
  decisionsHideAnswered: `${STORAGE_PREFIX}decisions-hide-signed`,
  decisionsOrder: `${STORAGE_PREFIX}decisions-order`,
  explorerRemember: `${STORAGE_PREFIX}explorer-remember`,
  activityFirstRead: `${STORAGE_PREFIX}explorer-activity-first-read`,
  activityHiddenMarks: `${STORAGE_PREFIX}explorer-activity-hidden-marks`,
} as const;

/** Animations: follow the system, always reduce, or always play. */
export const motionAtom = atomWithStorage<MotionSetting>(SETTINGS_KEYS.motion, 'system');

/** Countdowns as time left, blocks left, or both. */
export const timeDisplayAtom = atomWithStorage<TimeDisplay>(SETTINGS_KEYS.timeDisplay, 'time');

/** The small celebration when someone becomes a minter. */
export const celebrateAtom = atomWithStorage<boolean>(SETTINGS_KEYS.celebrate, true);

/** Minter Admin Activity's default window, in days. */
export const activityWindowAtom = atomWithStorage<ActivityWindow>(SETTINGS_KEYS.activityWindow, 30);

/** Decisions: hide what you already voted on (approved or rejected; polls you voted on). */
export const decisionsHideAnsweredAtom = atomWithStorage<boolean>(
  SETTINGS_KEYS.decisionsHideAnswered,
  false
);

/** Decisions: by type (a section per kind of change, the default), or most urgent first. */
export const decisionsOrderAtom = atomWithStorage<DecisionsOrder>(
  SETTINGS_KEYS.decisionsOrder,
  'type'
);

/**
 * Explorer: remember the accounts explored on this device (Recent
 * explorations, addresses only; state/explorer.ts). On unless turned off.
 */
export const explorerRememberAtom = atomWithStorage<boolean>(SETTINGS_KEYS.explorerRemember, true);

/** The Explorer's Activity: transactions read when it opens, and on each Read older. */
export const ACTIVITY_FIRST_READ_DEFAULT = 1_000;
/** Read in pages of 100 (Core's), never more than the whole chart reads (20,000). */
export const ACTIVITY_FIRST_READ_MIN = 100;
export const ACTIVITY_FIRST_READ_MAX = 20_000;
/** The choices offered beside "another number" (Simon, 2026-10-17: "like: 100, 500, 2000"). */
export const ACTIVITY_FIRST_READ_CHOICES = [100, 500, 1_000, 2_000] as const;

/** A number of transactions to read, kept to whole pages of 100 within the limits. */
export function clampActivityRead(value: unknown): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? value : ACTIVITY_FIRST_READ_DEFAULT;
  const pages = Math.ceil(n / ACTIVITY_FIRST_READ_MIN);
  return Math.min(ACTIVITY_FIRST_READ_MAX, Math.max(1, pages) * ACTIVITY_FIRST_READ_MIN);
}

/**
 * The Explorer's Activity (Simon, 2026-10-17: "the user can adjust the default auto fetch to
 * lower that amount"): how many of an account's newest transactions it reads when it opens,
 * and how many more each Read older reads. On this device.
 */
export const activityFirstReadAtom = atomWithStorage<number>(
  SETTINGS_KEYS.activityFirstRead,
  ACTIVITY_FIRST_READ_DEFAULT
);

/** The kinds of milestones Activity leaves off its chart and list (rules/explorer/activity.ts). */
export const activityHiddenMarksAtom = atomWithStorage<string[]>(
  SETTINGS_KEYS.activityHiddenMarks,
  []
);
