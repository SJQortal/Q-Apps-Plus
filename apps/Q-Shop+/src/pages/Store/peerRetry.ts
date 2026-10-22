/**
 * Resources the node hasn't downloaded yet fail at first and arrive a few
 * seconds later. Pages say "Fetching from peers…" and try again after 2, 4
 * and 8 seconds, then show "Not available on your node right now" with a
 * Retry button, never a skeleton that never ends (docs/QORTAL.md → pitfall 14).
 */

const DEFAULT_DELAYS_MS = [2_000, 4_000, 8_000];
let delaysMs = DEFAULT_DELAYS_MS;

/** The waits between attempts. */
export function peerRetryDelays(): number[] {
  return delaysMs;
}

/** For tests: shorter waits. Returns a function that restores the defaults. */
export function setPeerRetryDelaysForTests(delays: number[]): () => void {
  delaysMs = delays;
  return () => {
    delaysMs = DEFAULT_DELAYS_MS;
  };
}

export class RetryCancelled extends Error {
  constructor() {
    super("Cancelled");
    this.name = "RetryCancelled";
  }
}

/**
 * Runs `task`, and on failure runs it again after each delay. `onRetry` is
 * called before each wait (to show "Fetching from peers…"); `shouldRetry`
 * can stop early (e.g. the resource doesn't exist at all). Stops quietly
 * with RetryCancelled once `isAlive` says the screen has gone.
 */
export async function withPeerRetries<T>(
  task: (attempt: number) => Promise<T>,
  options: {
    isAlive?: () => boolean;
    onRetry?: (attempt: number) => void;
    shouldRetry?: (error: unknown, attempt: number) => boolean | Promise<boolean>;
  } = {}
): Promise<T> {
  const delays = peerRetryDelays();
  for (let attempt = 0; ; attempt++) {
    if (options.isAlive && !options.isAlive()) throw new RetryCancelled();
    try {
      return await task(attempt);
    } catch (error) {
      if (error instanceof RetryCancelled) throw error;
      if (attempt >= delays.length) throw error;
      if (options.shouldRetry && !(await options.shouldRetry(error, attempt))) throw error;
      if (options.isAlive && !options.isAlive()) throw new RetryCancelled();
      options.onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}
