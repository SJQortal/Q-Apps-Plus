import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Box, CircularProgress, Typography } from "@mui/material";
import { THREAD_SERVICE_TYPE } from "../../constants/mail";
import { formatFullTimestamp } from "../../utils/time";

interface GroupOption {
  id: string | number;
  name: string;
}

interface ThreadSummary {
  identifier: string;
  threadId: string;
  created: number;
  threadOwner: string;
  threadData: {
    title: string;
    groupId: string;
    createdAt: number;
    name: string;
  };
  groupName: string;
}

interface ThreadsMailboxProps {
  groups: GroupOption[];
  groupAvatarUrlById?: Record<string, string>;
  isLoadingGroups?: boolean;
  onOpenThread: (thread: ThreadSummary, group: GroupOption) => void;
}

const toNumber = (value: any): number => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const fetchThreadTitle = async (resource: any): Promise<string> => {
  const metadataTitle =
    typeof resource?.metadata?.description === "string"
      ? resource.metadata.description.trim()
      : "";
  if (metadataTitle) {
    return metadataTitle;
  }

  try {
    const threadResource = await qortalRequest({
      action: "FETCH_QDN_RESOURCE",
      name: resource?.name,
      service: THREAD_SERVICE_TYPE,
      identifier: resource?.identifier,
    });
    const fallbackTitle =
      typeof threadResource?.title === "string" ? threadResource.title.trim() : "";
    return fallbackTitle;
  } catch {
    return "";
  }
};

const fetchThreadsForGroup = async (group: GroupOption): Promise<ThreadSummary[]> => {
  const groupId = String(group?.id || "").trim();
  const groupName = typeof group?.name === "string" ? group.name.trim() : "";
  if (!groupId || !groupName) return [];

  try {
    const params = new URLSearchParams({
      mode: "ALL",
      service: THREAD_SERVICE_TYPE,
      query: `qortal_qmail_thread_group${groupId}`,
      limit: "60",
      includemetadata: "true",
      offset: "0",
      reverse: "true",
      excludeblocked: "true",
    });

    const response = await fetch(`/arbitrary/resources/search?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const responseData = await response.json();
    if (!Array.isArray(responseData) || responseData.length === 0) {
      return [];
    }

    const mapped = await Promise.all(
      responseData.map(async (resource: any) => {
        const identifier =
          typeof resource?.identifier === "string" ? resource.identifier.trim() : "";
        if (!identifier) return null;

        const ownerName = typeof resource?.name === "string" ? resource.name.trim() : "";
        const createdAt = toNumber(resource?.created);
        const title = (await fetchThreadTitle(resource)) || "Untitled thread";

        const threadSummary: ThreadSummary = {
          identifier,
          threadId: identifier,
          created: createdAt,
          threadOwner: ownerName,
          threadData: {
            title,
            groupId,
            createdAt,
            name: ownerName,
          },
          groupName,
        };

        return threadSummary;
      })
    );

    return mapped.filter(Boolean) as ThreadSummary[];
  } catch {
    return [];
  }
};

export const ThreadsMailbox = ({
  groups,
  groupAvatarUrlById,
  isLoadingGroups = false,
  onOpenThread,
}: ThreadsMailboxProps) => {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);

  const normalizedGroups = useMemo(() => {
    const deduped = new Map<string, GroupOption>();
    groups.forEach(group => {
      const groupId = String(group?.id || "").trim();
      const groupName = typeof group?.name === "string" ? group.name.trim() : "";
      if (!groupId || !groupName || deduped.has(groupId)) return;
      deduped.set(groupId, {
        id: groupId,
        name: groupName,
      });
    });
    return Array.from(deduped.values());
  }, [groups]);

  useEffect(() => {
    if (!normalizedGroups.length) {
      setThreads([]);
      setIsLoadingThreads(false);
      return;
    }

    let cancelled = false;
    const loadCombinedThreads = async () => {
      setIsLoadingThreads(true);
      try {
        const results = await Promise.all(
          normalizedGroups.map(group => fetchThreadsForGroup(group))
        );

        if (cancelled) return;

        const threadMap = new Map<string, ThreadSummary>();
        results.flat().forEach(thread => {
          if (!thread?.identifier) return;
          const existingThread = threadMap.get(thread.identifier);
          if (!existingThread) {
            threadMap.set(thread.identifier, thread);
            return;
          }
          if (toNumber(thread?.threadData?.createdAt) > toNumber(existingThread?.threadData?.createdAt)) {
            threadMap.set(thread.identifier, thread);
          }
        });

        const sortedThreads = Array.from(threadMap.values()).sort((a, b) => {
          return toNumber(b?.threadData?.createdAt) - toNumber(a?.threadData?.createdAt);
        });

        setThreads(sortedThreads);
      } finally {
        if (!cancelled) {
          setIsLoadingThreads(false);
        }
      }
    };

    void loadCombinedThreads();
    return () => {
      cancelled = true;
    };
  }, [normalizedGroups]);

  if (isLoadingGroups || isLoadingThreads) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "220px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!normalizedGroups.length) {
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
          No groups with threads available.
        </Typography>
      </Box>
    );
  }

  if (!threads.length) {
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
          No threads to display.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1254px",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {threads.map(thread => {
        const groupId = String(thread?.threadData?.groupId || "").trim();
        const group = normalizedGroups.find(item => String(item.id) === groupId);
        if (!group) return null;

        const groupAvatar = groupAvatarUrlById?.[groupId] || undefined;
        const groupName = thread.groupName || group.name;
        const ownerName = thread?.threadData?.name || "Unknown";
        const threadTitle = thread?.threadData?.title || "Untitled thread";

        return (
          <Box
            key={thread.identifier}
            onClick={() => {
              onOpenThread(thread, group);
            }}
            sx={{
              width: "100%",
              borderRadius: "12px",
              border: "1px solid var(--qmail-shell-border)",
              background: "var(--qmail-thread-card-bg)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 12px",
              cursor: "pointer",
              transition: "background 0.2s ease, border-color 0.2s ease",
              "&:hover": {
                background: "var(--qmail-thread-card-hover)",
                borderColor: "var(--qmail-shell-active-strong)",
              },
            }}
          >
            <Avatar
              src={groupAvatar}
              alt={groupName}
              sx={{
                width: "42px",
                height: "42px",
                background: "var(--qmail-shell-hover-strong)",
                color: "var(--qmail-thread-text)",
                border: "1px solid var(--qmail-shell-border)",
                fontSize: "0.95rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {groupName.charAt(0).toUpperCase()}
            </Avatar>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                flex: 1,
                gap: "2px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "1.05rem",
                  fontWeight: 650,
                  color: "var(--qmail-thread-text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {threadTitle}
              </Typography>
              <Typography
                sx={{
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  color: "var(--qmail-thread-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {groupName} · by {ownerName}
              </Typography>
            </Box>
            <Typography
              sx={{
                flexShrink: 0,
                fontSize: "0.85rem",
                color: "var(--qmail-thread-muted)",
                textAlign: "right",
                minWidth: "160px",
              }}
            >
              {formatFullTimestamp(thread?.threadData?.createdAt)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};
