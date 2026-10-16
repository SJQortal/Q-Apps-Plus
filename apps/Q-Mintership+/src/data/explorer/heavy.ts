/**
 * The Explorer's heavy reads: Core answers a transaction search by address
 * with a GROUP BY over every row the account ever took part in, so a busy
 * account costs about half a second per search whatever the page size, and
 * the node runs such searches one after another anyway. At most two run at
 * once; the newest view's go first; and a view that closes drops the ones it
 * queued and hasn't started (a search already running is left to finish:
 * Core does the work either way, and Back can use the result).
 *
 * Light reads (an account, its names, groups, one transaction, payments
 * between two accounts, a QDN search with a service) don't come through here.
 */
import { fetchQuery, getQueryState, type FetchOptions } from '../query';

const LIMIT = 2;

interface Job {
  scope: string;
  seq: number;
  start: () => void;
  cancel: () => void;
}

let running = 0;
let seq = 0;
const queue: Job[] = [];

/** Thrown to a caller whose queued read was dropped (its view closed). */
export class HeavyCancelled extends Error {
  constructor() {
    super('The view that asked for this read was closed.');
    this.name = 'HeavyCancelled';
  }
}

function next(): void {
  while (running < LIMIT && queue.length) {
    // Newest first: the view the user is looking at now.
    let pick = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].seq > queue[pick].seq) pick = i;
    const [job] = queue.splice(pick, 1);
    running += 1;
    job.start();
  }
}

/** Run `work` once a slot is free. `scope` is what dropHeavy() drops (an account's address). */
export function heavy<T>(scope: string, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      scope,
      seq: ++seq,
      start: () => {
        work()
          .then(resolve, reject)
          .finally(() => {
            running -= 1;
            next();
          });
      },
      cancel: () => reject(new HeavyCancelled()),
    });
    next();
  });
}

/** Drop every queued (not yet started) read of `scope`. */
export function dropHeavy(scope: string): void {
  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i].scope === scope) {
      const [job] = queue.splice(i, 1);
      job.cancel();
    }
  }
}

/**
 * fetchQuery for a heavy read. A value that is fresh or already loading is
 * read from the store at once; otherwise the read waits for a slot first, so
 * a dropped read never touches the store (the view shows it loading again
 * when it comes back, instead of an error).
 */
export async function heavyQuery<T>(
  scope: string,
  key: string,
  load: () => Promise<T>,
  options: FetchOptions = {}
): Promise<T> {
  const state = getQueryState<T>(key);
  const ttlMs = options.ttlMs ?? 60_000;
  const fresh = state.status === 'success' && Date.now() - state.updatedAt < ttlMs;
  if (state.fetching || (fresh && !options.force)) return fetchQuery(key, load, options);
  return heavy(scope, () => fetchQuery(key, load, options));
}

/** For tests: how many heavy reads run and wait now. */
export function heavyLoad(): { running: number; queued: number } {
  return { running, queued: queue.length };
}
