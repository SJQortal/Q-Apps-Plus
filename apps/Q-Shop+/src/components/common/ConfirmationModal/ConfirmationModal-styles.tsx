import { styled } from "@mui/system";
import { DialogTitle, DialogContentText } from "@mui/material";

export const DialogTitleStyled = styled(DialogTitle)(({ theme }) => ({
  fontSize: "18px",
  color: theme.palette.text.primary,
  userSelect: "none"
}));

export const DialogContentTextStyled = styled(DialogContentText)(
  ({ theme }) => ({
    fontSize: "16px",
    color: theme.palette.text.primary,
    userSelect: "none"
  })
);
