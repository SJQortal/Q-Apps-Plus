import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";

/**
 * The original's centred modal body, now in the theme's colours. Callers'
 * `customStyles` still size it on wider screens; on phones and narrow Hub
 * panes ReusableModal makes it full-screen (docs/DESIGN.md → Mobile).
 */
export const ReusableModalBody = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "75%",
  maxWidth: "calc(100% - 32px)",
  maxHeight: "calc(var(--qshare-app-height, 100dvh) - 32px)",
  overflowY: "auto",
  overscrollBehavior: "contain",
  boxSizing: "border-box",
  backgroundColor: theme.palette.background.paper,
  backgroundImage: "none",
  color: theme.palette.text.primary,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: "15px 35px",
  display: "flex",
  flexDirection: "column",
  gap: "17px",
  boxShadow: theme.shadows[8],
  outline: "none",
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar": {
    width: "14px",
    height: "10px",
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.divider,
    borderRadius: "8px",
    backgroundClip: "content-box",
    border: "4px solid transparent",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: theme.palette.text.secondary,
  },
}));

/**
 * Full-screen on phones, sized to the Hub/GO frame (never 100vh), with the
 * safe areas kept clear. Applied after the caller's `customStyles`, so it
 * wins on phones whatever width or position they set for desktop.
 */
export const PHONE_FULL_SCREEN = {
  [`@media ${PHONE_MEDIA}`]: {
    top: 0,
    left: 0,
    right: 0,
    transform: "none",
    width: "100%",
    maxWidth: "none",
    height: "var(--qshare-app-height, 100dvh)",
    maxHeight: "none",
    borderRadius: 0,
    border: 0,
    boxShadow: "none",
    gap: "12px",
    padding: "0 16px calc(16px + env(safe-area-inset-bottom, 0px))",
  },
} as const;
