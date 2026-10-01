/**
 * The Drafts mailbox: every compose draft saved on this device for the
 * signed-in address (mail and group thread posts), newest first, with Open
 * and Delete. Drafts live in localStorage only (data contract §12), so there
 * is nothing to fetch and no loading state; the list refreshes whenever the
 * composer saves.
 */
import { useCallback, useEffect, useState } from "react";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import useConfirmationModal from "../../hooks/useConfirmModal";
import { EmptyState } from "../../layout/states";
import { formatTimestamp } from "../../utils/time";
import {
  deleteComposeDraft,
  draftSnippet,
  listComposeDrafts,
  subscribeToComposeDrafts,
  type ComposeDraftListItem,
  type StoredComposeDraft,
} from "./composeDrafts";

const Row = styled("li")(({ theme }) => ({
  listStyle: "none",
  display: "flex",
  alignItems: "stretch",
  gap: theme.spacing(0.5),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Open = styled(ButtonBase)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  minHeight: 64,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "center",
  gap: 2,
  textAlign: "left",
  padding: theme.spacing(1.25, 1, 1.25, 2),
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const Line = styled("span")({
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
});

const Ellipsis = styled("span")({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export function describeDraftTarget(draft: StoredComposeDraft): string {
  if (draft.kind === "thread") {
    const where = draft.groupName || draft.toName;
    return draft.threadId ? `Post in ${where}` : `New thread in ${where}`;
  }
  if (draft.replyTo?.id) return `Reply to ${draft.toName}`;
  return `To ${draft.toName}`;
}

/** Live count of drafts for a badge. */
export function useComposeDraftCount(address: string): number {
  const [count, setCount] = useState(() => listComposeDrafts(address).length);
  useEffect(() => {
    const refresh = () => setCount(listComposeDrafts(address).length);
    refresh();
    return subscribeToComposeDrafts(refresh);
  }, [address]);
  return count;
}

export interface DraftsMailboxProps {
  address: string;
  onOpenDraft: (key: string, draft: StoredComposeDraft) => void;
}

export function DraftsMailbox({ address, onOpenDraft }: DraftsMailboxProps) {
  const [drafts, setDrafts] = useState<ComposeDraftListItem[]>(() => listComposeDrafts(address));
  const [pendingDelete, setPendingDelete] = useState<ComposeDraftListItem | null>(null);

  useEffect(() => {
    const refresh = () => setDrafts(listComposeDrafts(address));
    refresh();
    return subscribeToComposeDrafts(refresh);
  }, [address]);

  const { Modal, showModal } = useConfirmationModal({
    title: "Delete draft?",
    message: pendingDelete
      ? `"${pendingDelete.draft.subject.trim() || "(no subject)"}" (${describeDraftTarget(
          pendingDelete.draft
        )}) will be removed from this device.`
      : "",
    confirmLabel: "Delete",
    destructive: true,
  });

  const requestDelete = useCallback(
    async (item: ComposeDraftListItem) => {
      setPendingDelete(item);
      const confirmed = await showModal();
      setPendingDelete(null);
      if (!confirmed) return;
      deleteComposeDraft(address, item.key);
      setDrafts(listComposeDrafts(address));
    },
    [address, showModal]
  );

  if (!drafts.length) {
    return (
      <>
        <EmptyState
          icon={<DraftsOutlinedIcon />}
          title="No drafts"
          hint="Messages you start are saved here on this device as you write."
        />
        <Modal />
      </>
    );
  }

  return (
    <>
      <Box component="ul" aria-label="Drafts" sx={{ width: "100%", m: 0, p: 0 }}>
        {drafts.map(item => {
          const { key, draft } = item;
          const subject = draft.subject.trim() || "(no subject)";
          const snippet = draftSnippet(draft.value);
          const attachmentCount = draft.attachments?.length || 0;
          return (
            <Row key={key}>
              <Open
                onClick={() => onOpenDraft(key, draft)}
                aria-label={`Open draft: ${subject}, ${describeDraftTarget(draft)}`}
              >
                <Line>
                  {draft.kind === "thread" && (
                    <ForumOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  )}
                  <Ellipsis>
                    <Typography component="span" sx={{ fontWeight: 650, fontSize: "0.95rem" }}>
                      {describeDraftTarget(draft)}
                    </Typography>
                  </Ellipsis>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {draft.updatedAt ? formatTimestamp(draft.updatedAt) : ""}
                  </Typography>
                </Line>
                <Line>
                  <Ellipsis>
                    <Typography component="span" sx={{ fontSize: "0.95rem" }}>
                      {subject}
                    </Typography>
                  </Ellipsis>
                  {attachmentCount > 0 && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}
                    >
                      <AttachFileIcon sx={{ fontSize: 14 }} />
                      {attachmentCount}
                    </Typography>
                  )}
                </Line>
                {snippet && (
                  <Ellipsis>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {snippet}
                    </Typography>
                  </Ellipsis>
                )}
                {draft.fromName && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    From {draft.fromName}
                  </Typography>
                )}
              </Open>
              <IconButton
                aria-label={`Delete draft: ${subject}`}
                onClick={() => void requestDelete(item)}
                sx={{ alignSelf: "center", minWidth: 44, minHeight: 44, mr: 0.5 }}
              >
                <DeleteOutlineOutlinedIcon />
              </IconButton>
            </Row>
          );
        })}
      </Box>
      <Modal />
    </>
  );
}
