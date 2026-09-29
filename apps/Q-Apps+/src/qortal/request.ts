import type { QortalRequestFn, QortalRequestParams } from './global';

export class NoQortalError extends Error {
  constructor() {
    super('qortalRequest is not available outside Qortal Hub or GO');
    this.name = 'NoQortalError';
  }
}

/** The host's qortalRequest, or null outside Hub/GO (plain `npm run dev`). */
export function getQortalRequest(): QortalRequestFn | null {
  const fn =
    typeof qortalRequest === 'function'
      ? qortalRequest
      : (globalThis as { qortalRequest?: QortalRequestFn }).qortalRequest;
  return typeof fn === 'function' ? fn : null;
}

export function hasQortalRequest(): boolean {
  return getQortalRequest() !== null;
}

/** Call the host, or reject with NoQortalError when there is no host. */
export function qortalCall<T = unknown>(params: QortalRequestParams): Promise<T> {
  const fn = getQortalRequest();
  if (!fn) return Promise.reject(new NoQortalError());
  return fn(params) as Promise<T>;
}

/** Plain-words message for an error, never "[object Object]". */
export function describeError(error: unknown): string {
  if (error instanceof NoQortalError) return 'Live app details need Qortal Hub or GO.';
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; error?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error === 'string' && e.error) return e.error;
  }
  return 'Something went wrong.';
}
