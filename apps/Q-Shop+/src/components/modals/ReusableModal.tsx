import React from "react";
import { Box, Modal, useTheme } from "@mui/material";
import { ReusableModalBody } from "./ReusableModal-styles";

interface MyModalProps {
  open: boolean;
  onClose?: () => void;
  // onSubmit?: (obj: any) => Promise<void>;
  children: any;
  customStyles?: any;
  id?: string;
  className?: string;
}

export const ReusableModal: React.FC<MyModalProps> = ({
  id,
  open,
  onClose,
  // onSubmit,
  children,
  customStyles = {},
  className
}) => {
  const theme = useTheme();
  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <ReusableModalBody
        id={id}
        sx={{
          ...customStyles
        }}
        className={className}
      >
        {children}
      </ReusableModalBody>
    </Modal>
  );
};
