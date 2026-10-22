/**
 * A global `qortalRequest` mock for tests. Answers by `action`, and records
 * every call so tests can assert what the app asked Hub for and how often.
 *
 *   const q = installQortalMock({ GET_USER_ACCOUNT: async () => ({ address: 'Q…', publicKey: 'pk' }) });
 *   …
 *   expect(q.callsFor('SEARCH_QDN_RESOURCES')).toHaveLength(1);
 *
 * Write actions (PUBLISH_*, SEND_COIN, ENCRYPT_DATA, DECRYPT_DATA, SIGN_*)
 * reject unless a test provides a handler, so nothing can reach a real node.
 */
import { vi } from 'vitest';

export type QortalRequestParams = { action: string } & Record<string, unknown>;
export type QortalHandler = (params: QortalRequestParams) => unknown | Promise<unknown>;

const WRITE_ACTIONS = new Set([
  'PUBLISH_QDN_RESOURCE',
  'PUBLISH_MULTIPLE_QDN_RESOURCES',
  'SEND_COIN',
  'SEND_CHAT_MESSAGE',
  'ENCRYPT_DATA',
  'DECRYPT_DATA',
  'SIGN_TRANSACTION',
  'CREATE_POLL',
  'VOTE_ON_POLL',
  'DELETE_LIST_ITEM',
  'ADD_LIST_ITEMS',
]);

export interface QortalMock {
  calls: QortalRequestParams[];
  callsFor: (action: string) => QortalRequestParams[];
  on: (action: string, handler: QortalHandler) => void;
  reset: () => void;
}

export function installQortalMock(handlers: Record<string, QortalHandler> = {}): QortalMock {
  const table = new Map<string, QortalHandler>(Object.entries(handlers));
  const calls: QortalRequestParams[] = [];

  const request = vi.fn(async (params: QortalRequestParams) => {
    calls.push(params);
    const handler = table.get(params.action);
    if (handler) return handler(params);
    if (WRITE_ACTIONS.has(params.action)) {
      throw new Error(`qortalRequest mock: write action ${params.action} has no test handler`);
    }
    return null;
  });

  const g = globalThis as unknown as Record<string, unknown>;
  g.qortalRequest = request;
  g.qortalRequestWithTimeout = (params: QortalRequestParams) => request(params);

  return {
    calls,
    callsFor: (action) => calls.filter((c) => c.action === action),
    on: (action, handler) => {
      table.set(action, handler);
    },
    reset: () => {
      calls.length = 0;
      request.mockClear();
    },
  };
}
