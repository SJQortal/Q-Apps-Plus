import React, { useEffect, useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Typography, Checkbox, Button } from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { formatFullTimestamp } from "../../utils/time";
import { MailMessageRow } from "./MailMessageRow";
import { AvatarWrapper } from "./MailTable";
import { MessagesContainer } from "./Mail-styles";
import {
  getSentRecipientDisplayLabel,
  getSentRecipientGroupKey,
} from "./mailIdentifier";

type MailboxType = "inbox" | "sent";

interface GroupedMailboxListProps {
  messages: any[];
  mailboxType: MailboxType;
  showSelectAll?: boolean;
  openMessage: (
    user: string,
    identifier: string,
    content: any,
    alias?: string
  ) => void | Promise<void>;
  openedMessageId?: string | number | null;
  onDeleteMessage?: (message: any) => void | boolean | Promise<void | boolean>;
  isDeletingMessage?: (messageId: string) => boolean;
  onMarkAsRead?: (messages: any[]) => void | Promise<void>;
  onMarkAsUnread?: (messages: any[]) => void | Promise<void>;
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

const isMessageMarkedRead = (message: any): boolean => {
  const thread = message?.generalData?.threadV2;
  return Array.isArray(thread) && thread.length > 0;
};

export const GroupedMailboxList = ({
  messages,
  mailboxType,
  openMessage,
  openedMessageId,
  onDeleteMessage,
  isDeletingMessage,
  showSelectAll = false,
  onMarkAsRead,
  onMarkAsUnread,
}: GroupedMailboxListProps) => {
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set()
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  const groupedMessages = useMemo(() => {
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
  }, [messages, mailboxType]);

  const allVisibleMessageIds = useMemo(() => {
    return groupedMessages.flatMap(group =>
      group.messages
        .map(getMessageId)
        .filter(Boolean) as string[]
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
      const isAllSelected =
        allVisibleMessageIds.length > 0 &&
        allVisibleMessageIds.every(id => newSet.has(id));

      allVisibleMessageIds.forEach(id => {
        if (isAllSelected) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
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
        if (isAllSelected) {
          newSet.delete(id);
          return;
        }
        newSet.add(id);
      });
      return newSet;
    });
  };

  const handleMarkAsRead = async () => {
    if (selectedMessageIds.size === 0 || !onMarkAsRead) return;
    await onMarkAsRead(
      Array.from(selectedMessageIds)
        .map(id => {
          const message = messages.find(m => getMessageId(m) === id);
          return message || null;
        })
        .filter(Boolean)
    );
    setSelectedMessageIds(new Set());
  };

  const handleMarkAsUnread = async () => {
    if (selectedMessageIds.size === 0 || !onMarkAsUnread) return;
    await onMarkAsUnread(
      Array.from(selectedMessageIds)
        .map(id => {
          const message = messages.find(m => getMessageId(m) === id);
          return message || null;
        })
        .filter(Boolean)
    );
    setSelectedMessageIds(new Set());
  };

  useEffect(() => {
    const groupedMessageIds = new Set<string>();
    groupedMessages.forEach(group => {
      group.messages.forEach(message => {
        const messageId = getMessageId(message);
        if (messageId) groupedMessageIds.add(messageId);
      });
    });

    setSelectedMessageIds(previous => {
      return new Set(Array.from(previous).filter(id => groupedMessageIds.has(id)));
    });
  }, [groupedMessages]);

  if (!groupedMessages.length) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "220px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--qmail-thread-subtle-text)",
        }}
      >
        <Typography sx={{ fontSize: "1rem", fontWeight: 500 }}>
          No messages to display.
        </Typography>
      </Box>
    );
  }

  return (
    <MessagesContainer>
      {showSelectAll && allVisibleMessageIds.length > 0 && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            border: "1px solid var(--qmail-shell-border)",
            borderRadius: "10px",
            background: "var(--qmail-shell-hover)",
            padding: "10px 14px",
            marginBottom: "10px",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
            }}
          >
            <Checkbox
              checked={areAllVisibleSelected}
              indeterminate={isVisibleSelectionIndeterminate}
              onChange={handleToggleSelectAllVisible}
              sx={{
                color: "var(--qmail-action-primary-text)",
                "&.Mui-checked": {
                  color: "var(--qmail-action-primary-text)",
                },
              }}
            />
            <Typography
              sx={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--qmail-thread-text)",
              }}
            >
              Select all
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: "0.85rem",
              color: "var(--qmail-thread-subtle-text)",
              whiteSpace: "nowrap",
            }}
          >
            {selectedVisibleCount}/{allVisibleMessageIds.length} selected
          </Typography>
        </Box>
      )}
      {groupedMessages.map(group => {
        const isExpandableGroup = group.messages.length > 1;
        const isExpanded = Boolean(expandedGroups[group.key]);
        const latestMessage = group.messages[0];
        const latestMessageDate = formatFullTimestamp(latestMessage?.createdAt);
        const isAliasGroup =
          mailboxType === "sent" && group.key.startsWith("alias:");
        const groupMessageIds = group.messages
          .map(getMessageId)
          .filter(Boolean) as string[];
        const groupHasUnread = group.messages.some(
          message => !isMessageMarkedRead(message)
        );
        const selectedCount = groupMessageIds.filter(id =>
          selectedMessageIds.has(id)
        ).length;
        const isGroupChecked =
          groupMessageIds.length > 0 && selectedCount === groupMessageIds.length;
        const isGroupIndeterminate =
          selectedCount > 0 && selectedCount < groupMessageIds.length;

        return (
          <Box
            key={group.key}
            sx={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <Box
              onClick={() => {
                if (!isExpandableGroup) {
                  const onlyMessage = group.messages[0];
                  const messageId = getMessageId(onlyMessage);
                  if (!messageId) return;
                  openMessage(
                    onlyMessage?.user,
                    messageId,
                    onlyMessage,
                    mailboxType === "sent" ? group.label : undefined
                  );
                  return;
                }
                setExpandedGroups(prev => ({
                  ...prev,
                  [group.key]: !prev[group.key],
                }));
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                width: "100%",
                borderRadius: "12px",
                cursor: "pointer",
                border: "1px solid var(--qmail-shell-border)",
                background: "var(--qmail-shell-hover)",
                padding: "10px 14px",
                "&:hover": {
                  background: "var(--qmail-shell-hover-strong)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Checkbox
                  checked={isGroupChecked}
                  indeterminate={isGroupIndeterminate}
                  onClick={event => {
                    event.stopPropagation();
                  }}
                  onChange={() => handleToggleAll(group.key)}
                  sx={{
                    color: "var(--qmail-action-primary-text)",
                    "&.Mui-checked": {
                      color: "var(--qmail-action-primary-text)",
                    },
                  }}
                />
                <AvatarWrapper
                  isAlias={isAliasGroup}
                  height="50px"
                  user={group.label}
                  fallback={group.label}
                />
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: "1rem",
                      fontWeight:
                        mailboxType === "sent"
                          ? 300
                          : groupHasUnread
                          ? 700
                          : 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mailboxType === "sent" ? "To: " : ""}
                    {group.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      color: "var(--qmail-thread-subtle-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.messages.length} message
                    {group.messages.length === 1 ? "" : "s"} •{" "}
                    {latestMessageDate}
                  </Typography>
                </Box>
              </Box>
              {isExpandableGroup && (
                <ExpandMoreIcon
                  sx={{
                    color: "var(--qmail-thread-subtle-text)",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(90deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              )}
            </Box>
            {isExpandableGroup && isExpanded && (
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  pl: {
                    xs: "0px",
                    md: "28px",
                  },
                }}
              >
                {group.messages.map(message => {
                  const messageId = getMessageId(message);
                  const isMessageSelected = selectedMessageIds.has(messageId);

                  return (
                    <Box
                      key={messageId}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        borderRadius: "8px",
                        padding: "6px 8px",
                        cursor: "pointer",
                        border: "1px solid var(--qmail-shell-border)",
                        background: "var(--qmail-shell-hover)",
                        "&:hover": {
                          background: "var(--qmail-shell-hover-strong)",
                        },
                      }}
                      onClick={() => handleToggleMessage(messageId)}
                    >
                      <Checkbox
                        checked={isMessageSelected}
                        onClick={event => {
                          event.stopPropagation();
                        }}
                        onChange={() => handleToggleMessage(messageId)}
                        sx={{
                          color: "var(--qmail-action-primary-text)",
                          "&.Mui-checked": {
                            color: "var(--qmail-action-primary-text)",
                          },
                        }}
                      />
                      <MailMessageRow
                        messageData={message}
                        openMessage={openMessage}
                        isFromSent={mailboxType === "sent"}
                        compact
                        useFullTimestamp
                        onDeleteMessage={
                          mailboxType === "sent" ? onDeleteMessage : undefined
                        }
                        isDeleting={
                          mailboxType === "sent" &&
                          Boolean(messageId) &&
                          isDeletingMessage
                            ? isDeletingMessage(String(messageId))
                            : false
                        }
                        isOpen={
                          openedMessageId !== null &&
                          openedMessageId !== undefined &&
                          String(openedMessageId) === String(messageId)
                        }
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
      {selectedMessageIds.size > 0 && (onMarkAsRead || onMarkAsUnread) && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            position: "sticky",
            bottom: 0,
            padding: "12px 16px",
            background:
              "linear-gradient(to top, var(--qmail-shell-bg), rgba(0,0,0,0))",
            zIndex: 2,
          }}
        >
          {onMarkAsUnread && (
            <Button
              onClick={handleMarkAsUnread}
              variant="outlined"
              sx={{
                fontWeight: 700,
                textTransform: "none",
                borderColor: "var(--qmail-shell-border)",
                color: "var(--qmail-thread-text)",
                background: "var(--qmail-shell-hover)",
                "&:hover": {
                  background: "var(--qmail-shell-hover-strong)",
                },
              }}
            >
              Mark as Unread ({selectedMessageIds.size})
            </Button>
          )}
          {onMarkAsRead && (
            <Button
              onClick={handleMarkAsRead}
              startIcon={<CheckIcon />}
              variant="contained"
              sx={{
                fontWeight: 700,
                textTransform: "none",
                color: "var(--qmail-action-primary-text)",
                background: "var(--qmail-action-primary-bg)",
                "&:hover": {
                  background: "var(--qmail-action-primary-hover-bg)",
                },
              }}
            >
              Mark as Read ({selectedMessageIds.size})
            </Button>
          )}
        </Box>
      )}
    </MessagesContainer>
  );
};
