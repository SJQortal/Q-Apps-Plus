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
import { MailListDate } from "./MailListDate";
import { NameText, spokenName } from "../../components/common/NameText";
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

export function describeDraftTarget(draft: StoredComposeDraft, nameOf: (name: string) => string = name => name): string {
  if (draft.kind === "thread") {
    const where = draft.groupName || draft.toName;
    return draft.threadId ? `Post in ${where}` : `New thread in ${where}`;
  }
  if (draft.replyTo?.id) return `${draft.replyAll ? "Reply all" : "Reply"} to ${nameOf(draft.toName)}`;
  return `To ${nameOf(draft.toName)}`;
}

/** describeDraftTarget on screen: the name drawn by NameText (thread drafts name a group). */
function DraftTarget({ draft }: { draft: StoredComposeDraft }) {
  if (draft.kind === "thread") return <>{describeDraftTarget(draft)}</>;
  const lead = draft.replyTo?.id ? `${draft.replyAll ? "Reply all" : "Reply"} to ` : "To ";
  return (
    <>
      {lead}
      <NameText name={draft.toName} />
    </>
  );
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
  /** Group threads are hidden (Settings): thread drafts stay stored but out of the list. */
  hideThreadDrafts?: boolean;
}

export function DraftsMailbox({ address, onOpenDraft, hideThreadDrafts = false }: DraftsMailboxProps) {
  const [allDrafts, setDrafts] = useState<ComposeDraftListItem[]>(() => listComposeDrafts(address));
  const drafts = hideThreadDrafts ? allDrafts.filter(item => item.draft.kind !== "thread") : allDrafts;
  const [pendingDelete, setPendingDelete] = useState<ComposeDraftListItem | null>(null);

  useEffect(() => {
    const refresh = () => setDrafts(listComposeDrafts(address));
    refresh();
    return subscribeToComposeDrafts(refresh);
  }, [address]);

  const { Modal, showModal } = useConfirmationModal({
    title: "Delete draft?",
    message: pendingDelete ? (
      <>
        &quot;{pendingDelete.draft.subject.trim() || "(no subject)"}&quot; (<DraftTarget draft={pendingDelete.draft} />)
        will be removed from this device.
      </>
    ) : (
      ""
    ),
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
                aria-label={`Open draft: ${subject}, ${describeDraftTarget(draft, spokenName)}`}
              >
                {/* Spans, not divs: this is inside a button. The day sits over the time beside the first two lines. */}
                <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Box component="span" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <Line>
                      {draft.kind === "thread" && (
                        <ForumOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                      )}
                      <Ellipsis>
                        <Typography component="span" sx={{ fontWeight: 650, fontSize: "0.95rem" }}>
                          <DraftTarget draft={draft} />
                        </Typography>
                      </Ellipsis>
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
                          sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, flexShrink: 0, fontSize: "0.875rem" }}
                        >
                          <AttachFileIcon sx={{ fontSize: 14 }} />
                          {attachmentCount}
                        </Typography>
                      )}
                    </Line>
                  </Box>
                  <MailListDate timestamp={draft.updatedAt} detailPrefix="Saved " stacked />
                </Box>
                {snippet && (
                  <Ellipsis>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {snippet}
                    </Typography>
                  </Ellipsis>
                )}
                {draft.fromName && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                    From <NameText name={draft.fromName} />
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
