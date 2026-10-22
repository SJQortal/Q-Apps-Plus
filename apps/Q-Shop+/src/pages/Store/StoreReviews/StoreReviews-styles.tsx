/**
 * The original reviews dialog's close icon, still used by the cart. The
 * reviews panel itself uses real icon buttons.
 */
import { styled } from "@mui/material/styles";
import { TimesSVG } from "../../../assets/svgs/TimesSVG";

export const CloseIconModal = styled(TimesSVG)(() => ({
  position: "absolute",
  top: "15px",
  right: "5px",
  transition: "transform 150ms ease-in-out",
  "&:hover": {
    cursor: "pointer",
    transform: "scale(1.1)",
  },
}));
