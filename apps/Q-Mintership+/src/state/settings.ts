/**
 * Per-app settings, saved in localStorage the same way the theme is (a JSON
 * value under a `qmintershipplus-` key), so a later QDN sync can ship them as
 * one object.
 */
import { atomWithStorage } from 'jotai/utils';

export type BoardView = 'cards' | 'list';
export type ForumRoom = 'general' | 'minters' | 'admins';

export const SETTINGS_KEYS = {
  boardView: 'qmintershipplus-board-view',
  defaultRoom: 'qmintershipplus-forum-room',
  showNewMarkers: 'qmintershipplus-new-markers',
  compactCards: 'qmintershipplus-compact-cards',
} as const;

/** The legacy Minter Board "display mode" select: cards or list. */
export const boardViewAtom = atomWithStorage<BoardView>(SETTINGS_KEYS.boardView, 'cards');

/** The forum room opened first; the legacy app always opened General. */
export const defaultRoomAtom = atomWithStorage<ForumRoom>(SETTINGS_KEYS.defaultRoom, 'general');

/** The red NEW marker on forum messages newer than the last visit. */
export const showNewMarkersAtom = atomWithStorage<boolean>(SETTINGS_KEYS.showNewMarkers, true);

/** Tighter card spacing on the boards. */
export const compactCardsAtom = atomWithStorage<boolean>(SETTINGS_KEYS.compactCards, false);
