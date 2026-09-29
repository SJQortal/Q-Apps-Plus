/**
 * A qortalRequest stand-in for tests. Register a handler per action with
 * `onQortalAction`, then assert with `qortalCalls('SEARCH_QDN_RESOURCES')`.
 * Unhandled actions resolve to `[]`, and write actions (publish, send,
 * sign) are refused so a test can never spend QORT or publish by mistake.
 */
import { vi } from 'vitest';

type Handler = (options: QortalRequestOptions) => unknown;

const WRITE_ACTIONS = new Set([
  'PUBLISH_QDN_RESOURCE',
  'PUBLISH_MULTIPLE_QDN_RESOURCES',
  'SEND_COIN',
  'SIGN_TRANSACTION',
  'DEPLOY_AT',
  'SEND_CHAT_MESSAGE',
]);

let handlers: Record<string, Handler> = {};
let calls: QortalRequestOptions[] = [];

export const qortalRequestMock = vi.fn(async (options: QortalRequestOptions) => {
  calls.push(options);
  const handler = handlers[options.action];
  if (handler) return handler(options);
  if (WRITE_ACTIONS.has(options.action)) {
    throw new Error(`Refusing write action ${options.action} in tests; register a handler explicitly`);
  }
  return [];
});

export function onQortalAction(action: string, handler: Handler) {
  handlers[action] = handler;
}

export function qortalCalls(action?: string): QortalRequestOptions[] {
  return action ? calls.filter((c) => c.action === action) : calls.slice();
}

export function resetQortalRequestMock() {
  handlers = {};
  calls = [];
  qortalRequestMock.mockClear();
}
