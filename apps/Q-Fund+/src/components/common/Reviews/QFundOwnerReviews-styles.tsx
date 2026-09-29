import { styled } from "@mui/material/styles";
import { ReusableModal } from "../../modals/ReusableModal";
import { Box, Button, Typography } from "@mui/material";
import { TimesSVG } from "../../../assets/svgs/TimesSVG";

interface OwnerReviewsProps {
  showCompleteReview: boolean;
}

export const AddReviewButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: "4px 15px",
  gap: "10px",
  fontFamily: "Livvic",
  fontSize: "16px",
  width: "auto",
  color: theme.palette.mode === "dark" ? "#000000" : "#ffffff",
  backgroundColor: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
  border: "none",
  borderRadius: "5px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.mode === "dark" ? "#ffffff" : "#000000",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
  },
}));

export const AverageReviewContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  maxHeight: "200px",
  width: "100%",
});

export const ReviewsFont = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  fontFamily: "Mulish",
  fontSize: "19px",
  fontWeight: 400,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  userSelect: "none",
  marginBottom: "5px",
}));

export const AverageReviewNumber = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "60px",
  fontWeight: 600,
  letterSpacing: "2px",
  color: theme.palette.text.primary,
  userSelect: "none",
  lineHeight: "35px",
  marginBottom: "25px",
}));

export const TotalReviewsFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "19px",
  fontWeight: 400,
  color: theme.palette.text.primary,
  userSelect: "none",
  opacity: 0.8,
  letterSpacing: 0,
}));

export const ReviewContainer = styled(Box)<OwnerReviewsProps>(
  ({ theme, showCompleteReview }) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "10px",
    padding: "5px",
    borderRadius: "5px",
    width: "100%",
    transition: "all 0.3s ease-in-out",
    "&:hover": {
      cursor: showCompleteReview ? "auto" : "pointer",
      backgroundColor: showCompleteReview
        ? "transparent"
        : theme.palette.mode === "light"
        ? "#d3d3d3ac"
        : "#aeabab1e",
    },
  })
);

export const ReviewHeader = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: "1px",
});

export const ReviewTitleRow = styled(Box)({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "15px",
});

export const ReviewUsernameFont = styled(Box)(({ theme }) => ({
  fontFamily: "Montserrat",
  fontSize: "17px",
  fontWeight: 400,
  letterSpacing: "0.3px",
  color: theme.palette.text.primary,
}));

export const ReviewTitleFont = styled(Box)(({ theme }) => ({
  fontFamily: "Montserrat, sans-serif",
  fontSize: "18px",
  fontWeight: 500,
  letterSpacing: "-0.3px",
  color: theme.palette.text.primary,
}));

export const ReviewDateFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "16px",
  fontWeight: 400,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  opacity: 0.8,
}));

export const ReviewDescriptionFont = styled(Box)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "19px",
  fontWeight: 400,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
}));

export const OwnerReviewsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  gap: "30px",
  overflowY: "auto",
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar": {
    width: "8px",
    height: "10px",
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#414763",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#40455f",
  },
}));

export const CloseIconModal = styled(TimesSVG)({
  position: "absolute",
  top: "15px",
  right: "5px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)",
  },
});

export const ReusableModalStyled = styled(ReusableModal)(({ theme }) => ({
  "& [class$='MuiBox-root']": {
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-track:hover": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar": {
      width: "8px",
      height: "10px",
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#414763",
      borderRadius: "8px",
      backgroundClip: "content-box",
      border: "4px solid transparent",
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#40455f",
    },
  },
}));

export const OwnerAvatar = styled("img")({
  width: "90px",
  height: "90px",
  borderRadius: "50%",
  objectFit: "cover",
});

export const OwnerName = styled(Box)(({ theme }) => ({
  display: "flex",
  justifySelf: "center",
  userSelect: "none",
  fontFamily: "Copse",
  fontWeight: 400,
  fontSize: "25px",
  letterSpacing: "0.5px",
  color: theme.palette.text.primary,
}));

export const Divider = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "2px",
  backgroundColor: theme.palette.text.primary,
  padding: "0 10px",
  divider: 0.7,
}));

export const HeaderRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  alignItems: "center",
  justifyContent: "flex-start",
  width: "100%",
  padding: "10px 15px",
  fontFamily: "Copse, sans-serif",
  fontSize: "23px",
  color: theme.palette.text.primary,
}));

export const CardDetailsContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
});

export const OwnerNameCol = styled(Box)({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
});

export const CloseButtonRow = styled(Box)({
  display: "flex",
  gap: 1,
  justifyContent: "flex-end",
});

export const CreateButton = styled(Button)({
  fontFamily: "Montserrat",
  fontWeight: 400,
  letterSpacing: "0.2px",
  textTransform: "uppercase",
  fontSize: "15px",
  backgroundColor: "#32d43a",
  color: "black",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: "#2bb131",
  },
});

export const CloseButton = styled(Button)({
  fontFamily: "Montserrat",
  fontWeight: 400,
  letterSpacing: "0.2px",
  textTransform: "uppercase",
  fontSize: "15px",
});
