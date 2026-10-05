import { Box, ListItemButton, Typography } from "@mui/material";
import { formatEmailDate, formatFullTimestamp } from "../../utils/time";
import { ThreadAvatar } from "./ThreadAvatar";
import { NameText } from "../../components/common/NameText";
import { lastActivityOf, type ThreadSummary } from "./threadData";

interface ThreadRowProps {
  thread: ThreadSummary;
  unread?: boolean;
  selected?: boolean;
  /** Second line, e.g. the group name on the overview. */
  context?: string;
  onOpen: (thread: ThreadSummary) => void;
}

/** One thread in a list: avatar, title (bold + dot when unread), who and when. */
export function ThreadRow({ thread, unread = false, selected = false, context, onOpen }: ThreadRowProps) {
  const title = thread.threadData?.title || "Untitled thread";
  const owner = thread.threadData?.name || thread.threadOwner || "Unknown";
  const when = lastActivityOf(thread);
  const replied = Boolean(thread.lastPostBy && thread.lastPostBy !== owner);
  const by = replied ? (
    <>
      <NameText name={thread.lastPostBy} /> replied
    </>
  ) : (
    <>
      by <NameText name={owner} />
    </>
  );
  const count = thread.postCount ? ` · ${thread.postCount} ${thread.postCount === 1 ? "post" : "posts"}` : "";

  return (
    <ListItemButton
      onClick={() => onOpen(thread)}
      selected={selected}
      aria-current={selected ? "true" : undefined}
      sx={(theme) => ({
        minHeight: 64,
        gap: 1.5,
        px: 2,
        py: 1,
        alignItems: "center",
        borderBottom: `1px solid ${theme.palette.divider}`,
        "&.Mui-selected": { backgroundColor: theme.qplus.primarySoft },
        "&.Mui-selected:hover": { backgroundColor: theme.qplus.primarySoft },
      })}
    >
      <ThreadAvatar name={owner} size={40} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          {unread && (
            <Box
              aria-label="Unread"
              role="img"
              sx={(theme) => ({
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: theme.palette.primary.main,
                flexShrink: 0,
              })}
            />
          )}
          <Typography
            noWrap
            sx={{ fontSize: "1rem", fontWeight: unread ? 700 : 500, color: "text.primary", minWidth: 0 }}
          >
            {title}
          </Typography>
        </Box>
        <Typography noWrap variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
          {context ? `${context} · ` : ""}
          {by}
          {count}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        color={unread ? "primary.main" : "text.secondary"}
        title={formatFullTimestamp(when)}
        sx={{ flexShrink: 0, fontSize: "0.875rem", fontWeight: unread ? 600 : 400 }}
      >
        {when ? formatEmailDate(when) : ""}
      </Typography>
    </ListItemButton>
  );
}
