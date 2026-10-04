/**
 * Opening a message from any list (inbox, archived, sent, alias and
 * secondary-name inboxes, "All mail" results).
 *
 * A decrypted copy opens at once. Anything else goes through the reading
 * pane's opener (<OpenMail>): it waits for the resource, decrypts it and
 * resolves the `show()` promise of Mail's modal hook.
 *
 * The opener must take the reading pane even when another message is shown:
 * the old message is dropped when the open starts, the list highlights the
 * row being opened (a small "pending" selection), and `readingViewFor`
 * gives the opener priority. Before this, a shown message kept the pane, the
 * opener never mounted, nothing was fetched and the click did nothing.
 *
 * Each open bumps `requestRef` (through `cancelPending`), so an open that is
 * superseded or closed may not open or clear anything when it settles.
 */
import { openerInfoFor } from "./openerInfo";

export type ReadingView = "opening" | "message" | null;

/** What the reading pane shows. A message being opened wins over the one shown before. */
export function readingViewFor(state: {
  isOpeningMessage: boolean;
  isReadingOpen: boolean;
}): ReadingView {
  if (state.isOpeningMessage) return "opening";
  if (state.isReadingOpen) return "message";
  return null;
}

/** The selection while a message is still opening: enough for the list highlight and j/k. */
export interface PendingSelection {
  id: string;
  identifier: string;
  user: string;
  pendingOpen: true;
}

export const pendingSelectionFor = (identifier: string, user: string): PendingSelection => ({
  id: identifier,
  identifier,
  user,
  pendingOpen: true,
});

export const isPendingSelection = (value: any): value is PendingSelection =>
  Boolean(value && value.pendingOpen === true);

/** A decrypted message the reader can show. */
export const isOpenableMessage = (value: any): boolean =>
  Boolean(value && value.isValid && !value.unableToDecrypt);

export interface OpenMessageOptions {
  /** Set by callers that switch mailbox in the same click (search hits). */
  autoMarkRead?: boolean;
}

export interface MessageOpenerDeps {
  /** The decrypted copy in the session cache, if any. */
  cached: (identifier: string) => any;
  /** Supersedes any open still waiting on peers (bumps `requestRef`). */
  cancelPending: () => void;
  requestRef: { current: number };
  setMessage: (next: any | ((previous: any) => any)) => void;
  setIsOpen: (open: boolean) => void;
  setMailInfo: (info: any) => void;
  /** Shows the opener; resolves with the decrypted message, or nothing on cancel. */
  show: () => Promise<unknown>;
  markRead: (rows: Array<{ id: string; identifier: string; user: string }>) => void;
  /** Whether an open marks the message read when the caller does not say. */
  autoMarkReadByDefault: boolean;
}

export type OpenMessage = (
  user: string,
  messageIdentifier: string,
  content: any,
  to?: string,
  options?: OpenMessageOptions
) => Promise<void>;

export function createOpenMessage(deps: MessageOpenerDeps): OpenMessage {
  return async (user, messageIdentifier, content, to, options) => {
    deps.cancelPending();
    const request = deps.requestRef.current;
    const shouldAutoMarkAsRead = options?.autoMarkRead ?? deps.autoMarkReadByDefault;
    const markRead = () => {
      if (shouldAutoMarkAsRead) {
        deps.markRead([{ id: messageIdentifier, identifier: messageIdentifier, user }]);
      }
    };
    const existing = deps.cached(messageIdentifier);
    if (isOpenableMessage(existing)) {
      deps.setMessage(existing);
      deps.setIsOpen(true);
      markRead();
      return;
    }
    // The reader leaves the previous message now and the opener takes the pane.
    const pending = pendingSelectionFor(messageIdentifier, user);
    const dropPending = () =>
      deps.setMessage((previous: any) =>
        isPendingSelection(previous) && previous.identifier === messageIdentifier ? null : previous
      );
    deps.setIsOpen(false);
    deps.setMessage(pending);
    deps.setMailInfo(openerInfoFor(messageIdentifier, user, to, content));
    try {
      const res: any = await deps.show();
      if (request !== deps.requestRef.current) return;
      deps.setMailInfo(null);
      if (isOpenableMessage(res)) {
        deps.setMessage(res);
        deps.setIsOpen(true);
        markRead();
        return;
      }
      // Cancelled or not decryptable: nothing stays selected.
      dropPending();
    } catch {
      if (request === deps.requestRef.current) {
        deps.setMailInfo(null);
        dropPending();
      }
    }
  };
}
