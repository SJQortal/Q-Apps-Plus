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
import { canServeWithoutLoad, fetchQuery, type FetchOptions } from '../query';

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

/** Loads heavyQuery started, per key. */
const loadsStarted = new Map<string, number>();

/**
 * fetchQuery for a heavy read. A value that is fresh, or a load fetchQuery
 * would share, is read from the store at once; anything that would start a
 * load waits for a slot first, a reload after invalidate() too (fetchQuery
 * doesn't share a load that started before it), so a dropped read never
 * touches the store (the view shows it loading again when it comes back,
 * instead of an error). A load of the same key that started while a read
 * waited answers that read as well, unless the key was invalidated since.
 */
export async function heavyQuery<T>(
  scope: string,
  key: string,
  load: () => Promise<T>,
  options: FetchOptions = {}
): Promise<T> {
  if (canServeWithoutLoad(key, options)) return fetchQuery(key, load, options);
  const asked = loadsStarted.get(key) ?? 0;
  return heavy(scope, () => {
    const started = loadsStarted.get(key) ?? 0;
    const readOptions = started > asked ? { ...options, force: false } : options;
    if (!canServeWithoutLoad(key, readOptions)) loadsStarted.set(key, started + 1);
    return fetchQuery(key, load, readOptions);
  });
}

/** For tests: how many heavy reads run and wait now. */
export function heavyLoad(): { running: number; queued: number } {
  return { running, queued: queue.length };
}
