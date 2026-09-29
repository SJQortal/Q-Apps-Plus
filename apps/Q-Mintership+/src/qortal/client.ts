/**
 * The two ways a Q-App reaches Qortal: `qortalRequest` (Hub's bridge, needed
 * for anything that signs, publishes or reads the user's account) and
 * relative `fetch('/…')` to Core's REST API for public reads.
 */

type HostRequest = (request: Record<string, unknown>) => Promise<unknown>;

export class QortalUnavailableError extends Error {
  constructor() {
    super('qortalRequest is not available. Open this app in Qortal Hub or GO.');
    this.name = 'QortalUnavailableError';
  }
}

export class CoreHttpError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(path: string, status: number, body: string) {
    super(`Core ${status} for ${path}${body ? `: ${body}` : ''}`);
    this.name = 'CoreHttpError';
    this.status = status;
    this.body = body;
  }
}

/** The host's qortalRequest, or null outside Hub and GO. */
export function hostQortalRequest(): HostRequest | null {
  if (typeof qortalRequest === 'function') return qortalRequest as HostRequest;
  const fromGlobal = (globalThis as { qortalRequest?: unknown }).qortalRequest;
  return typeof fromGlobal === 'function' ? (fromGlobal as HostRequest) : null;
}

export function hasQortalRequest(): boolean {
  return hostQortalRequest() !== null;
}

/** Typed `qortalRequest`. Throws QortalUnavailableError outside Hub. */
export async function qortal<T = unknown>(
  request: { action: string } & Record<string, unknown>
): Promise<T> {
  const host = hostQortalRequest();
  if (!host) throw new QortalUnavailableError();
  return (await host(request)) as T;
}

/**
 * Where Core's REST API is. Inside Hub and GO the app is served by the node,
 * so relative paths work. Outside (plain `npm run dev`) the legacy app talked
 * to a local node on 12391; VITE_CORE_URL overrides that.
 */
export function coreBaseUrl(): string {
  if (hasQortalRequest()) return '';
  const fromEnv = import.meta.env?.VITE_CORE_URL as string | undefined;
  return fromEnv ?? 'http://localhost:12391';
}

export function coreUrl(path: string): string {
  return `${coreBaseUrl()}${path}`;
}

export async function coreGet(path: string, accept = 'application/json'): Promise<Response> {
  return fetch(coreUrl(path), { method: 'GET', headers: { Accept: accept } });
}

/** GET a JSON endpoint; throws CoreHttpError on a non-2xx status. */
export async function coreJson<T>(path: string): Promise<T> {
  const response = await coreGet(path, 'application/json');
  if (!response.ok) throw new CoreHttpError(path, response.status, await safeText(response));
  return (await response.json()) as T;
}

/** GET a text endpoint; throws CoreHttpError on a non-2xx status. */
export async function coreText(path: string): Promise<string> {
  const response = await coreGet(path, 'text/plain');
  if (!response.ok) throw new CoreHttpError(path, response.status, await safeText(response));
  return response.text();
}

/** POST a JSON body to a transaction builder; Core answers with the raw unsigned tx as text. */
export async function corePostJsonForText(path: string, payload: unknown): Promise<string> {
  const response = await fetch(coreUrl(path), {
    method: 'POST',
    headers: { Accept: 'text/plain', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await safeText(response);
    throw new Error(`Failed to create transaction: ${response.status}, ${body}`);
  }
  return response.text();
}

export async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
