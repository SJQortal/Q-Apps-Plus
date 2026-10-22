/**
 * Form parts shared with other screens (the cart, reviews, orders), from the
 * original's Create shop dialog. Colours come from the theme, so they work in
 * all four themes; the shop dialogs themselves no longer use these.
 */
import { styled } from "@mui/material/styles";
import { Box, Button, TextField, Theme, Typography } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { TimesSVG } from "../../assets/svgs/TimesSVG";
import { NumericTextFieldQshop } from "../common/NumericTextFieldQshop";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";

export const ModalBody = styled(Box)(({ theme }) => ({
  position: "absolute",
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "75%",
  padding: "15px 35px",
  display: "flex",
  flexDirection: "column",
  gap: "17px",
  overflowY: "auto",
  maxHeight: "calc(100dvh - 32px)",
  boxShadow: theme.shadows[8],
  [`@media ${PHONE_MEDIA}`]: {
    width: "calc(100% - 24px)",
    padding: "12px 16px",
  },
}));

export const ModalTitle = styled(Typography)(() => ({
  fontWeight: 400,
  fontSize: "25px",
  userSelect: "none",
}));

export const StoreLogoPreview = styled("img")(({ theme }) => ({
  width: "100px",
  height: "100px",
  objectFit: "contain",
  userSelect: "none",
  borderRadius: theme.shape.borderRadius,
  marginBottom: "10px",
}));

export const AddLogoButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  fontSize: "17px",
  padding: "5px 10px",
  minHeight: 44,
  borderRadius: theme.shape.borderRadius,
  gap: "5px",
  border: "none",
  transition: "background-color 150ms ease, box-shadow 150ms ease",
  boxShadow: theme.shadows[2],
  marginBottom: "5px",
  "&:hover": {
    cursor: "pointer",
    boxShadow: theme.shadows[4],
    backgroundColor: theme.palette.secondary.dark,
  },
}));

export const LogoPreviewRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

export const AddLogoIcon = styled(AddPhotoAlternateIcon)(() => ({
  color: "inherit",
  height: "25px",
  width: "auto",
}));

export const TimesIcon = styled(TimesSVG)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: "50%",
  padding: "5px",
  transition: "transform 150ms ease",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)",
  },
}));

const customInputStyle = (theme: Theme) => {
  return {
    fontSize: "18px",
    fontWeight: 300,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.default,
    borderColor: theme.palette.background.paper,
    "& label": {
      color: theme.palette.text.secondary,
      fontSize: "18px",
      letterSpacing: "0px",
    },
    "& label.Mui-focused": {
      color: theme.palette.primary.main,
    },
    "& .MuiInput-underline:after": {
      borderBottomColor: theme.palette.primary.main,
    },
    "& .MuiOutlinedInput-root": {
      "& fieldset": {
        borderColor: theme.palette.divider,
      },
      "&:hover fieldset": {
        borderColor: theme.palette.text.secondary,
      },
      "&.Mui-focused fieldset": {
        borderColor: theme.palette.primary.main,
      },
    },
    "& .MuiInputBase-root": {
      fontSize: "18px",
      letterSpacing: "0px",
    },
    "& .MuiFilledInput-root:after": {
      borderBottomColor: theme.palette.secondary.main,
    },
  };
};

export const CustomInputField = styled(TextField)(({ theme }) => customInputStyle(theme as Theme));

export const CustomNumberField = styled(NumericTextFieldQshop)(({ theme }) => customInputStyle(theme as Theme));

export const ButtonRow = styled(Box)(() => ({
  display: "flex",
  gap: "10px",
  justifyContent: "flex-end",
  flexWrap: "wrap",
}));

export const CancelButton = styled(Button)(() => ({
  fontSize: "15px",
  minHeight: 44,
}));

export const CreateButton = styled(Button)(({ theme }) => ({
  fontSize: "15px",
  minHeight: 44,
  backgroundColor: theme.palette.success.main,
  color: theme.palette.success.contrastText,
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.success.dark,
  },
}));
