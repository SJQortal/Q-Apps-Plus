import { styled } from "@mui/system";
import { Box, Button, Typography } from "@mui/material";
import { TimesSVG } from "../../assets/svgs/TimesSVG";

export const PlayerBox = styled(Box)(({ theme }) => ({
  width: "340px",
  outline: `1px solid ${theme.palette.primary.dark}`,
  borderRadius: "3px",
  minHeight: "95px",
}));

export const UpdateLoadingBox = styled(Box)({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

export const UpdateContainer = styled(Box)({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
});

export const UpdateRow = styled(Box)({
  width: "100%",
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "15px",
});

export const UpdateNameRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "10px",
  fontFamily: "Mulish",
  letterSpacing: 0,
  fontWeight: 400,
  fontSize: "18px",
  userSelect: "none",
  color: theme.palette.text.primary,
}));

export const UpdateCol = styled(Box)({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "10px",
});

export const CrowdfundUpdateDate = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "14px",
  letterSpacing: 0,
  fontWeight: 400,
  userSelect: "none",
  color: theme.palette.text.primary,
}));

export const AttachmentCol = styled(Box)({
  display: "flex",
  width: "100%",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
});

export const FileAttachmentContainer = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "20px",
  padding: "5px 10px",
});

export const FileAttachmentFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  color: theme.palette.text.primary,
  fontSize: "16px",
  letterSpacing: 0,
  fontWeight: 400,
  wordBreak: "break-word",
  userSelect: "none",
}));

export const CloseNewUpdateModal = styled(TimesSVG)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)",
  },
}));
