import { styled } from "@mui/system";
import { Box, Button, TextField, Theme, Typography } from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { TimesSVG } from "../../assets/svgs/TimesSVG";
import { NumericTextFieldQshop } from "../common/NumericTextFieldQshop";
import { DownloadSVG } from "../../assets/svgs/DownloadSVG";

export const ModalBody = styled(Box)(({ theme }) => ({
  position: "absolute",
  backgroundColor: theme.palette.background.default,
  borderRadius: "4px",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "75%",
  padding: "15px 35px",
  display: "flex",
  flexDirection: "column",
  gap: "17px",
  overflowY: "auto",
  maxHeight: "95vh",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
      : "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "&::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.background.paper,
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: theme.palette.background.paper,
  },
  "&::-webkit-scrollbar": {
    width: "16px",
    height: "10px",
    backgroundColor: theme.palette.mode === "light" ? "#f6f8fa" : "#292d3e",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#575757",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#474646",
  },
}));

export const ModalTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 400,
  fontFamily: "Raleway",
  fontSize: "25px",
  userSelect: "none",
}));

export const StoreLogoPreview = styled("img")(({ theme }) => ({
  width: "100px",
  height: "100px",
  objectFit: "contain",
  userSelect: "none",
  borderRadius: "3px",
  marginBottom: "10px",
}));

export const AddLogoButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.secondary.main,
  color: "#fff",
  fontFamily: "Raleway",
  fontSize: "17px",
  padding: "5px 10px",
  borderRadius: "5px",
  gap: "5px",
  border: "none",
  transition: "all 0.3s ease-in-out",
  boxShadow:
    theme.palette.mode === "dark"
      ? "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
      : "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  marginBottom: "5px",
  "&:hover": {
    cursor: "pointer",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
    backgroundColor: theme.palette.secondary.dark,
  },
}));

export const LogoPreviewRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

export const AddLogoIcon = styled(AddPhotoAlternateIcon)(({ theme }) => ({
  color: "#fff",
  height: "25px",
  width: "auto",
}));

export const TimesIcon = styled(TimesSVG)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: "50%",
  padding: "5px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    scale: "1.1",
  },
}));

const customInputStyle = (theme: Theme) => {
  return {
    fontFamily: "Karla",
    fontSize: "18px",
    fontWeight: 300,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.default,
    borderColor: theme.palette.background.paper,
    "& label": {
      color: theme.palette.mode === "light" ? "#808183" : "#edeef0",
      fontFamily: "Karla",
      fontSize: "18px",
      letterSpacing: "0px",
    },
    "& label.Mui-focused": {
      color: theme.palette.mode === "light" ? "#A0AAB4" : "#d7d8da",
    },
    "& .MuiInput-underline:after": {
      borderBottomColor: theme.palette.mode === "light" ? "#B2BAC2" : "#c9cccf",
    },
    "& .MuiOutlinedInput-root": {
      "& fieldset": {
        borderColor: "#E0E3E7",
      },
      "&:hover fieldset": {
        borderColor: "#B2BAC2",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#6F7E8C",
      },
    },
    "& .MuiInputBase-root": {
      fontFamily: "Karla",
      fontSize: "18px",
      letterSpacing: "0px",
    },
    "& .MuiFilledInput-root:after": {
      borderBottomColor: theme.palette.secondary.main,
    },
  };
};

export const CustomInputField = styled(TextField)(({ theme }) =>
  customInputStyle(theme as Theme)
);

export const CustomNumberField = styled(NumericTextFieldQshop)(({ theme }) =>
  customInputStyle(theme as Theme)
);

export const ButtonRow = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: "10px",
  justifyContent: "flex-end",
}));

export const CancelButton = styled(Button)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "15px",
}));

export const CreateButton = styled(Button)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "15px",
  backgroundColor: "#32d43a",
  color: "black",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#2bb131",
  },
}));

export const WalletRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

export const DownloadArrrWalletIcon = styled(DownloadSVG)(({ theme }) => ({
  padding: "5px 7px",
  borderRadius: "50%",
  backgroundColor: theme.palette.background.paper,
  "&:hover": {
    cursor: "pointer",
  },
}));

export const AdvancedSettingsBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "10px",
  padding: "5px 10px",
  borderRadius: "5px",
  backgroundColor: theme.palette.background.paper,
  "& .MuiTypography-root": {
    fontFamily: "Karla",
    fontSize: "20px",
    fontWeight: 300,
    letterSpacing: "0.2px",
  }
}));

export const EditStoreButtonsRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "10px",
});

export const CreateNewDataContainerRow = styled(Box)({
  display: "flex",
  alignItems: "center",
});

export const CreateNewDataContainerButton = styled(Button)(({ theme }) => ({
  backgroundColor: "#d43232",
  textTransform: "none",
  fontFamily: "Raleway",
  fontWeight: 300,
  gap: "5px",
  fontSize: "17px",
  borderRadius: "5px",
  border: "none",
  color: "white",
  padding: "5px 15px",
  transition: "all 0.3s ease-in-out",
  boxShadow:
    "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#a72727",
    boxShadow:
      "rgba(50, 50, 93, 0.35) 0px 3px 5px -1px, rgba(0, 0, 0, 0.4) 0px 2px 3px -1px;"
  }
}));