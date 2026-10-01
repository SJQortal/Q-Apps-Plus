/**
 * Opens a message that is not decrypted yet, inside the reading pane: waits
 * for the MAIL_PRIVATE resource to be READY (useResourceReady: one status
 * call, then a polite 5 s poll while Core fetches from peers), shows the
 * shared FetchingFromPeers state with progress, then fetchAndEvaluateMail,
 * and resolves the caller's modal promise with the decrypted message
 * exactly as the old dialog did (handleClose(message) on success,
 * handleClose() on cancel). Errors show ErrorState with Retry (Bugs #3).
 */
import { Box, Button, Typography } from "@mui/material";
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

  // Stays enabled while decrypting: disabling it would reset its phase and
  // cancel the decrypt effect below.
  const resource = useResourceReady(ref, { enabled: open && Boolean(ref) });

  const saveToHash = React.useCallback(
    (payload: any) => {
      dispatch(addToHashMapMail(payload));
    },
    [dispatch]
  );

  // A decrypt run is cancelled only when the message, the attempt or `open`
  // changes, not when the resource hook re-checks its status mid-run.
  const activeRunRef = React.useRef<{ cancelled: boolean } | null>(null);
  React.useEffect(() => {
    return () => {
      if (activeRunRef.current) activeRunRef.current.cancelled = true;
      activeRunRef.current = null;
    };
  }, [open, ref?.identifier, attempt]);

  React.useEffect(() => {
    if (!open || !ref || resource.phase !== "ready") return;
    const runKey = `${ref.identifier}#${attempt}`;
    if (startedRef.current === runKey) return;
    startedRef.current = runKey;
    const run = { cancelled: false };
    activeRunRef.current = run;
    setPhase("decrypting");
    void (async () => {
      try {
        const res = await fetchAndEvaluateMail(
          { user: ref.name, messageIdentifier: ref.identifier, content: fileInfo, otherUser: ref.name },
          saveToHash,
          username
        );
        if (run.cancelled) return;
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
        if (!run.cancelled) setPhase("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref, resource.phase, attempt]);

  if (!open) return null;

  const retry = () => {
    setPhase("waiting");
    setAttempt((n) => n + 1);
    resource.retry();
  };

  const stalled = resource.status?.status === "MISSING_DATA" || resource.status?.status === "FAILED";
  const resourceStatus = resource.phase === "ready" ? "BUILDING" : resource.status?.status;
  const sender = fileInfo?.name ? `From ${fileInfo.name}` : "";

  return (
    <Box
      role="region"
      aria-label="Opening message"
      sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, py: 3, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}
    >
      {(phase === "waiting" || phase === "decrypting") && resource.phase !== "error" && (
        <>
          <Typography sx={{ fontWeight: 600 }}>Opening message</Typography>
          {sender && (
            <Typography variant="body2" color="text.secondary">
              {sender}
            </Typography>
          )}
          <FetchingFromPeers
            status={phase === "decrypting" ? "BUILDING" : resourceStatus}
            percentLoaded={resource.status?.percentLoaded}
            onRetry={stalled ? retry : undefined}
          />
        </>
      )}
      {phase === "unableToDecrypt" && (
        <ErrorState title="This message can't be decrypted" message="It was not encrypted to your key." onRetry={retry} />
      )}
      {phase === "invalid" && <ErrorState title="This message has an unexpected format" message="It may have been published by another app." />}
      {phase === "failed" && (
        <ErrorState title="The message could not be opened" message="Check that your node is running, then try again." onRetry={retry} />
      )}
      {resource.phase === "error" && phase === "waiting" && (
        <ErrorState title="The message could not be fetched" message={resource.error || undefined} onRetry={retry} />
      )}
      <Button variant="text" onClick={() => handleClose()} sx={{ alignSelf: "flex-start", minHeight: 44 }}>
        Cancel
      </Button>
    </Box>
  );
};
