/**
 * The menu of a mail list row or sender group, opened by a right click, the
 * keyboard's menu key or a long press (useContextMenuTrigger): a bottom sheet
 * on phones, a menu at the pointer elsewhere (BottomSheetMenu).
 *
 * Its own chunk: a row loads it the first time its menu opens, so the icons
 * and the sheet stay out of the first download.
 */
import type { ReactNode } from "react";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ReplyAllOutlinedIcon from "@mui/icons-material/ReplyAllOutlined";
import ForwardOutlinedIcon from "@mui/icons-material/ForwardOutlined";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import CheckBoxOutlinedIcon from "@mui/icons-material/CheckBoxOutlined";
import CheckBoxOutlineBlankOutlinedIcon from "@mui/icons-material/CheckBoxOutlineBlankOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import UnfoldMoreOutlinedIcon from "@mui/icons-material/UnfoldMoreOutlined";
import UnfoldLessOutlinedIcon from "@mui/icons-material/UnfoldLessOutlined";
import { BottomSheetMenu } from "../../components/common/BottomSheetMenu";
import type { MenuPoint } from "../../hooks/useContextMenuTrigger";
import type { RowMenuAction, RowMenuActionId } from "./rowMenuActions";

const ICONS: Record<RowMenuActionId, ReactNode> = {
  open: <DraftsOutlinedIcon fontSize="small" />,
  reply: <ReplyOutlinedIcon fontSize="small" />,
  replyAll: <ReplyAllOutlinedIcon fontSize="small" />,
  forward: <ForwardOutlinedIcon fontSize="small" />,
  markRead: <MarkEmailReadOutlinedIcon fontSize="small" />,
  markUnread: <MarkEmailUnreadOutlinedIcon fontSize="small" />,
  archive: <ArchiveOutlinedIcon fontSize="small" />,
  unarchive: <UnarchiveOutlinedIcon fontSize="small" />,
  select: <CheckBoxOutlineBlankOutlinedIcon fontSize="small" />,
  deselect: <CheckBoxOutlinedIcon fontSize="small" />,
  delete: <DeleteOutlineIcon fontSize="small" />,
  expand: <UnfoldMoreOutlinedIcon fontSize="small" />,
  collapse: <UnfoldLessOutlinedIcon fontSize="small" />,
};

export interface MessageRowMenuProps {
  open: boolean;
  point: MenuPoint;
  onClose: () => void;
  actions: RowMenuAction[];
  /** Above the items on phones: whose message, or whose group. */
  title?: ReactNode;
  ariaLabel: string;
}

export function MessageRowMenu({ open, point, onClose, actions, title, ariaLabel }: MessageRowMenuProps) {
  return (
    <BottomSheetMenu
      open={open}
      onClose={onClose}
      anchorEl={null}
      anchorPosition={point}
      title={title}
      ariaLabel={ariaLabel}
      items={actions.map(action => ({ id: action.id, label: action.label, icon: ICONS[action.id], onSelect: action.onSelect }))}
    />
  );
}
