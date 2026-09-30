import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { fileKind, fileKindIconElement } from "../../../utils/fileKind";
import { formatBytes } from "../../../utils/formatBytes";
import { errorMessage, isHubDecline, isHubTimeout } from "../../../utils/hubErrors";
import type { MultiplePublishRequest, PublishResource } from "../../../utils/publishPayload";
import { mapWithConcurrency, searchQdn } from "../../../utils/qdnSearch";
import { ResponsiveDialog } from "../mobile/ResponsiveDialog";

/** How the dialog ended when not everything is known to be on QDN. */
export interface PublishStopped {
  /**
   * Hub may still publish some of the batch: it timed out or the user
   * stopped waiting, and QDN has not confirmed everything. Publishing the
   * same share again could make a duplicate and charge a second fee.
   */
  uncertain: boolean;
}

/** Identifier → timestamp of the version already on QDN, for identifiers a publish replaces. */
export type ReplacedVersions = Record<string, number | undefined>;

interface MultiplePublishProps {
  publishes: MultiplePublishRequest;
  isOpen: boolean;
  /**
   * Identifiers this publish replaces (an update reuses the share's details
   * identifier), each with the time of the version already on QDN. The QDN
   * check counts such a resource only when it finds a newer version, and
   * never when that time is unknown. Any other identifier is new, so being
   * on QDN is enough.
   */
  replaces?: ReplacedVersions;
  /** Everything is on QDN. */
  onSubmit: () => void;
  /**
   * The user declined or cancelled in Hub, or closed the dialog before
   * everything was on QDN. `published` lists the identifiers that did land,
   * so the caller can tell a partial share from nothing at all.
   */
  onError: (message?: string, published?: string[], stopped?: PublishStopped) => void;
}

type ResourceState = "waiting" | "checking" | "done" | "failed" | "missing" | "unknown";
type Phase = "publishing" | "checking" | "settled";

/**
 * Hub gives PUBLISH_MULTIPLE_QDN_RESOURCES 30 minutes per resource and keeps
 * publishing after the app stops waiting, so the app waits as long as Hub.
 */
export const PUBLISH_MS_PER_RESOURCE = 30 * 60 * 1000;
/**
 * Hub has no cancel for an app's publish and a stalled node can keep it busy
 * for the whole wait, so after this long the dialog offers "Stop waiting".
 */
export const STOP_WAITING_AFTER_S = 60;
const CHECK_CONCURRENCY = 4;

const STATE_TEXT: Record<ResourceState, string> = {
  waiting: "Waiting",
  checking: "Checking",
  done: "Published",
  failed: "Failed",
  missing: "Not on QDN yet",
  unknown: "Not confirmed",
};

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function resourceLabel(resource: PublishResource): string {
  return resource.service === "DOCUMENT" ? "Share details" : resource.filename;
}

function ResourceIcon({ resource }: { resource: PublishResource }) {
  if (resource.service === "DOCUMENT") return <DescriptionOutlinedIcon />;
  return fileKindIconElement(fileKind(resource.file?.type, resource.filename));
}

function StateIcon({ state }: { state: ResourceState }) {
  const title = STATE_TEXT[state];
  if (state === "done") return <CheckCircleOutlinedIcon sx={{ color: "success.main" }} titleAccess={title} />;
  if (state === "failed") return <ErrorOutlineOutlinedIcon sx={{ color: "error.main" }} titleAccess={title} />;
  if (state === "missing") return <ReportProblemOutlinedIcon sx={{ color: "warning.main" }} titleAccess={title} />;
  if (state === "unknown") return <HelpOutlineOutlinedIcon sx={{ color: "text.secondary" }} titleAccess={title} />;
  return <CircularProgress size={20} aria-label={title} />;
}

/**
 * For a share whose details landed but some files did not: the details
 * already list those files, so adding them again in Edit only helps once
 * the dead entries are removed. Used after "Share published, but ".
 */
export function filesNotOnQdnText(count: number, noun = "file"): string {
  const one = count === 1;
  const it = one ? "it" : "them";
  return (
    `${one ? `1 ${noun} is` : `${count} ${noun}s are`} not on QDN yet. ` +
    `If ${one ? "it doesn't" : "they don't"} arrive, remove ${it} in Edit and add ${it} again.`
  );
}

/** The dialog's note for the same case, while Retry can still put the files where the share expects them. */
function detailsLandedText(count: number, canRetry: boolean): string {
  const one = count === 1;
  const it = one ? "it" : "them";
  return (
    `The share is on QDN and already links to ${one ? "this file" : "these files"}. ` +
    (canRetry ? `Retry publishes ${it} where the share looks for ${it}. ` : "") +
    `If you close and ${one ? "it doesn't" : "they don't"} arrive, remove ${it} in Edit and add ${it} again.`
  );
}

