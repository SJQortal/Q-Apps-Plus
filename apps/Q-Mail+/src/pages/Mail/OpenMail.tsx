/**
 * Opens a message that is not decrypted yet: waits for the MAIL_PRIVATE
 * resource to be READY (useResourceReady: one status call, a polite 5 s poll
 * while Core fetches from peers), then fetchAndEvaluateMail, and resolves
 * the caller's modal promise with the decrypted message exactly as before.
 */
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import React from "react";
import { RootState } from "../../state/store";
import { useDispatch, useSelector } from "react-redux";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { addToHashMapMail } from "../../state/features/mailSlice";
import { ErrorState, FetchingFromPeers } from "../../layout/states";
import { useResourceReady } from "../../components/AttachmentPreview/useResourceReady";

interface OpenMailProps {
  open: boolean;
  handleClose: (payload?: any) => void;
  children?: React.ReactNode;
  fileInfo?: any;
  mimeTypeSaved?: string;
  disable?: boolean;
  mode?: string;
  otherUser?: string;
  customStyles?: any;
}

type OpenPhase = "waiting" | "decrypting" | "unableToDecrypt" | "invalid" | "failed";

export const OpenMail = ({ open, handleClose, fileInfo }: OpenMailProps) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const dispatch = useDispatch();
  const [phase, setPhase] = React.useState<OpenPhase>("waiting");
  const [attempt, setAttempt] = React.useState(0);
  const startedRef = React.useRef<string>("");

  const ref = React.useMemo(() => {
    if (!fileInfo?.identifier || !fileInfo?.name || !fileInfo?.service) return null;
    return { name: fileInfo.name, service: fileInfo.service, identifier: fileInfo.identifier };
  }, [fileInfo]);

  const resource = useResourceReady(ref, { enabled: open && Boolean(ref) && phase === "waiting" });

  const saveToHash = React.useCallback(
    (payload: any) => {
      dispatch(addToHashMapMail(payload));
    },
    [dispatch]
  );

  React.useEffect(() => {
    if (!open || !ref || resource.phase !== "ready") return;
    const runKey = `${ref.identifier}#${attempt}`;
    if (startedRef.current === runKey) return;
    startedRef.current = runKey;
    let cancelled = false;
    setPhase("decrypting");
    void (async () => {
      try {
        const res = await fetchAndEvaluateMail(
          { user: ref.name, messageIdentifier: ref.identifier, content: fileInfo, otherUser: ref.name },
          saveToHash,
          username
        );
        if (cancelled) return;
        if (!res) {
          setPhase("failed");
        } else if (res.unableToDecrypt) {
          setPhase("unableToDecrypt");
        } else if (res.isValid === false) {
          setPhase(res.fetchError ? "failed" : "invalid");
        } else {
          handleClose(res);
        }
      } catch {
        if (!cancelled) setPhase("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref, resource.phase, attempt]);

  const retry = () => {
    setPhase("waiting");
    setAttempt((n) => n + 1);
    resource.retry();
  };

  const stalled = resource.status?.status === "MISSING_DATA" || resource.status?.status === "FAILED";
  const resourceStatus = resource.phase === "ready" ? "BUILDING" : resource.status?.status;

  return (
    <Dialog open={open} onClose={() => handleClose()} aria-labelledby="open-mail-title" fullWidth maxWidth="xs">
      <DialogTitle id="open-mail-title">Opening message</DialogTitle>
      <DialogContent>
        {phase === "unableToDecrypt" && (
          <ErrorState title="This message can't be decrypted" message="It was not encrypted to your key." onRetry={retry} />
        )}
        {phase === "invalid" && (
          <ErrorState title="This message has an unexpected format" message="It may have been published by another app." />
        )}
        {phase === "failed" && (
          <ErrorState title="The message could not be opened" message="Check that your node is running, then try again." onRetry={retry} />
        )}
        {resource.phase === "error" && phase === "waiting" && (
          <ErrorState title="The message could not be fetched" message={resource.error || undefined} onRetry={retry} />
        )}
        {(phase === "waiting" || phase === "decrypting") && resource.phase !== "error" && (
          <Box sx={{ py: 1 }}>
            <FetchingFromPeers
              status={phase === "decrypting" ? "BUILDING" : resourceStatus}
              percentLoaded={resource.status?.percentLoaded}
              onRetry={stalled ? retry : undefined}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={() => handleClose()} sx={{ minHeight: 44 }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
