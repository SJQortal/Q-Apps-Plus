import { Box, Button, Typography } from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

/** One-line explanation of an empty or failed view, plus the next action. */
export const EmptyState = ({ title, description, actionLabel, onAction, icon }: EmptyStateProps) => (
  <Box
    role="status"
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: 1,
      padding: "40px 16px",
      border: 1,
      borderColor: "divider",
      borderRadius: 2,
      bgcolor: "background.paper",
      color: "text.secondary",
    }}
  >
    <Box sx={{ color: "text.secondary", "& svg": { fontSize: 40 } }}>{icon ?? <InboxOutlinedIcon />}</Box>
    <Typography sx={{ fontWeight: 700, color: "text.primary" }}>{title}</Typography>
    {description && <Typography variant="body2">{description}</Typography>}
    {actionLabel && onAction && (
      <Button variant="outlined" onClick={onAction} sx={{ mt: 1 }}>
        {actionLabel}
      </Button>
    )}
  </Box>
);
