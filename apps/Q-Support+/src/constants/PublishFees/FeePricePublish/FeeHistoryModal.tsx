import { Button, Modal, useTheme } from "@mui/material";
import { ThemeButton } from "../../../pages/Home/Home-styles.tsx";
import { appName } from "../FeeData.tsx";
import { ModalBody } from "./FeePricePublish-styles.tsx";
import { useEffect, useState } from "react";
import { userHasName } from "../VerifyPayment-Functions.ts";
import { FeeHistoryModalBody } from "./FeeHistoryModalBody.tsx";

export const FeeHistoryModal = () => {
  const [open, setOpen] = useState<boolean>(false);

  const theme = useTheme();

  const buttonSX = {
    fontSize: "20px",
    color: theme.palette.secondary.main,
    fontWeight: "bold",
  };

  if (theme.palette.mode === "light")
    buttonSX["&:hover"] = { backgroundColor: theme.palette.primary.dark };

  return (
    <>
      <ThemeButton
        sx={{ height: "40px", marginRight: "5px" }}
        onClick={() => setOpen(true)}
      >
        {appName} Fees
      </ThemeButton>
      <Modal
        open={open}
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onClose={() => setOpen(false)}
      >
        <ModalBody sx={{ width: "75vw", maxWidth: "75vw" }}>
          <FeeHistoryModalBody />
          <Button sx={buttonSX} onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalBody>
      </Modal>
    </>
  );
};
