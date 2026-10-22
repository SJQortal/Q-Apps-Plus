import { Box, Chip, Skeleton } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import type { OrderStatusInfo } from "../../state/features/orderSlice";
import { normalizeStatus, statusColor, statusLabel } from "../status";

const ICONS = {
  Received: <HourglassEmptyOutlinedIcon />,
  Shipped: <LocalShippingOutlinedIcon />,
  Refunded: <ReplayOutlinedIcon />,
};

/**
 * A status as a chip: the label in the text colour (4.5:1 in every theme),
 * the status shown by an icon and a tint in the theme's warning, success or
 * error colour. The original painted a yellow card with white text, and
 * never showed Refunded in red (it compared with " Refunded": Bugs 10).
 */
export function OrderStatusChip({
  status,
  role,
  size = "small",
}: {
  /** null while the status is loading. */
  status: OrderStatusInfo | null;
  role: "buyer" | "seller";
  size?: "small" | "medium";
}) {
  if (!status) {
    return (
      <Box component="span" sx={{ display: "inline-flex" }}>
        <Skeleton variant="rounded" width={88} height={size === "small" ? 24 : 32} aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Status loading
        </Box>
      </Box>
    );
  }
  if (status.state === "error") {
    return (
      <Chip
        size={size}
        variant="outlined"
        icon={<HelpOutlineOutlinedIcon />}
        label="Status unavailable"
        sx={{ fontWeight: 600 }}
      />
    );
  }
  const normal = normalizeStatus(status.status);
  const color = statusColor(status.status);
  return (
    <Chip
      size={size}
      icon={normal ? ICONS[normal] : <HelpOutlineOutlinedIcon />}
      label={statusLabel(status.status, role)}
      data-status={normal ?? "other"}
      sx={(theme: Theme) => {
        const main = color === "default" ? theme.palette.text.secondary : theme.palette[color].main;
        return {
          fontWeight: 600,
          color: "text.primary",
          bgcolor: alpha(main, 0.14),
          border: 1,
          borderColor: alpha(main, 0.55),
          "& .MuiChip-icon": { color: main },
        };
      }}
    />
  );
}

export const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;
