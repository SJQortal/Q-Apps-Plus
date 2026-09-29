import { atomWithReset } from 'jotai/utils';



export const selectedFeePublisherAtom = atomWithReset('JSON.Bridge');

export const isEnabledCustomLockingFeeAtom = atomWithReset(false);

export const stuckTradesAtom = atomWithReset([]);
