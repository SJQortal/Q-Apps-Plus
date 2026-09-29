import { Box, Typography } from "@mui/material";
import { styled } from "@mui/system";

export const FilePlayerContainer = styled(Box)(({ theme }) => ({
  maxWidth: "95%",
  width: "90vw",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
}));

export const FileTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  color: theme.palette.text.primary,
  userSelect: "none",
  wordBreak: "break-word",
}));

export const FileDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Raleway",
  fontSize: "16px",
  color: theme.palette.text.primary,
  userSelect: "none",
  wordBreak: "break-word",
}));

export const ImageContainer = styled(Box)(({ theme }) => ({
  display: "flex",
}));

export const Spacer = ({ height }: any) => {
  return (
    <Box
      sx={{
        height: height,
      }}
    />
  );
};

export const StyledCardHeaderComment = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: "5px",
  padding: "7px 0px",
});
export const StyledCardCol = styled(Box)({
  display: "flex",
  overflow: "hidden",
  flexDirection: "column",
  gap: "2px",
  alignItems: "flex-start",
  width: "100%",
});

export const StyledCardColComment = styled(Box)({
  display: "flex",
  overflow: "hidden",
  flexDirection: "column",
  gap: "2px",
  alignItems: "flex-start",
  width: "100%",
});

export const AuthorTextComment = styled(Typography)({
  fontFamily: "Raleway, sans-serif",
  fontSize: "16px",
  lineHeight: "1.2",
});

export const FileAttachmentContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "20px",
  padding: "5px 10px",
  border: `1px solid ${theme.palette.text.primary}`,
}));

export const FileAttachmentFont = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  color: theme.palette.text.primary,
  fontSize: "16px",
  letterSpacing: 0,
  fontWeight: 400,
  userSelect: "none",
  whiteSpace: "nowrap",
}));
