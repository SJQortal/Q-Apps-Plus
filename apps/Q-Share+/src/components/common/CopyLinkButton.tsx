import ShareIcon from "@mui/icons-material/Share";
import {
  Box,
  ButtonBase,
  Tooltip,
  tooltipClasses,
  TooltipProps,
} from "@mui/material";
import { styled } from "@mui/system";

import { useDispatch } from "react-redux";
import { setNotification } from "../../state/features/notificationsSlice.ts";

export interface CopyLinkButtonProps {
  link: string;
  tooltipTitle: string;
}

export const TooltipLine = styled("div")(({ theme }) => ({
  fontSize: "18px",
}));

const CustomWidthTooltipStyles = styled(
  ({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  )
)({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 600,
  },
});

export const CustomTooltip = ({ title, ...props }: TooltipProps) => {
  if (typeof title === "string") title = <TooltipLine>{title}</TooltipLine>;

  return <CustomWidthTooltipStyles title={title} {...props} />;
};

export const CopyLinkButton = ({ link, tooltipTitle }: CopyLinkButtonProps) => {
  const dispatch = useDispatch();
  return (
    <CustomTooltip title={tooltipTitle} placement={"top"} arrow>
      <Box
        sx={{
          cursor: "pointer",
        }}
      >
        <ButtonBase
          onClick={() => {
            navigator.clipboard.writeText(link).then(() => {
              dispatch(
                setNotification({
                  msg: "Copied to clipboard!",
                  alertType: "success",
                })
              );
            });
          }}
        >
          <ShareIcon />
        </ButtonBase>
      </Box>
    </CustomTooltip>
  );
};
