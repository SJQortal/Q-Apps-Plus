/**
 * `const { dialog, showModal } = useConfirmationModal({ title, message })`:
 * render `dialog` once, and `await showModal()` resolves true on confirm and
 * false on cancel. `showModal({ message })` changes the words for one ask,
 * e.g. to name the item.
 */
import { useCallback, useRef, useState } from "react";
import ConfirmationModal from "../components/common/ConfirmationModal/ConfirmationModal";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

const useConfirmationModal = (defaults: ConfirmOptions) => {
  const [asking, setAsking] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const showModal = useCallback(
    (override: Partial<ConfirmOptions> = {}) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setAsking({ ...defaults, ...override });
      }),
    [defaults]
  );

  const settle = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setAsking(null);
  };

  const dialog = (
    <ConfirmationModal
      open={asking !== null}
      title={asking?.title ?? defaults.title}
      message={asking?.message ?? defaults.message}
      confirmLabel={asking?.confirmLabel ?? defaults.confirmLabel}
      destructive={asking?.destructive ?? defaults.destructive}
      handleConfirm={() => settle(true)}
      handleCancel={() => settle(false)}
    />
  );

  return { dialog, showModal };
};

export default useConfirmationModal;
