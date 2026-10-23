/**
 * The read store's key for the Minter Admin polls a viewer read
 * (data/adminPolls.ts loadAdminPolls), apart so Home can check whether they
 * were read this session without loading any of the polls' code; and the
 * Retry that Decisions' Refresh button gives, for the same reason.
 */
export function adminPollsKey(viewer: string): string {
  return `adminpolls:list:${viewer}`;
}

/** History's read: the `count` polls that ended most recently. */
export function closedPollsKey(viewer: string, count: number): string {
  return `adminpolls:closed:${viewer}:${count}`;
}

/** One poll's own page, when the poll is no longer listed on Decisions. */
export function onePollKey(viewer: string, id: string): string {
  return `adminpolls:poll:${viewer}:${id}`;
}

let retries = 0;

/**
 * Retry or Refresh: bodies Hub didn't decrypt are asked for again at once on
 * the next read, not after their wait (data/adminPolls.ts readPollBody).
 */
export function retryPollDecrypts(): void {
  retries += 1;
}

/** How many times that was asked this session. */
export function pollDecryptRetries(): number {
  return retries;
}