/**
 * Which of `resources` are on QDN from this publish, or null when the node
 * could not be asked. A new identifier counts as soon as it is there; one in
 * `replaces` only with a version newer than the one it replaces.
 */
export async function findOnQdn(
  resources: PublishResource[],
  replaces: ReplacedVersions = {}
): Promise<Set<string> | null> {
  try {
    const found = await mapWithConcurrency(resources, CHECK_CONCURRENCY, async (resource) => {
      // Core matches identifiers by prefix at best; our ids end in a random
      // uid, so the newest row plus an exact compare is enough.
      const [row] = await searchQdn(
        {
          service: resource.service,
          name: resource.name,
          identifier: resource.identifier,
          prefix: true,
          exactmatchnames: true,
          excludeblocked: false,
          limit: 1,
        },
        { fresh: true }
      );
      if (row?.identifier !== resource.identifier) return false;
      if (!(resource.identifier in replaces)) return true;
      const before = replaces[resource.identifier];
      // Without the old version's time, QDN cannot tell this publish from it.
      return before !== undefined && (row.updated ?? row.created ?? 0) > before;
    });
    return new Set(resources.filter((_, i) => found[i]).map((r) => r.identifier));
  } catch {
    return null;
  }
}

/**
 * Sends the share's resources to Hub in one PUBLISH_MULTIPLE_QDN_RESOURCES
 * request and shows what landed. Hub confirms the whole batch once and
 * answers when it is finished. When it names the resources that failed,
 * only those can be retried; an error without that list comes from Hub's
 * checks before it publishes anything. When Hub does not answer in time, or
 * the user stops waiting, Hub may still publish some or all of the batch,
 * so the app asks QDN instead of guessing (a blind retry would charge the
 * fee twice), and a late answer from Hub still completes the batch.
 */
