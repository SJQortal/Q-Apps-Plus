/**
 * Notification settings kept in this browser (the Hub alerts themselves are
 * kept by Hub, per account: qortal/hubAlerts.ts).
 */
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_PREFIX } from '../constants/plus';

export const SINCE_LAST_VISIT_KEY = `${STORAGE_PREFIX}since-last-visit`;

/** Home's "Since your last visit" panel (on by default). */
export const sinceLastVisitAtom = atomWithStorage<boolean>(SINCE_LAST_VISIT_KEY, true);
