/**
 * Desktop keyboard shortcuts (N6). Pure key resolution (`resolveShortcut`)
 * plus a hook that listens on window. Shortcuts are ignored while a text
 * field, the editor or a dialog has focus, when a modifier is held, and
 * below the desktop layout (the caller passes `enabled`).
 */
import { useEffect, useRef } from 'react';

export type ShortcutAction =
  | 'compose'
  | 'reply'
  | 'replyAll'
  | 'forward'
  | 'archive'
  | 'markUnread'
  | 'next'
  | 'previous'
  | 'open'
  | 'close'
  | 'focusSearch'
  | 'goInbox'
  | 'goSent'
  | 'goThreads'
  | 'goAliases'
  | 'showHelp';

/**
 * A handler returns false when it did nothing (for example "open" while a
 * message is already open); the key is then left to the browser.
 */
export type ShortcutHandlers = Partial<Record<ShortcutAction, () => boolean | void>>;

/** For the help dialog: keys as shown, and what they do. */
export const SHORTCUT_HELP: ReadonlyArray<{ keys: string[]; label: string; action: ShortcutAction }> = [
  { keys: ['c'], label: 'Compose a message', action: 'compose' },
  { keys: ['r'], label: 'Reply', action: 'reply' },
  { keys: ['a'], label: 'Reply all', action: 'replyAll' },
  { keys: ['f'], label: 'Forward', action: 'forward' },
  { keys: ['e'], label: 'Archive the open message', action: 'archive' },
  { keys: ['u'], label: 'Mark the open message unread', action: 'markUnread' },
  { keys: ['j'], label: 'Next message', action: 'next' },
  { keys: ['k'], label: 'Previous message', action: 'previous' },
  { keys: ['Enter', 'o'], label: 'Open the first message', action: 'open' },
  { keys: ['Esc'], label: 'Close the message or composer', action: 'close' },
  { keys: ['/'], label: 'Search', action: 'focusSearch' },
  { keys: ['g', 'i'], label: 'Go to Inbox', action: 'goInbox' },
  { keys: ['g', 's'], label: 'Go to Sent', action: 'goSent' },
  { keys: ['g', 't'], label: 'Go to Threads', action: 'goThreads' },
  { keys: ['g', 'a'], label: 'Go to Aliases', action: 'goAliases' },
  { keys: ['?'], label: 'Show this list', action: 'showHelp' },
];

const SINGLE_KEYS: Record<string, ShortcutAction> = {
  c: 'compose',
  r: 'reply',
  a: 'replyAll',
  f: 'forward',
  e: 'archive',
  u: 'markUnread',
  j: 'next',
  k: 'previous',
  o: 'open',
  Enter: 'open',
  Escape: 'close',
  '/': 'focusSearch',
  '?': 'showHelp',
};

const GO_KEYS: Record<string, ShortcutAction> = {
  i: 'goInbox',
  s: 'goSent',
  t: 'goThreads',
  a: 'goAliases',
};

/** How long the second key of a "g" sequence may take. */
export const SEQUENCE_TIMEOUT_MS = 1000;

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface ShortcutResolution {
  action: ShortcutAction | null;
  /** The pending prefix after this key ('g' while waiting for i/s/t/a). */
  pending: string | null;
}

/**
 * Maps a key press, given the pending prefix, to an action. `?` needs Shift
 * on most layouts, so Shift is allowed only for `?`; any other modifier
 * disables the shortcut so browser and Hub shortcuts keep working.
 */
export function resolveShortcut(event: ShortcutKeyEvent, pending: string | null): ShortcutResolution {
  if (event.ctrlKey || event.metaKey || event.altKey) return { action: null, pending: null };
  if (event.shiftKey && event.key !== '?') return { action: null, pending: null };
  const key = event.key;
  if (pending === 'g') {
    const action = GO_KEYS[key] ?? null;
    return { action, pending: null };
  }
  if (key === 'g') return { action: null, pending: 'g' };
  return { action: SINGLE_KEYS[key] ?? null, pending: null };
}

/** True when the key press should type, not trigger a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const element = target as HTMLElement;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (element.isContentEditable) return true;
  return Boolean(element.closest('[contenteditable=""], [contenteditable="true"], .ql-editor, [role="textbox"]'));
}

const ACTIVATABLE_SELECTOR =
  'button, a[href], summary, label, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="combobox"]';

/**
 * True when the key would activate the focused control (Enter or Space on a
 * button, link, tab...). Those keys must reach the browser, or the control's
 * own click never fires. Letter shortcuts still work on these controls.
 */
export function isActivationKeyOnControl(key: string, target: EventTarget | null): boolean {
  if (key !== 'Enter' && key !== ' ') return false;
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return Boolean((target as Element).closest(ACTIVATABLE_SELECTOR));
}

/** True while a dialog, drawer, menu or the first-run tip is open (shortcuts would act behind it). */
export function isOverlayOpen(doc: Document = document): boolean {
  return Boolean(
    doc.querySelector('[role="dialog"], [role="menu"], .MuiDrawer-root.MuiModal-root, [data-qmail-tour-step]')
  );
}

interface Options {
  enabled: boolean;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, { enabled }: Options): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const pendingRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const clearPending = () => {
      pendingRef.current = null;
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (isActivationKeyOnControl(event.key, event.target)) return;
      const helpOpen = Boolean(document.querySelector('[data-qmail-shortcuts-help]'));
      // Inside the help dialog only Escape (handled by the dialog) and ? matter.
      if (isOverlayOpen() && !(helpOpen && event.key === '?')) {
        clearPending();
        return;
      }
      const { action, pending } = resolveShortcut(event, pendingRef.current);
      clearPending();
      if (pending) {
        pendingRef.current = pending;
        pendingTimerRef.current = window.setTimeout(clearPending, SEQUENCE_TIMEOUT_MS);
        return;
      }
      if (!action) return;
      const handler = handlersRef.current[action];
      if (!handler) return;
      if (handler() !== false) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearPending();
    };
  }, [enabled]);
}