export const MultiplePublish = ({ publishes, isOpen, replaces, onSubmit, onError }: MultiplePublishProps) => {
  const [phase, setPhase] = useState<Phase>("publishing");
  const [rows, setRows] = useState<Record<string, ResourceState>>({});
  // The async steps below read the latest row states without waiting for a render.
  const rowsRef = useRef(rows);
  const [errorText, setErrorText] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const alive = useRef(true);
  const finished = useRef(false);
  // Each request to Hub is numbered. A retry supersedes the one before, and
  // "Stop waiting" detaches the current one; either way Hub keeps working
  // on it, and its answer is still used for what it can tell.
  const attempt = useRef(0);
  const waitingOn = useRef(0);
  const sentBy = useRef(new Map<string, number>());
  // Rows a request may still publish, by request number: the app stopped
  // waiting for them and QDN has not confirmed them yet.
  const unsure = useRef(new Map<string, number>());
  // Hub reports nothing while it works, so at least show that time is passing.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "publishing") return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const mark = useCallback((ids: string[], state: ResourceState) => {
    const next = { ...rowsRef.current };
    for (const id of ids) {
      next[id] = state;
      if (state === "done") unsure.current.delete(id);
    }
    rowsRef.current = next;
    setRows(next);
  }, []);

  /** Request `n` answered for `ids`: it no longer might publish them. */
  const settleUnsure = useCallback((ids: string[], n: number) => {
    for (const id of ids) if (unsure.current.get(id) === n) unsure.current.delete(id);
  }, []);

  const publishedIds = useCallback(
    () => Object.keys(rowsRef.current).filter((id) => rowsRef.current[id] === "done"),
    []
  );

  const stopped = useCallback((): PublishStopped => ({ uncertain: unsure.current.size > 0 }), []);

  const allDone = useCallback(
    () => publishes.resources.every((r) => rowsRef.current[r.identifier] === "done"),
    [publishes]
  );

  // Hub's answer and the QDN check can each be the one that completes the
  // batch; report it once, and never after close.
  const finish = useCallback(() => {
    if (finished.current || !alive.current) return;
    finished.current = true;
    onSubmit();
  }, [onSubmit]);

  const verify = useCallback(
    async (resources: PublishResource[]) => {
      const ids = resources.map((r) => r.identifier);
      setPhase("checking");
      mark(ids, "checking");
      for (const id of ids) unsure.current.set(id, sentBy.current.get(id) ?? 0);
      const found = await findOnQdn(resources, replaces);
      if (!alive.current) return;
      // Hub's answer may have settled a row meanwhile.
      const open = ids.filter((id) => rowsRef.current[id] === "checking");
      if (!found) {
        mark(open, "unknown");
      } else {
        mark(
          open.filter((id) => found.has(id)),
          "done"
        );
        mark(
          open.filter((id) => !found.has(id)),
          "missing"
        );
      }
      if (allDone()) {
        finish();
        return;
      }
      setPhase("settled");
    },
    [mark, allDone, finish, replaces]
  );

  const run = useCallback(
    async (request: MultiplePublishRequest) => {
      const ids = request.resources.map((r) => r.identifier);
      const current = ++attempt.current;
      waitingOn.current = current;
      for (const id of ids) sentBy.current.set(id, current);
      mark(ids, "waiting");
      setPhase("publishing");
      setErrorText(null);
      setElapsed(0);
      try {
        await qortalRequestWithTimeout(request, request.resources.length * PUBLISH_MS_PER_RESOURCE);
      } catch (error: any) {
        if (!alive.current) return;
        // A retry replaced this request: take only what its answer confirms.
        const superseded = attempt.current !== current;
        // The user stopped waiting for it and QDN has been checked already.
        const detached = !superseded && waitingOn.current !== current;
        // A decline (in any of Hub's languages, or its 60 s auto-decline) and
        // Hub's Cancel, which stops the batch and removes what it had
        // published, are the user's choice: close without an error.
        if (isHubDecline(error)) {
          settleUnsure(ids, current);
          if (!superseded) onError(undefined, publishedIds(), stopped());
          return;
        }
        const unsuccessful: string[] = (error?.error?.unsuccessfulPublishes || [])
          .map((item: { identifier?: string }) => item?.identifier)
          .filter(Boolean);
        if (unsuccessful.length > 0) {
          settleUnsure(ids, current);
          mark(
            ids.filter((id) => !unsuccessful.includes(id)),
            "done"
          );
          if (!superseded) mark(unsuccessful, "failed");
          if (allDone()) finish();
          else if (!superseded && !detached) setPhase("settled");
          return;
        }
        if (superseded) return;
        if (!isHubTimeout(error)) {
          // Hub answers without a list only from its checks before it
          // publishes anything (name, fee, balance, disk space): nothing of
          // this request is on QDN, and Hub is not working on it.
          settleUnsure(ids, current);
          mark(
            ids.filter((id) => rowsRef.current[id] !== "done"),
            "failed"
          );
          setErrorText(errorMessage(error, "Publishing failed"));
          if (!detached) setPhase("settled");
          return;
        }
        // A timeout is not a failure: Hub keeps going on its own clock, so
        // ask QDN (unless the user already did by stopping the wait).
        if (!detached) await verify(request.resources.filter((r) => rowsRef.current[r.identifier] !== "done"));
        return;
      }
      mark(ids, "done");
      if (allDone()) finish();
    },
    [mark, settleUnsure, finish, allDone, onError, publishedIds, stopped, verify]
  );

  useEffect(() => {
    if (publishes && !hasStarted.current) {
      hasStarted.current = true;
      run(publishes);
    }
  }, [publishes, run]);

  const resources = publishes?.resources ?? [];
  const total = resources.length;
  const totalBytes = resources.reduce((sum, r) => sum + (r.service === "FILE" ? r.file.size : 0), 0);
  const stateOf = (id: string): ResourceState => rows[id] ?? "waiting";
  const count = (state: ResourceState) => resources.filter((r) => stateOf(r.identifier) === state).length;
  const doneCount = count("done");
  const failedCount = count("failed");
  const missingCount = count("missing");
  const unknownCount = count("unknown");
  const settled = phase === "settled";
  const retryable = resources.filter((r) => ["failed", "missing"].includes(stateOf(r.identifier)));
  const uncertain = resources.filter((r) => ["missing", "unknown"].includes(stateOf(r.identifier)));
  const detailsDone = resources.some((r) => r.service === "DOCUMENT" && stateOf(r.identifier) === "done");
  const filesLeft = resources.filter((r) => r.service === "FILE" && stateOf(r.identifier) !== "done").length;
  const canRetryFiles = retryable.some((r) => r.service === "FILE");
  const canStopWaiting = phase === "publishing" && elapsed >= STOP_WAITING_AFTER_S;

  const close = () => onError(undefined, publishedIds(), stopped());
  const retry = () => run({ ...publishes, resources: retryable });
  const checkAgain = () => {
    setErrorText(null);
    verify(uncertain);
  };
  // Hub carries on, and its answer still counts; only the app stops waiting.
  const stopWaiting = () => {
    waitingOn.current = 0;
    verify(resources.filter((r) => stateOf(r.identifier) !== "done"));
  };

  const title =
    phase === "publishing"
      ? "Publishing"
      : phase === "checking"
        ? "Checking QDN"
        : unknownCount > 0
          ? "Publish not confirmed"
          : failedCount === total
            ? "Publish failed"
            : "Publish incomplete";

  return (
    <ResponsiveDialog
      open={isOpen}
      // The title bar's X (phone: Back) stops waiting while Hub publishes, and closes after.
      onClose={phase === "publishing" ? stopWaiting : close}
      title={title}
      maxWidth="sm"
      dismissible={false}
      actions={
        settled ? (
          <>
            <Button color="inherit" onClick={close}>
              Close
            </Button>
            {uncertain.length > 0 && (
              <Button variant="outlined" onClick={checkAgain}>
                Check again
              </Button>
            )}
            {retryable.length > 0 && (
              <Button variant="contained" onClick={retry}>
                {retryable.some((r) => stateOf(r.identifier) === "missing") ? "Retry missing" : "Retry failed"}
              </Button>
            )}
          </>
        ) : canStopWaiting ? (
          <Button color="inherit" onClick={stopWaiting}>
            Stop waiting
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {phase === "publishing" ? (
          <Box>
            <LinearProgress aria-label="Publishing" />
            <Typography sx={{ mt: 1.5 }}>
              Publishing {total} {total === 1 ? "resource" : "resources"}
              {totalBytes > 0 ? ` (${formatBytes(totalBytes)})` : ""}… Hub asks you to confirm once, then keep this
              tab open.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} aria-live="off">
              {clock(elapsed)} so far. Large files take a while to reach the node; nothing is lost if you wait.
            </Typography>
            {canStopWaiting && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Stop waiting checks QDN for what has landed. Hub keeps publishing either way.
              </Typography>
            )}
          </Box>
        ) : phase === "checking" ? (
          <Box>
            <LinearProgress aria-label="Checking QDN" />
            <Typography sx={{ mt: 1.5 }}>Checking QDN for what was published…</Typography>
          </Box>
        ) : (
          <Box>
            <LinearProgress
              variant="determinate"
              value={total ? (doneCount / total) * 100 : 0}
              aria-label="Published"
              color="warning"
            />
            <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
              {doneCount} of {total} published
            </Typography>
          </Box>
        )}

        {errorText && <Alert severity="error">{errorText}</Alert>}
        {settled && failedCount > 0 && (
          <Alert severity="warning">
            Some resources were not published. Retry sends only the failed ones; if it keeps failing, wait a minute
            and try again.
          </Alert>
        )}
        {settled && missingCount > 0 && (
          <Alert severity="warning">
            Some resources are not on QDN yet. Hub may still be publishing them, so check again before you retry: each
            retry costs a new fee.
          </Alert>
        )}
        {settled && unknownCount > 0 && (
          <Alert severity="warning">
            Could not check QDN. Hub may still be publishing, so check again or look in My shares before you publish
            again.
          </Alert>
        )}
        {settled && detailsDone && filesLeft > 0 && <Alert severity="info">{detailsLandedText(filesLeft, canRetryFiles)}</Alert>}

        <List dense disablePadding aria-label="Resources">
          {resources.map((resource) => {
            const state = stateOf(resource.identifier);
            return (
              <ListItem key={resource.identifier} divider sx={{ minHeight: 48, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                  <ResourceIcon resource={resource} />
                </ListItemIcon>
                <ListItemText
                  primary={resourceLabel(resource)}
                  secondary={STATE_TEXT[state]}
                  slotProps={{ primary: { noWrap: true, title: resourceLabel(resource) } }}
                />
                <Box sx={{ ml: 1, display: "flex", alignItems: "center" }}>
                  <StateIcon state={state} />
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </ResponsiveDialog>
  );
};

interface PublishAgainDialogProps {
  open: boolean;
  /** What may still be finishing and what publishing again would cost. */
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks before the next publish when the last one may still be finishing in Hub. */
export function PublishAgainDialog({ open, text, onCancel, onConfirm }: PublishAgainDialogProps) {
  return (
    <ResponsiveDialog
      open={open}
      onClose={onCancel}
      title="Publish again?"
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="contained" onClick={onConfirm}>
            Publish anyway
          </Button>
        </>
      }
    >
      <Typography>{text}</Typography>
    </ResponsiveDialog>
  );
}
