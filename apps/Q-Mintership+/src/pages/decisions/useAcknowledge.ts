/**
 * "I've checked these": a box a write dialog needs ticked before Hub opens.
 * It starts unticked for every new `key` (a new decision, a new proposal, a
 * reopened dialog). `confirm()` is what the dialog's Continue calls: true
 * when ticked; otherwise it shows why and moves focus to the box.
 */
import { useRef, useState, type RefObject } from 'react';

export interface Acknowledge {
  checked: boolean;
  /** Continue was pressed while unticked. */
  error: boolean;
  setChecked: (checked: boolean) => void;
  confirm: () => boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function useAcknowledge(key: string | null): Acknowledge {
  const [state, setState] = useState({ key, checked: false, error: false });
  const inputRef = useRef<HTMLInputElement | null>(null);
  let current = state;
  // React's adjust-while-rendering pattern: a new key starts unticked.
  if (state.key !== key) {
    current = { key, checked: false, error: false };
    setState(current);
  }
  return {
    checked: current.checked,
    error: current.error,
    setChecked: (checked) => setState((s) => ({ ...s, checked, error: false })),
    confirm: () => {
      if (current.checked) return true;
      setState((s) => ({ ...s, error: true }));
      inputRef.current?.focus();
      return false;
    },
    inputRef,
  };
}
