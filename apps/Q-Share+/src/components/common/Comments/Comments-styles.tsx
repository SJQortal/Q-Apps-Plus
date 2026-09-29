import type { ElementType } from "react";
import { alpha, styled } from "@mui/material/styles";
import { Box, Typography, Button, TextField } from "@mui/material";

export const CommentsPanel = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minWidth: 0,
  gap: theme.spacing(1.5),
  paddingBottom: theme.spacing(1),
}));

export const CommentsTitle = styled(Typography)<{ component?: ElementType }>(({ theme }) => ({
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

export const CardContentContainerComment = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  margin: 0,
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  width: "100%",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
}));

export const ReplyCard = styled(Box)(({ theme }) => ({
  display: "flex",
  minWidth: 0,
  borderLeft: `3px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export const StyledCardHeaderComment = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: theme.spacing(1),
  padding: theme.spacing(1, 0),
  minWidth: 0,
}));

export const StyledCardColComment = styled(Box)({
  display: "flex",
  overflow: "hidden",
  flexDirection: "column",
  gap: 2,
  alignItems: "flex-start",
  width: "100%",
  minWidth: 0,
});

export const StyledCardContentComment = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  padding: theme.spacing(0.5, 0),
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const StyledCardComment = styled(Typography)(({ theme }) => ({
  letterSpacing: 0,
  fontWeight: 400,
  color: theme.palette.text.primary,
  fontSize: 16,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
}));

export const AuthorTextComment = styled(Typography)(({ theme }) => ({
  fontSize: 15,
  fontWeight: 600,
  color: theme.palette.text.primary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
}));

export const CommentsContainer = styled(Box)({
  width: "100%",
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
});

export const CommentContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minWidth: 0,
  gap: theme.spacing(1.5),
}));

export const NoCommentsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.5),
  padding: theme.spacing(3, 1),
  fontSize: 15,
  color: theme.palette.text.secondary,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

export const LoadMoreCommentsButtonRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  marginTop: theme.spacing(1.5),
}));

export const LoadMoreCommentsButton = styled(Button)(({ theme }) => ({
  fontWeight: 500,
  fontSize: 14,
  minHeight: 44,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}));

export const CommentActionButton = styled(Button)(({ theme }) => ({
  fontWeight: 500,
  fontSize: 14,
  textTransform: "none",
  minHeight: 36,
  [theme.breakpoints.down("sm")]: {
    minHeight: 44,
  },
}));

export const CommentActionButtonRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginLeft: "auto",
}));

export const CommentEditorContainer = styled(Box)({
  width: "100%",
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
});

export const CommentDateText = styled(Typography)(({ theme }) => ({
  fontWeight: 400,
  fontSize: 13,
  color: theme.palette.text.secondary,
}));

export const CommentInputContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  minWidth: 0,
  gap: theme.spacing(1),
  alignItems: "stretch",
  marginTop: theme.spacing(1),
}));

export const CommentInput = styled(TextField)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
  border: `1px solid ${theme.palette.divider}`,
  width: "100%",
  borderRadius: theme.shape.borderRadius,
  "& .MuiFilledInput-root": {
    letterSpacing: 0,
    fontWeight: 400,
    color: theme.palette.text.primary,
    fontSize: 16,
    backgroundColor: "transparent",
    borderRadius: theme.shape.borderRadius,
    "&:before": { borderBottom: "none" },
    "&:hover": {
      backgroundColor: "transparent",
      "&:before": { borderBottom: "none" },
    },
  },
}));

export const SubmitCommentButton = styled(Button)(({ theme }) => ({
  fontWeight: 600,
  fontSize: 15,
  minHeight: 44,
  [theme.breakpoints.down("sm")]: {
    width: "100%",
  },
}));
