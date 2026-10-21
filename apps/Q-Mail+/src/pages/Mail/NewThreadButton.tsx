import { useState } from "react";
import { Button, Menu, MenuItem } from "@mui/material";
import AddCommentOutlinedIcon from "@mui/icons-material/AddCommentOutlined";
import type { GroupOption } from "./threadData";

/** "New thread": straight into the composer with one group, a group picker with several. */
export function NewThreadButton({
  groups,
  onRequestComposeThread,
  variant = "contained",
  fullWidth = false,
}: {
  groups: GroupOption[];
  onRequestComposeThread?: (group: GroupOption) => void;
  variant?: "contained" | "outlined";
  fullWidth?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  if (!onRequestComposeThread || !groups.length) return null;
  const pick = (group: GroupOption) => {
    setAnchorEl(null);
    onRequestComposeThread(group);
  };
  return (
    <>
      <Button
        variant={variant}
        startIcon={<AddCommentOutlinedIcon />}
        fullWidth={fullWidth}
        onClick={(event) => (groups.length === 1 ? pick(groups[0]) : setAnchorEl(event.currentTarget))}
        aria-haspopup={groups.length > 1 ? "menu" : undefined}
        sx={{ minHeight: 44, textTransform: "none", fontWeight: 600, borderRadius: 2, flexShrink: 0 }}
      >
        New thread
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {groups.map((group) => (
          <MenuItem key={String(group.id)} onClick={() => pick(group)} sx={{ minHeight: 44 }}>
            {group.name}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
