/**
 * Opens a message that is not decrypted yet, inside the reading pane: waits
 * for the MAIL_PRIVATE resource to be READY (useResourceReady: one status
 * call, quick 0.5 s / 1 s re-checks while Core builds a file it already has,
 * then a polite 5 s poll while Core fetches from peers), shows the
 * shared FetchingFromPeers state with progress, then fetchAndEvaluateMail,
 * and resolves the caller's modal promise with the decrypted message
 * exactly as the old dialog did (handleClose(message) on success,
 * handleClose() on cancel). Errors show ErrorState with Retry (Bugs #3).
 *
 * Resources not on the node (docs/QORTAL.md → Hub & GO pitfalls 14):
 * - not downloaded yet: "Fetching from peers…", and the fetch itself is
 *   asked again at 2, 4, 8 and 16 s;
 * - a "D" body: the sender removed it; the row leaves the inbox list;
 * - after those retries, three stalled polls or a node that stops
 *   answering: the row's sender and date with "Not available on your node
 *   right now" and a Retry, never an endless skeleton.
 */
import { Box, Button, Typography } from "@mui/material";
import React from "react";
import { RootState } from "../../state/store";
import { useDispatch, useSelector } from "react-redux";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { addToHashMapMail, removeMessages } from "../../state/features/mailSlice";
import { EmptyState, ErrorState, FetchingFromPeers } from "../../layout/states";
import { useResourceReady } from "../../components/AttachmentPreview/useResourceReady";
import { exactMailDate } from "./readerTime";
import { NameText } from "../../components/common/NameText";

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

type OpenPhase = "waiting" | "decrypting" | "unableToDecrypt" | "invalid" | "failed" | "deleted" | "unavailable";

/** Stalled status answers (MISSING_DATA / FAILED) in a row before the message is called unavailable. */
export const STALLED_POLLS_BEFORE_UNAVAILABLE = 3;
/** How many of fetchMail's 2/4/8/16 s retries the reader uses. */
export const FETCH_RETRIES = 4;

export const NOT_AVAILABLE_TITLE = "Not available on your node right now";

/**
 * One opener per message: a new message remounts it, so the last message's
 * outcome (removed, undecryptable) and resource state never carry over.
 */
export const OpenMail = (props: OpenMailProps) => (
  <OpenMailForMessage key={props.fileInfo?.identifier || ""} {...props} />
);

const OpenMailForMessage = ({ open, handleClose, fileInfo }: OpenMailProps) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const dispatch = useDispatch();
  const [phase, setPhase] = React.useState<OpenPhase>("waiting");
  const [attempt, setAttempt] = React.useState(0);
  const startedRef = React.useRef<string>("");
  const stalledPollsRef = React.useRef(0);

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
          username,
          { retries: FETCH_RETRIES }
        );
        if (run.cancelled) return;
        if (!res) {
          setPhase("failed");
        } else if (res.deleted) {
          dispatch(removeMessages({ ids: [ref.identifier] }));
          setPhase("deleted");
        } else if (res.unableToDecrypt) {
          setPhase("unableToDecrypt");
        } else if (res.isValid === false) {
          setPhase(res.fetchError ? (res.notAvailable ? "unavailable" : "failed") : "invalid");
        } else {
          handleClose(res);
        }
      } catch {
        if (!run.cancelled) setPhase("failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref, resource.phase, attempt]);

  // Three stalled answers in a row (or a node that stopped answering the
  // status poll): say so, instead of a progress bar that never ends.
  const statusValue = resource.status?.status;
  const statusObject = resource.status;
  React.useEffect(() => {
    if (!open || phase !== "waiting") return;
    if (resource.phase === "error") {
      setPhase("unavailable");
      return;
    }
    if (statusValue === "MISSING_DATA" || statusValue === "FAILED") {
      stalledPollsRef.current += 1;
      if (stalledPollsRef.current >= STALLED_POLLS_BEFORE_UNAVAILABLE) setPhase("unavailable");
    } else if (statusValue) {
      stalledPollsRef.current = 0;
    }
    // `statusObject` changes with every poll answer, so repeats of the same status count.
  }, [open, phase, resource.phase, statusValue, statusObject]);

  if (!open) return null;

  const retry = () => {
    stalledPollsRef.current = 0;
    setPhase("waiting");
    setAttempt((n) => n + 1);
    resource.retry();
  };

  const stalled = resource.status?.status === "MISSING_DATA" || resource.status?.status === "FAILED";
  const resourceStatus = resource.phase === "ready" ? "BUILDING" : resource.status?.status;
  const sender = fileInfo?.name ? (
    <>
      From <NameText name={fileInfo.name} />
    </>
  ) : null;
  const sentAt = exactMailDate(fileInfo?.createdAt);
  const rowTitle = typeof fileInfo?.title === "string" && fileInfo.title.trim() ? fileInfo.title.trim() : "";

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
      {phase === "unavailable" && (
        <Box role="status" sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography sx={{ fontWeight: 600 }}>{rowTitle || "Message"}</Typography>
          {sender && (
            <Typography variant="body2" color="text.secondary">
              {sender}
              {sentAt ? ` · ${sentAt}` : ""}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 1 }}>
            {NOT_AVAILABLE_TITLE}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            No peer has handed it over yet. It stays in your inbox; try again in a while.
          </Typography>
          <Box>
            <Button variant="outlined" onClick={retry} sx={{ minHeight: 44, mt: 1 }}>
              Retry
            </Button>
          </Box>
        </Box>
      )}
      {phase === "deleted" && (
        <EmptyState title="This message was removed by its sender" hint="It has been taken out of your inbox." />
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
        {phase === "deleted" ? "Back" : "Cancel"}
      </Button>
    </Box>
  );
};
