/**
 * What a mail list row's menu offers (right click, long press): the actions
 * the row and its list already have, in a fixed order. Pure, so tests pin
 * which actions show where.
 */
export type RowMenuActionId =
  | "open"
  | "reply"
  | "replyAll"
  | "forward"
  | "markRead"
  | "markUnread"
  | "archive"
  | "unarchive"
  | "select"
  | "deselect"
  | "delete"
  | "expand"
  | "collapse";

export interface RowMenuAction {
  id: RowMenuActionId;
  label: string;
  onSelect: () => void;
}

export interface MessageRowActionInput {
  isFromSent: boolean;
  isUnread: boolean;
  selected?: boolean;
  open: () => void;
  /** Reply and Reply all; received mail only. */
  reply?: (replyAll: boolean) => void;
  forward?: () => void;
  markRead?: () => void;
  markUnread?: () => void;
  archive?: () => void;
  unarchive?: () => void;
  toggleSelected?: () => void;
  /** Delete a sent message; Sent only. */
  remove?: () => void;
}

export function messageRowActions(input: MessageRowActionInput): RowMenuAction[] {
  const actions: RowMenuAction[] = [{ id: "open", label: "Open", onSelect: input.open }];
  const { reply } = input;
  if (!input.isFromSent && reply) {
    actions.push({ id: "reply", label: "Reply", onSelect: () => reply(false) });
    actions.push({ id: "replyAll", label: "Reply all", onSelect: () => reply(true) });
  }
  if (input.forward) actions.push({ id: "forward", label: "Forward", onSelect: input.forward });
  if (!input.isFromSent) {
    if (input.isUnread && input.markRead) actions.push({ id: "markRead", label: "Mark as read", onSelect: input.markRead });
    if (!input.isUnread && input.markUnread) actions.push({ id: "markUnread", label: "Mark as unread", onSelect: input.markUnread });
  }
  if (input.archive) actions.push({ id: "archive", label: "Archive", onSelect: input.archive });
  if (input.unarchive) actions.push({ id: "unarchive", label: "Move to inbox", onSelect: input.unarchive });
  if (input.toggleSelected) {
    actions.push(
      input.selected
        ? { id: "deselect", label: "Deselect", onSelect: input.toggleSelected }
        : { id: "select", label: "Select", onSelect: input.toggleSelected }
    );
  }
  if (input.isFromSent && input.remove) actions.push({ id: "delete", label: "Delete sent message", onSelect: input.remove });
  return actions;
}

export interface GroupRowActionInput {
  count: number;
  unreadCount: number;
  expanded: boolean;
  allSelected: boolean;
  toggleExpanded: () => void;
  markRead?: () => void;
  markUnread?: () => void;
  archive?: () => void;
  unarchive?: () => void;
  toggleSelected?: () => void;
}

/** A sender (or recipient) group of several messages: what applies to all of them. */
export function groupRowActions(input: GroupRowActionInput): RowMenuAction[] {
  const actions: RowMenuAction[] = [
    input.expanded
      ? { id: "collapse", label: "Hide the messages", onSelect: input.toggleExpanded }
      : { id: "expand", label: `Show the ${input.count} messages`, onSelect: input.toggleExpanded },
  ];
  if (input.unreadCount > 0 && input.markRead) actions.push({ id: "markRead", label: "Mark all as read", onSelect: input.markRead });
  if (input.unreadCount < input.count && input.markUnread) {
    actions.push({ id: "markUnread", label: "Mark all as unread", onSelect: input.markUnread });
  }
  if (input.archive) actions.push({ id: "archive", label: "Archive all", onSelect: input.archive });
  if (input.unarchive) actions.push({ id: "unarchive", label: "Move all to inbox", onSelect: input.unarchive });
  if (input.toggleSelected) {
    actions.push(
      input.allSelected
        ? { id: "deselect", label: "Deselect all", onSelect: input.toggleSelected }
        : { id: "select", label: `Select all ${input.count}`, onSelect: input.toggleSelected }
    );
  }
  return actions;
}
