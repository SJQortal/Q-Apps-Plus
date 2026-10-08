/**
 * A mailbox list grouped by sender (inbox, archived, alias inbox) or by
 * recipient (sent), with expand/collapse per group, select all, and a sticky
 * bulk bar (Mark read / Mark unread / Archive / Move to inbox).
 *
 * States (docs/DESIGN.md → Components and states): `status` drives a skeleton
 * while the first load runs, an ErrorState with Retry, and an EmptyState with
 * a next action; the list itself shows as soon as there are rows.
 */
import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInView } from "../../hooks/useInView";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { Box, Button, ButtonBase, Checkbox, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { MailListDate } from "./MailListDate";
import { MailMessageRow, WIDE_ROW_QUERY } from "./MailMessageRow";
import { AvatarWrapper } from "./MailTable";
import { NameText, spokenName } from "../../components/common/NameText";
import {
  getSentRecipientDisplayLabel,
  getSentRecipientGroupKey,
} from "./mailIdentifier";
import { useRowMenu } from "./useRowMenu";
import { groupRowActions } from "./rowMenuActions";
import { selectReadState } from "../../state/features/mailSlice";
import { RootState } from "../../state/store";
import { isMessageRead } from "../../utils/readState";
import { useSentRecipient } from "../../utils/sentRecipientCache";
import { EmptyState, ErrorState, ListSkeleton, UnreadDot } from "../../layout/states";
import { headerFill } from "../../hub-theme";

type MailboxType = "inbox" | "sent";

export type ListStatus = "idle" | "loading" | "error" | "ready";

interface GroupedMailboxListProps {
  messages: any[];
  mailboxType: MailboxType;
  showSelectAll?: boolean;
  openMessage: (
    user: string,
    identifier: string,
    content: any,
    alias?: string
  ) => unknown;
  openedMessageId?: string | number | null;
  /** Reply / Reply all from a row's menu (received mail). */
  onReply?: (message: any, options?: { replyAll?: boolean }) => void;
  /** Forward from a row's menu. */
  onForward?: (message: any) => void;
  onDeleteMessage?: (message: any) => void | boolean | Promise<void | boolean>;
  isDeletingMessage?: (messageId: string) => boolean;
  onMarkAsRead?: (messages: any[]) => void | Promise<void>;
  onMarkAsUnread?: (messages: any[]) => void | Promise<void>;
  /** Archive the selected messages (local only; shown in the Archived view). */
  onArchive?: (messages: any[]) => void | Promise<void>;
  /** Move the selected messages back to the inbox. */
  onUnarchive?: (messages: any[]) => void | Promise<void>;
  /** Load state of the list; `loading`/`error` only matter while there are no rows. */
  status?: ListStatus;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyHint?: React.ReactNode;
  emptyAction?: ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  /** Search terms to highlight in the rows. */
  highlightTerms?: string[];
  /** Rendered after the rows (e.g. a Load more control). */
  footer?: ReactNode;
}

interface MessageGroup {
  key: string;
  label: string;
  latestCreatedAt: number | string;
  messages: any[];
}

const toTimestamp = (value: number | string | undefined | null): number => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const sortMessagesByCreatedDescending = (a: any, b: any): number => {
  return toTimestamp(b?.createdAt) - toTimestamp(a?.createdAt);
};

const getMessageId = (message: any): string => {
  const value = message?.id ?? message?.identifier;
  if (value === undefined || value === null) return "";
  return String(value);
};

/** Pure grouping, exported for tests. */
export function groupMessages(messages: any[], mailboxType: MailboxType): MessageGroup[] {
  const groupMap = new Map<string, MessageGroup>();

  messages.forEach(message => {
    const identifier = getMessageId(message);
    if (!identifier) return;

    let key = "";
    let label = "";

    if (mailboxType === "sent") {
      key = getSentRecipientGroupKey(identifier);
      label = getSentRecipientDisplayLabel(identifier);
    } else {
      const sender =
        typeof message?.user === "string" ? message.user.trim() : "";
      key = sender ? `sender:${sender.toLowerCase()}` : "sender:unknown";
      label = sender || "Unknown sender";
    }

    const existingGroup = groupMap.get(key);
    if (existingGroup) {
      existingGroup.messages.push(message);
      if (
        toTimestamp(message?.createdAt) >
        toTimestamp(existingGroup.latestCreatedAt)
      ) {
        existingGroup.latestCreatedAt = message?.createdAt || 0;
      }
      return;
    }

    groupMap.set(key, {
      key,
      label,
      latestCreatedAt: message?.createdAt || 0,
      messages: [message],
    });
  });

  const groups = Array.from(groupMap.values()).map(group => ({
    ...group,
    messages: [...group.messages].sort(sortMessagesByCreatedDescending),
  }));

  groups.sort(
    (a, b) => toTimestamp(b.latestCreatedAt) - toTimestamp(a.latestCreatedAt)
  );
  return groups;
}

const checkboxSx = { minWidth: 44, minHeight: 44, flexShrink: 0 } as const;

/** "To: <name>" for a sent group: the decrypted recipient of any opened message, else one cached lookup. */
function SentGroupLabel({ identifier, known }: { identifier: string; known?: string }) {
  // The lookup waits until the group is on screen.
  const [node, setNode] = useState<HTMLSpanElement | null>(null);
  const inView = useInView(node);
  const recipient = useSentRecipient(identifier, known, inView);
  return (
    <span ref={setNode}>
      To: <NameText name={recipient.name} />
    </span>
  );
}

export const GroupedMailboxList = ({
  messages,
  mailboxType,
  openMessage,
  openedMessageId,
  onReply,
  onForward,
  onDeleteMessage,
  isDeletingMessage,
  showSelectAll = false,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onUnarchive,
  status = "ready",
  emptyIcon,
  emptyTitle,
  emptyHint,
  emptyAction,
  errorMessage,
  onRetry,
  highlightTerms,
  footer,
}: GroupedMailboxListProps) => {
  // Read/unread comes from the read store (src/utils/readState.ts), never
  // from generalData.threadV2, so a real reply chain is left alone (Bugs #5).
  const readState = useSelector(selectReadState);
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  );
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const groupedMessages = useMemo(
    () => groupMessages(messages, mailboxType),
    [messages, mailboxType]
  );

  const allVisibleMessageIds = useMemo(() => {
    return groupedMessages.flatMap(group =>
      group.messages.map(getMessageId).filter(Boolean) as string[]
    );
  }, [groupedMessages]);

  const selectedVisibleCount = useMemo(() => {
    return allVisibleMessageIds.filter(id => selectedMessageIds.has(id)).length;
  }, [allVisibleMessageIds, selectedMessageIds]);

  const areAllVisibleSelected =
    allVisibleMessageIds.length > 0 &&
    selectedVisibleCount === allVisibleMessageIds.length;
  const isVisibleSelectionIndeterminate =
    selectedVisibleCount > 0 && selectedVisibleCount < allVisibleMessageIds.length;

  const handleToggleMessage = (messageId: string) => {
    if (!messageId) return;
    setSelectedMessageIds(previous => {
      const newSet = new Set(previous);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleToggleSelectAllVisible = () => {
    if (!allVisibleMessageIds.length) return;
    setSelectedMessageIds(previous => {
      const newSet = new Set(previous);
      const isAllSelected = allVisibleMessageIds.every(id => newSet.has(id));
      allVisibleMessageIds.forEach(id => {
        if (isAllSelected) newSet.delete(id);
        else newSet.add(id);
      });
      return newSet;
    });
  };

  const handleToggleAll = (groupKey: string) => {
    const group = groupedMessages.find(g => g.key === groupKey);
    if (!group) return;
    setSelectedMessageIds(previous => {
      const newSet = new Set(previous);
      const groupMessageIds = group.messages
        .map(getMessageId)
        .filter(Boolean) as string[];
      const isAllSelected = groupMessageIds.every(id => newSet.has(id));
      groupMessageIds.forEach(id => {
        if (isAllSelected) newSet.delete(id);
        else newSet.add(id);
      });
      return newSet;
    });
  };

  const selectedMessages = () =>
    Array.from(selectedMessageIds)
      .map(id => messages.find(m => getMessageId(m) === id) || null)
      .filter(Boolean);

  const runOnSelection = async (
    handler?: (messages: any[]) => void | Promise<void>
  ) => {
    if (selectedMessageIds.size === 0 || !handler) return;
    await handler(selectedMessages());
    setSelectedMessageIds(new Set());
  };

  // A sender group's menu (right click, long press on its header).
  const groupMenu = useRowMenu<string>();

  useEffect(() => {
    const groupedMessageIds = new Set<string>();
    groupedMessages.forEach(group => {
      group.messages.forEach(message => {
        const messageId = getMessageId(message);
        if (messageId) groupedMessageIds.add(messageId);
      });
    });
    setSelectedMessageIds(previous => {
      const next = new Set(Array.from(previous).filter(id => groupedMessageIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [groupedMessages]);

  if (!groupedMessages.length) {
    if (status === "loading" || status === "idle") {
      return <ListSkeleton rows={6} />;
    }
    if (status === "error") {
      return (
        <ErrorState
          title="Couldn't load this mailbox"
          message={errorMessage || "The node did not answer. Check your connection and try again."}
          onRetry={onRetry}
        />
      );
    }
    return (
      <EmptyState
        icon={emptyIcon ?? <InboxOutlinedIcon />}
        title={emptyTitle || (mailboxType === "sent" ? "No sent mail yet" : "No mail yet")}
        hint={emptyHint}
        action={emptyAction}
      />
    );
  }

  const hasBulkActions = Boolean(onMarkAsRead || onMarkAsUnread || onArchive || onUnarchive);
  const selectable = showSelectAll || hasBulkActions;
  // Each row's menu offers what this list can do with one message.
  const rowActions = {
    onReply: mailboxType === "sent" ? undefined : onReply,
    onForward,
    onMarkAsRead: mailboxType === "sent" ? undefined : onMarkAsRead,
    onMarkAsUnread: mailboxType === "sent" ? undefined : onMarkAsUnread,
    onArchive,
    onUnarchive,
  };
  const groupMenuContent = (groupKey: string) => {
    const group = groupedMessages.find(g => g.key === groupKey);
    const all = group?.messages || [];
    const ids = all.map(getMessageId).filter(Boolean) as string[];
    const unread = mailboxType === "sent" ? 0 : all.filter(message => !isMessageRead(message, readState)).length;
    const forAll = (handler?: (messages: any[]) => void | Promise<void>) =>
      handler && all.length ? () => void handler(all) : undefined;
    return {
      title: !group ? undefined : mailboxType === "sent" ? (
        `To: ${group.label}`
      ) : group.key === "sender:unknown" ? (
        group.label
      ) : (
        <NameText name={group.label} />
      ),
      ariaLabel: "Group actions",
      actions: groupRowActions({
        count: all.length,
        unreadCount: unread,
        expanded: Boolean(expandedGroups[groupKey]),
        allSelected: ids.length > 0 && ids.every(id => selectedMessageIds.has(id)),
        toggleExpanded: () => setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] })),
        markRead: mailboxType === "sent" ? undefined : forAll(onMarkAsRead),
        markUnread: mailboxType === "sent" ? undefined : forAll(onMarkAsUnread),
        archive: forAll(onArchive),
        unarchive: forAll(onUnarchive),
        toggleSelected: selectable ? () => handleToggleAll(groupKey) : undefined,
      }),
    };
  };
  const bulkButtonSx = { minHeight: 44, textTransform: "none", fontWeight: 600 } as const;

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", minWidth: 0 }}>
      {showSelectAll && allVisibleMessageIds.length > 0 && (
        <Box
          sx={theme => ({
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            minHeight: 44,
            borderBottom: `1px solid ${theme.palette.divider}`,
          })}
        >
          <Checkbox
            checked={areAllVisibleSelected}
            indeterminate={isVisibleSelectionIndeterminate}
            onChange={handleToggleSelectAllVisible}
            slotProps={{ input: { "aria-label": "Select all messages" } }}
            sx={checkboxSx}
          />
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600 }}>Select all</Typography>
          <Typography
            sx={{ ml: "auto", fontSize: "0.875rem", color: "text.secondary", whiteSpace: "nowrap" }}
          >
            {selectedVisibleCount}/{allVisibleMessageIds.length} selected
          </Typography>
        </Box>
      )}

      <Box
        component="ul"
        aria-label={mailboxType === "sent" ? "Sent messages by recipient" : "Messages by sender"}
        sx={{ listStyle: "none", m: 0, p: 0, width: "100%", minWidth: 0 }}
      >
      {groupedMessages.map(group => {
        const isExpandableGroup = group.messages.length > 1;
        const isExpanded = Boolean(expandedGroups[group.key]);
        const latestMessage = group.messages[0];
        const isAliasGroup =
          mailboxType === "sent" && group.key.startsWith("alias:");
        const groupMessageIds = group.messages
          .map(getMessageId)
          .filter(Boolean) as string[];
        const unreadCount =
          mailboxType === "sent"
            ? 0
            : group.messages.filter(message => !isMessageRead(message, readState)).length;
        const groupHasUnread = unreadCount > 0;
        const selectedCount = groupMessageIds.filter(id =>
          selectedMessageIds.has(id)
        ).length;
        const isGroupChecked =
          groupMessageIds.length > 0 && selectedCount === groupMessageIds.length;
        const isGroupIndeterminate =
          selectedCount > 0 && selectedCount < groupMessageIds.length;

        if (!isExpandableGroup) {
          const messageId = getMessageId(latestMessage);
          return (
            <Box key={group.key} component="li" data-group={group.key}>
              <MailMessageRow
                messageData={latestMessage}
                openMessage={openMessage}
                isFromSent={mailboxType === "sent"}
                selected={selectedMessageIds.has(messageId)}
                onToggleSelected={selectable ? () => handleToggleMessage(messageId) : undefined}
                onDeleteMessage={mailboxType === "sent" ? onDeleteMessage : undefined}
                isDeleting={
                  mailboxType === "sent" && Boolean(messageId) && isDeletingMessage
                    ? isDeletingMessage(messageId)
                    : false
                }
                {...rowActions}
                isOpen={
                  openedMessageId !== null &&
                  openedMessageId !== undefined &&
                  String(openedMessageId) === String(messageId)
                }
                highlightTerms={highlightTerms}
              />
            </Box>
          );
        }

        const decryptedRecipient =
          mailboxType === "sent"
            ? group.messages
                .map(message => {
                  const copy: any = hashMapMailMessages[getMessageId(message)];
                  return copy?.isValid && typeof copy?.recipient === "string"
                    ? copy.recipient.trim()
                    : "";
                })
                .find(Boolean)
            : "";
        const label = mailboxType === "sent" ? `To: ${decryptedRecipient || group.label}` : group.label;
        // Received groups are labelled by the sender's name.
        const spokenGroup = mailboxType === "sent" || group.key === "sender:unknown" ? group.label : spokenName(group.label);
        const summary = `${group.messages.length} messages${
          groupHasUnread ? ` · ${unreadCount} unread` : ""
        }`;

        return (
          <Box key={group.key} component="li" data-group={group.key} sx={{ display: "flex", flexDirection: "column" }}>
            <Box
              {...groupMenu.triggerFor(group.key)}
              sx={theme => ({
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                borderBottom: `1px solid ${theme.palette.divider}`,
                WebkitTouchCallout: "none",
              })}
            >
              {selectable && (
                <Checkbox
                  checked={isGroupChecked}
                  indeterminate={isGroupIndeterminate}
                  onChange={() => handleToggleAll(group.key)}
                  slotProps={{ input: { "aria-label": `Select all from ${spokenGroup}` } }}
                  sx={checkboxSx}
                />
              )}
              <ButtonBase
                onClick={() =>
                  setExpandedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))
                }
                aria-expanded={isExpanded}
                sx={theme => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  gap: 1.5,
                  px: selectable ? 1 : 2,
                  py: 1,
                  borderRadius: theme.shape.borderRadius,
                  transition: "background-color 150ms ease",
                  "&:hover": { backgroundColor: theme.palette.action.hover },
                  "&:focus-visible": {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                })}
              >
                <Box sx={{ flexShrink: 0, display: "flex" }}>
                  <AvatarWrapper
                    isAlias={isAliasGroup}
                    height="40px"
                    user={group.label}
                    fallback={group.label}
                  />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                    {groupHasUnread && <UnreadDot />}
                    <Typography
                      noWrap
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "1rem",
                        lineHeight: 1.3,
                        fontWeight: groupHasUnread ? 700 : 500,
                      }}
                    >
                      {mailboxType === "sent" ? (
                        <SentGroupLabel
                          identifier={getMessageId(latestMessage)}
                          known={decryptedRecipient}
                        />
                      ) : group.key === "sender:unknown" ? (
                        label
                      ) : (
                        <NameText name={group.label} />
                      )}
                    </Typography>
                  </Box>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: "0.875rem",
                      lineHeight: 1.35,
                      color: "text.secondary",
                      fontWeight: groupHasUnread ? 600 : 400,
                    }}
                  >
                    {summary}
                  </Typography>
                </Box>
                <MailListDate
                  timestamp={latestMessage?.createdAt}
                  emphasis={groupHasUnread}
                  detailPrefix="Latest: "
                  stacked
                  inlineFrom={WIDE_ROW_QUERY}
                />
                <ExpandMoreIcon
                  aria-hidden
                  sx={{
                    color: "text.secondary",
                    flexShrink: 0,
                    transition: "transform 150ms ease",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                  }}
                />
              </ButtonBase>
            </Box>
            {isExpanded && (
              <Box
                component="ul"
                aria-label={mailboxType === "sent" ? `Messages to ${group.label}` : `Messages from ${spokenGroup}`}
                sx={{ listStyle: "none", m: 0, p: 0, pl: { xs: 0, sm: 3 }, display: "flex", flexDirection: "column" }}
              >
                {group.messages.map(message => {
                  const messageId = getMessageId(message);
                  return (
                    <MailMessageRow
                      key={messageId}
                      component="li"
                      messageData={message}
                      openMessage={openMessage}
                      isFromSent={mailboxType === "sent"}
                      compact
                      selected={selectedMessageIds.has(messageId)}
                      onToggleSelected={
                        selectable ? () => handleToggleMessage(messageId) : undefined
                      }
                      onDeleteMessage={mailboxType === "sent" ? onDeleteMessage : undefined}
                      isDeleting={
                        mailboxType === "sent" && Boolean(messageId) && isDeletingMessage
                          ? isDeletingMessage(messageId)
                          : false
                      }
                      {...rowActions}
                      isOpen={
                        openedMessageId !== null &&
                        openedMessageId !== undefined &&
                        String(openedMessageId) === String(messageId)
                      }
                      highlightTerms={highlightTerms}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
      </Box>

      {footer}
      {groupMenu.renderMenu(groupMenuContent)}

      {selectedMessageIds.size > 0 && hasBulkActions && (
        <Box
          role="toolbar"
          aria-label="Selected messages"
          sx={theme => ({
            position: "sticky",
            bottom: 0,
            zIndex: 2,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1,
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: headerFill(theme, "chromeStrong"),
            backdropFilter: "blur(12px)",
          })}
        >
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, mr: "auto" }}>
            {selectedMessageIds.size} selected
          </Typography>
          {onArchive && (
            <Button
              variant="outlined"
              startIcon={<ArchiveOutlinedIcon />}
              onClick={() => void runOnSelection(onArchive)}
              sx={bulkButtonSx}
            >
              Archive
            </Button>
          )}
          {onUnarchive && (
            <Button
              variant="outlined"
              startIcon={<UnarchiveOutlinedIcon />}
              onClick={() => void runOnSelection(onUnarchive)}
              sx={bulkButtonSx}
            >
              Move to inbox
            </Button>
          )}
          {onMarkAsUnread && (
            <Button
              variant="outlined"
              startIcon={<MarkEmailUnreadOutlinedIcon />}
              onClick={() => void runOnSelection(onMarkAsUnread)}
              sx={bulkButtonSx}
            >
              Mark as unread
            </Button>
          )}
          {onMarkAsRead && (
            <Button
              variant="contained"
              startIcon={<CheckIcon />}
              onClick={() => void runOnSelection(onMarkAsRead)}
              sx={bulkButtonSx}
            >
              Mark as read
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};
