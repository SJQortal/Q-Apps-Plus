import { useState } from "react";
import ConfirmationModal, {
  ModalProps
} from "../components/common/ConfirmationModal/ConfirmationModal";

const useConfirmationModal = (props: any) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [resolvePromise, setResolvePromise] =
    useState<(value: boolean) => void>();

  const showModal = async () => {
    setIsModalOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve);
    });
  };

  const handleUserAction = (userConfirmed: boolean) => {
    setIsModalOpen(false);
    resolvePromise?.(userConfirmed);
  };

  const Modal = () => (
    <ConfirmationModal
      open={isModalOpen}
      title={props.title}
      message={props.message}
      handleConfirm={() => handleUserAction(true)}
      handleCancel={() => handleUserAction(false)}
    />
  );

  return { Modal, showModal };
};

export default useConfirmationModal;
