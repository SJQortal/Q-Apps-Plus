import { styled } from "@mui/system";
import { Box, Button, Typography } from "@mui/material";
import { TimesSVG } from "../../../assets/svgs/TimesSVG";

interface StoreReviewsProps {
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
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;"
  }
}));

export const AverageReviewContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  maxHeight: "200px",
  width: "100%"
}));

export const ReviewsFont = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  fontFamily: "Raleway",
  fontSize: "19px",
  fontWeight: 600,
  color: theme.palette.text.primary,
  userSelect: "none",
  marginBottom: "5px"
}));

export const AverageReviewNumber = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "60px",
  fontWeight: 600,
  letterSpacing: "2px",
  color: theme.palette.text.primary,
  userSelect: "none",
  lineHeight: "35px",
  marginBottom: "25px"
}));

export const TotalReviewsFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "15px",
  fontWeight: 300,
  color: theme.palette.text.primary,
  userSelect: "none",
  opacity: 0.8
}));

export const ReviewContainer = styled(Box)<StoreReviewsProps>(
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
        : "#aeabab1e"
    }
  })
);

export const ReviewHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: "1px"
}));

export const ReviewTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "15px"
}));

export const ReviewUsernameFont = styled(Box)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "16px",
  fontWeight: 400,
  color: theme.palette.text.primary
}));

export const ReviewTitleFont = styled(Box)(({ theme }) => ({
  fontFamily: "Merriweather Sans, sans-serif",
  fontSize: "18px",
  fontWeight: 400,
  letterSpacing: "0.5px",
  color: theme.palette.text.primary
}));

export const ReviewDateFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "15px",
  fontWeight: 300,
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  opacity: 0.8
}));

export const ReviewDescriptionFont = styled(Box)(({ theme }) => ({
  fontFamily: "Karla",
  fontSize: "17px",
  fontWeight: 300,
  letterSpacing: "0px",
  color: theme.palette.text.primary
}));

export const StoreReviewsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  gap: "30px",
  overflowY: "auto",
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent"
  },
  "&::-webkit-scrollbar-track:hover": {
    backgroundColor: "transparent"
  },
  "&::-webkit-scrollbar": {
    width: "8px",
    height: "10px",
    backgroundColor: "transparent"
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "light" ? "#d3d9e1" : "#414763",
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent"
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.mode === "light" ? "#b7bcc4" : "#40455f"
  }
}));

export const CloseIconModal = styled(TimesSVG)(({ theme }) => ({
  position: "absolute",
  top: "15px",
  right: "5px",
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)"
  }
}));
