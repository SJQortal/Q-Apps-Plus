import { useMediaQuery } from "@mui/material";

/** True below 600 px: phones, and narrow Hub panes, get the phone layout. */
export function usePhoneLayout(): boolean {
  return useMediaQuery("(max-width:599.95px)");
}

/** True below 900 px: the desktop rails collapse. */
export function useNarrowLayout(): boolean {
  return useMediaQuery("(max-width:899.95px)");
}
