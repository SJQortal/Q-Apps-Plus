/**
 * The original's general-purpose modal, kept for the screens that still use
 * it: a centred panel on wider screens (sized by the caller's
 * `customStyles`), full-screen on phones with a Back button at the top, so
 * every one of them can be closed without Escape or a backdrop to tap.
 * New screens use components/common/mobile/ResponsiveDialog instead.
 */
import React from "react";
import { Box, IconButton, Modal } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { headerFill } from "../../hub-theme";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { PHONE_FULL_SCREEN, ReusableModalBody } from "./ReusableModal-styles";

interface MyModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** Styles for wider screens (an sx object), as the original took them. */
  customStyles?: any;
  id?: string;
  className?: string;
  /** The dialog's accessible name, when it has no heading to point at. */
  ariaLabel?: string;
  /** The id of the heading that names the dialog. */
  ariaLabelledBy?: string;
}

export const ReusableModal: React.FC<MyModalProps> = ({
  id,
  open,
  onClose,
  children,
  customStyles = {},
  className,
  ariaLabel,
  ariaLabelledBy,
}) => {
  const phone = usePhoneLayout();
  return (
    <Modal open={open} onClose={onClose}>
      <ReusableModalBody
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        sx={[customStyles, PHONE_FULL_SCREEN]}
        className={className}
      >
        {phone && onClose && (
          <Box
            sx={(theme) => ({
              position: "sticky",
              top: 0,
              zIndex: 1,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              mx: -2,
              px: 0.5,
              pt: "calc(4px + env(safe-area-inset-top, 0px))",
              pb: 0.5,
              borderBottom: 1,
              borderColor: "divider",
              backgroundColor: headerFill(theme, "chromeStrong"),
              backdropFilter: "blur(20px)",
            })}
          >
            <IconButton aria-label="Back" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
              <ArrowBackIcon />
            </IconButton>
          </Box>
        )}
        {children}
      </ReusableModalBody>
    </Modal>
  );
};
