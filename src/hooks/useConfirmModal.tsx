import { useCallback, useRef, useState, type ReactNode } from "react";
import ConfirmationModal from "../components/common/ConfirmationModal";

type ConfirmationModalContent = {
  open: boolean;
  title: string;
  message: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type UseConfirmationModalProps = {
  title: string;
  message: string;
  children?: ReactNode;
  /** The verb on the confirming button (defaults to "Confirm"). */
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const useConfirmationModal = (props: UseConfirmationModalProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const resolvePromiseRef = useRef<((value: boolean) => void) | null>(null);
  const modalContentRef = useRef<ConfirmationModalContent>({
    open: false,
    ...props,
  });

  modalContentRef.current = {
    open: isModalOpen,
    ...props,
  };

  const handleUserAction = useCallback((userConfirmed: boolean) => {
    setIsModalOpen(false);
    resolvePromiseRef.current?.(userConfirmed);
    resolvePromiseRef.current = null;
  }, []);

  const showModal = useCallback(async () => {
    setIsModalOpen(true);
    return new Promise<boolean>(resolve => {
      resolvePromiseRef.current = resolve;
    });
  }, []);

  const Modal = useCallback(() => {
    const { open, title, message, children, confirmLabel, cancelLabel, destructive } =
      modalContentRef.current;
    return (
      <ConfirmationModal
        open={open}
        title={title}
        message={message}
        children={children}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        handleConfirm={() => handleUserAction(true)}
        handleCancel={() => handleUserAction(false)}
      />
    );
  }, [handleUserAction]);

  return { Modal, showModal };
};

export default useConfirmationModal;
