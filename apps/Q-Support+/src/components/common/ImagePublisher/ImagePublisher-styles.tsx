import { Box, Button } from "@mui/material";
import { styled } from "@mui/system";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { TimesSVG } from "./TimesSVG.tsx";

export const AddCoverImageButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  fontFamily: "Montserrat",
  fontSize: "16px",
  fontWeight: 400,
  letterSpacing: "0.2px",
  color: theme.palette.text.primary,
  width: "170px",
  backgroundColor: "#01A9E9",
  "&:hover": { backgroundColor: "#005C96" },
  gap: "5px",
}));

export const AddLogoIcon = styled(AddPhotoAlternateIcon)(({ theme }) => ({
  color: theme.palette.text.primary,
  height: "25px",
  width: "auto",
}));

export const LogoPreviewRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "10px",
}));

export const CoverImagePreview = styled("img")(({ theme }) => ({
  width: "100px",
  height: "100px",
  objectFit: "contain",
  userSelect: "none",
  borderRadius: "3px",
  marginBottom: "10px",
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
