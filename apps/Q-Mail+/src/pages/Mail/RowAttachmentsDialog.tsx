/**
 * A message's attachments from its row in a list (the paperclip, or
 * "Attachments" in the row's menu), without opening the message: the same
 * cards as the reader, with Open, Save and Save all.
 *
 * A message decrypted this session is used as it is. Otherwise it is fetched
 * and decrypted the way the reader's earlier messages are (earlierMessages.ts:
 * retries while the node gets it, kept for the session), and nothing else
 * changes: it is not marked read and not added to the session's mail cache,
 * unless "Open message" opens it (then the reader uses this copy).
 *
 * Its own chunk: loaded the first time a row's attachments are asked for.
 */
import { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapMail } from "../../state/features/mailSlice";
import type { RootState } from "../../state/store";
import { ResponsiveDialog } from "../../components/common/ResponsiveDialog";
import { AttachmentList, usableAttachments } from "../../components/AttachmentPreview/AttachmentList";
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
import { cachedEarlierMessage, loadEarlierMessage, type EarlierLoad, type EarlierReference } from "./earlierMessages";

const PROBLEM_TEXT: Record<Exclude<EarlierLoad["status"], "loaded" | "loading">, string> = {
  deleted: "The sender deleted this message.",
  unableToDecrypt: "This message was not sent to you, so it can't be opened.",
  unavailable: "Not available on your node right now.",
  failed: "This message could not be loaded.",
};

export interface RowAttachmentsDialogProps {
  open: boolean;
  onClose: () => void;
  /** The publisher (sender, or our own name for sent mail) and the identifier. */
  publisher: string;
  identifier: string;
  subject: string;
  /** Opens the message in the reader (from the copy decrypted here, at once). */
  onOpenMessage?: () => void;
}

export function RowAttachmentsDialog({ open, onClose, publisher, identifier, subject, onOpenMessage }: RowAttachmentsDialogProps) {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth?.user);
  const ownNames = useMemo(
    () =>
      [user?.name, ...(Array.isArray(user?.names) ? user.names.map((item: any) => item?.name) : [])].filter(
        (name): name is string => typeof name === "string" && Boolean(name)
      ),
    [user]
  );
  const reference = useMemo<EarlierReference>(
    () => ({ name: publisher, identifier, service: MAIL_SERVICE_TYPE }),
    [publisher, identifier]
  );
  const cached = useSelector((state: RootState) => cachedEarlierMessage(reference, state.mail.hashMapMailMessages));
  const [load, setLoad] = useState<EarlierLoad | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || cached) return;
    let alive = true;
    setLoad({ status: "loading" });
    void loadEarlierMessage(reference, { ownNames }).then(result => {
      if (alive) setLoad(result);
    });
    return () => {
      alive = false;
    };
  }, [open, cached, reference, ownNames, attempt]);

  const message = cached || (load?.status === "loaded" ? load.message : null);
  // A locked row knows no subject; once decrypted, the message does.
  const shownSubject = typeof message?.subject === "string" && message.subject ? message.subject : subject;
  const attachments = usableAttachments(message?.attachments);
  const problem = !message && load && load.status !== "loading" && load.status !== "loaded" ? load.status : null;

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={
        <Box sx={{ minWidth: 0 }}>
          Attachments
          <Typography noWrap variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
            {shownSubject}
          </Typography>
        </Box>
      }
      maxWidth="sm"
      fullWidth
      actions={
        <>
          {onOpenMessage && message && (
            <Button
              onClick={() => {
                // The opener finds this copy and shows it without fetching it again.
                if (!cached) dispatch(addToHashMapMail(message));
                onClose();
                onOpenMessage();
              }}
              sx={{ minHeight: 44 }}
            >
              Open message
            </Button>
          )}
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
        </>
      }
    >
      {message ? (
        attachments.length ? (
          <AttachmentList attachments={attachments} compact />
        ) : (
          <Typography color="text.secondary">This message has no attachments.</Typography>
        )
      ) : problem ? (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Typography color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
            {PROBLEM_TEXT[problem]}
          </Typography>
          {(problem === "unavailable" || problem === "failed") && (
            <Button variant="outlined" onClick={() => setAttempt(value => value + 1)} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          )}
        </Box>
      ) : (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 56 }}>
          <CircularProgress size={20} aria-hidden />
          <Typography color="text.secondary">Opening the message to find its attachments…</Typography>
        </Box>
      )}
    </ResponsiveDialog>
  );
}
