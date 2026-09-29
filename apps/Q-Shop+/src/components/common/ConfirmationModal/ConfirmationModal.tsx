import React from "react";
import { Dialog, DialogActions, DialogContent, Button } from "@mui/material";
import {
  DialogContentTextStyled,
  DialogTitleStyled
} from "./ConfirmationModal-styles";
import {
  CancelButton,
  CreateButton
} from "../../modals/CreateStoreModal-styles";

export interface ModalProps {
  open: boolean;
  title: string;
  message: string;
  handleConfirm: () => void;
  handleCancel: () => void;
}

const ConfirmationModal: React.FC<ModalProps> = ({
  open,
  title,
  message,
  handleConfirm,
  handleCancel
}) => {
  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitleStyled id="alert-dialog-title">{title}</DialogTitleStyled>
      <DialogContent>
        <DialogContentTextStyled id="alert-dialog-description">
          {message}
        </DialogContentTextStyled>
      </DialogContent>
      <DialogActions>
        <CancelButton variant="outlined" onClick={handleCancel} color="error">
          Cancel
        </CancelButton>
        <CreateButton onClick={handleConfirm}>Proceed</CreateButton>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
