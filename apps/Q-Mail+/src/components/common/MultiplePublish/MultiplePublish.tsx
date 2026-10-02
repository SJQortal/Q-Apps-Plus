/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Runs one PUBLISH_MULTIPLE_QDN_RESOURCES request and shows each resource's
 * outcome. Adapted from Q-Share+'s MultiplePublishAll and checked against
 * Hub's source (docs/QORTAL.md → Hub & GO pitfalls 10):
 *
 * - Hub gives the request 30 minutes per resource (useQortalMessageListener
 *   .tsx: resources.length × 30 min) and keeps publishing after the app
 *   stops waiting, so the app waits as long as Hub does and never gives up
 *   after 30 s. After 60 s the dialog offers "Stop waiting".
 * - While it publishes, Hub posts PUBLISH_STATUS messages to the frame
 *   (AppViewer.tsx receiveChunksFunc): the upload's chunks, `retry` while it
 *   waits to try again, and `processed` once the resource is signed and on
 *   its way to QDN. Each row shows them.
 * - When Hub does not answer in time, or the user stops waiting, Hub may
 *   still publish some or all of the batch, so the app asks QDN (search by
 *   name + identifier, TTL 0) instead of guessing: a blind Retry would pay
 *   the fee twice. Retry sends only what QDN still does not have.
 * - Hub names the resources that failed (`error.unsuccessfulPublishes`);
 *   an error without that list comes from Hub's checks before it published
 *   anything (name, fee, balance, disk space).
 *
 * The request handed to Hub, and the subset sent on Retry, keep the caller's
 * identifiers, data64, encrypt and publicKeys byte for byte (data contract
 * §3): this component never builds or alters a payload.
 */
import { Alert, Box, Button, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { CircularProgress } from "@mui/material";
import { ResponsiveDialog } from "../ResponsiveDialog";
import { errorMessage, isHubDecline, isHubTimeout } from "../../../utils/hubErrors";
import { searchResources } from "../../../utils/qdnSearch";

export interface PublishResource {
  name: string;
  service: string;
  identifier: string;
  /** Attachments carry the file's real name. */
  originalFilename?: string;
  filename?: string;
  [key: string]: any;
}

export interface Publish {
  action: string;
  resources: PublishResource[];
  [key: string]: any;
}

interface MultiplePublishProps {
  publishes: Publish;
  isOpen: boolean;
  /** Called once every resource in the batch is on QDN (data contract §3). */
  onSubmit: () => void;
  /**
   * The user declined or cancelled in Hub (no message), or closed the dialog
   * before everything was on QDN (a message that says what happened).
   */
  onError: (message?: string) => void;
}

type ResourceState = "waiting" | "checking" | "done" | "failed" | "missing" | "unknown";
type Phase = "publishing" | "checking" | "settled";

/** Hub's own limit per resource; the app waits as long as Hub does. */
export const PUBLISH_MS_PER_RESOURCE = 30 * 60 * 1000;
/** After this long the dialog offers "Stop waiting" (Hub has no cancel for an app's publish). */
export const STOP_WAITING_AFTER_S = 60;

const STATE_TEXT: Record<ResourceState, string> = {
  waiting: "Waiting",
  checking: "Checking",
  done: "Published",
  failed: "Failed",
  missing: "Not on QDN yet",
  unknown: "Not confirmed",
};
const STILL_UPLOADING = "Hub is still uploading";

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** What the row is called: attachments by their file name, the rest by what they are. */
export function resourceLabel(resource: PublishResource, index: number, all: PublishResource[]): string {
  if (resource.service === "ATTACHMENT_PRIVATE") return resource.originalFilename || resource.filename || "Attachment";
  if (resource.service === "MAIL") return "Thread title";
  const copies = all.filter((r) => r.service === resource.service);
  if (copies.length <= 1) return "Message";
  return `Message copy ${copies.indexOf(resource) + 1}`;
}

function ResourceIcon({ resource }: { resource: PublishResource }) {
  if (resource.service === "ATTACHMENT_PRIVATE") return <AttachFileOutlinedIcon />;
  if (resource.service === "MAIL") return <ForumOutlinedIcon />;
  return <MailOutlinedIcon />;
}

/** How far Hub has got with one resource, from its PUBLISH_STATUS messages. */
export interface PublishProgress {
  chunks?: number;
  totalChunks?: number;
  processed?: boolean;
  retry?: boolean;
}

export interface PublishStatus extends PublishProgress {
  identifier: string;
  service?: string;
}

/**
 * Hub's PUBLISH_STATUS message, or null for anything else. Hub URI-encodes
 * the identifier and name it reports (publish.ts gets them encoded).
 */
export function readPublishStatus(data: unknown): PublishStatus | null {
  const d = data as {
    action?: unknown;
    publishLocation?: { identifier?: unknown; service?: unknown } | null;
    chunks?: unknown;
    totalChunks?: unknown;
    processed?: unknown;
    retry?: unknown;
  } | null;
  if (!d || typeof d !== "object" || d.action !== "PUBLISH_STATUS") return null;
  const raw = d.publishLocation?.identifier;
  if (typeof raw !== "string" || !raw) return null;
  let identifier = raw;
  try {
    identifier = decodeURIComponent(raw);
  } catch {
    // Keep it as sent.
  }
  const service = d.publishLocation?.service;
  return {
    identifier,
    service: typeof service === "string" ? service : undefined,
    chunks: typeof d.chunks === "number" ? d.chunks : undefined,
    totalChunks: typeof d.totalChunks === "number" ? d.totalChunks : undefined,
    processed: d.processed === true,
    retry: d.retry === true,
  };
}

/** Hub posts from its own window, which is the frame's parent or, with Hub's nested frame, its top. */
function fromHost(event: MessageEvent): boolean {
  return event.source != null && (event.source === window.parent || event.source === window.top);
}

/** A row's line while Hub works on it, or null when Hub has said nothing yet. */
function progressText(progress: PublishProgress | undefined): string | null {
  if (!progress) return null;
  if (progress.retry) return "Retrying…";
  const { chunks, totalChunks } = progress;
  if (typeof chunks !== "number" || !totalChunks) return null;
  if (chunks >= totalChunks) return "Processing…";
  return `Uploading ${chunks} of ${totalChunks} parts`;
}

function progressPercent(progress: PublishProgress | undefined): number | null {
  if (!progress || progress.retry || !progress.totalChunks || typeof progress.chunks !== "number") return null;
  if (progress.chunks >= progress.totalChunks) return null;
  return Math.round((progress.chunks / progress.totalChunks) * 100);
}

function StateIcon({ state, busy }: { state: ResourceState; busy?: boolean }) {
  if (busy) return <CircularProgress size={20} aria-label={STILL_UPLOADING} />;
  const title = STATE_TEXT[state];
  if (state === "done") return <CheckCircleOutlinedIcon sx={{ color: "success.main" }} titleAccess={title} />;
  if (state === "failed") return <ErrorOutlineOutlinedIcon sx={{ color: "error.main" }} titleAccess={title} />;
  if (state === "missing") return <ReportProblemOutlinedIcon sx={{ color: "warning.main" }} titleAccess={title} />;
  if (state === "unknown") return <HelpOutlineOutlinedIcon sx={{ color: "text.secondary" }} titleAccess={title} />;
  return <CircularProgress size={20} aria-label={title} />;
}

function without<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  if (!ids.some((id) => id in record)) return record;
  const next = { ...record };
  for (const id of ids) delete next[id];
  return next;
}

/**
 * True when QDN has this resource from this name. Mail identifiers end in a
 * fresh uid, so the newest rows plus an exact compare are enough. Throws
 * when the node cannot be asked.
 */
export async function isOnQdn(resource: PublishResource): Promise<boolean> {
  const rows = await searchResources<{ name?: string; identifier?: string }>(
    {
      mode: "ALL",
      service: resource.service,
      name: resource.name,
      identifier: resource.identifier,
      exactmatchnames: true,
      limit: 5,
    },
    { ttlMs: 0 }
  );
  const name = resource.name.trim().toLowerCase();
  return rows.some((row) => row?.identifier === resource.identifier && (row?.name || "").trim().toLowerCase() === name);
}

/** Which of `resources` are on QDN, or null when the node could not be asked. */
export async function findOnQdn(resources: PublishResource[]): Promise<Set<string> | null> {
  try {
    const found = await Promise.all(resources.map((resource) => isOnQdn(resource)));
    return new Set(resources.filter((_, i) => found[i]).map((r) => r.identifier));
  } catch {
    return null;
  }
}

/** Hub's list of what did not publish, from a rejection or a resolved `{error}` answer. */
function unsuccessfulIds(value: any): string[] {
  const list = value?.error?.unsuccessfulPublishes;
  return Array.isArray(list) ? list.map((item: any) => item?.identifier).filter(Boolean) : [];
}

export const MultiplePublish = ({ publishes, isOpen, onSubmit, onError }: MultiplePublishProps) => {
  const [phase, setPhase] = useState<Phase>("publishing");
  const [rows, setRows] = useState<Record<string, ResourceState>>({});
  // The async steps below read the latest row states without waiting for a render.
  const rowsRef = useRef(rows);
  // Hub's latest status per row. Checking QDN for a row drops its entry, so
  // an entry on a row that is not on QDN means Hub has been at it since.
  const [progress, setProgress] = useState<Record<string, PublishProgress>>({});
  const [errorText, setErrorText] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const alive = useRef(true);
  const finished = useRef(false);
  // Each request to Hub is numbered. A retry supersedes the one before, and
  // "Stop waiting" detaches the current one; either way Hub keeps working
  // on it, and its answer is still used for what it can tell.
  const attempt = useRef(0);
  const waitingOn = useRef(0);
  // Rows sent in a request Hub has not answered yet, by request number. Hub
  // publishes a batch one resource at a time, so a row QDN does not have yet
  // may just be queued behind another: retrying it would pay for it twice.
  const [awaiting, setAwaiting] = useState<Record<string, number>>({});
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
    if (!ids.length) return;
    const next = { ...rowsRef.current };
    for (const id of ids) next[id] = state;
    rowsRef.current = next;
    setRows(next);
  }, []);

  const allDone = useCallback(
    () => publishes.resources.every((r) => rowsRef.current[r.identifier] === "done"),
    [publishes]
  );

  // Hub's answer, the QDN check and a late status message can each be the
  // one that completes the batch; report it once, and never after close.
  const finish = useCallback(() => {
    if (finished.current || !alive.current) return;
    finished.current = true;
    onSubmit();
  }, [onSubmit]);

  // Hub's progress for this publish. It keeps coming after a timeout, so the
  // listener stays for as long as the dialog is open.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const status = readPublishStatus(event.data);
      if (!status || !fromHost(event)) return;
      const resource = publishes.resources.find(
        (r) => r.identifier === status.identifier && (!status.service || r.service === status.service)
      );
      if (!resource) return;
      const id = resource.identifier;
      setProgress((prev) => {
        const old = prev[id] ?? {};
        return {
          ...prev,
          [id]: {
            chunks: status.chunks ?? old.chunks,
            totalChunks: status.totalChunks ?? old.totalChunks,
            processed: status.processed || old.processed,
            retry: status.retry,
          },
        };
      });
      // Signed and processed: it is on its way to QDN whatever Hub answers later.
      if (status.processed) mark([id], "done");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [publishes, mark]);

  // Hub may finish after the app stopped waiting; its last status message
  // then completes the batch.
  useEffect(() => {
    if (phase === "settled" && allDone()) finish();
  }, [phase, rows, allDone, finish]);

  const verify = useCallback(
    async (resources: PublishResource[]) => {
      const ids = resources.map((r) => r.identifier);
      setPhase("checking");
      mark(ids, "checking");
      // Progress from before the check is old news; what arrives from now
      // on shows Hub is still at work on the row.
      setProgress((prev) => without(prev, ids));
      const found = await findOnQdn(resources);
      if (!alive.current) return;
      // Hub's answer or a status message may have settled a row meanwhile.
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
    [mark, allDone, finish]
  );

  const run = useCallback(
    async (request: Publish) => {
      const ids = request.resources.map((r) => r.identifier);
      const current = ++attempt.current;
      waitingOn.current = current;
      mark(ids, "waiting");
      setProgress((prev) => without(prev, ids));
      setAwaiting((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, current])) }));
      setPhase("publishing");
      setErrorText(null);
      setElapsed(0);
      const answered = () => {
        if (alive.current) setAwaiting((prev) => without(prev, ids.filter((id) => prev[id] === current)));
      };
      let answer: any;
      try {
        answer = await qortalRequestWithTimeout(request, request.resources.length * PUBLISH_MS_PER_RESOURCE);
      } catch (error: unknown) {
        answered();
        if (!alive.current) return;
        // A retry replaced this request: take only what its answer confirms.
        const superseded = attempt.current !== current;
        // The user stopped waiting for it and QDN has been checked already.
        const detached = !superseded && waitingOn.current !== current;
        // A decline (in any of Hub's languages, or its 60 s auto-decline) and
        // Hub's Cancel, which stops the batch and removes what it had
        // published, are the user's choice: close without an error.
        if (isHubDecline(error)) {
          if (!superseded) onError();
          return;
        }
        const unsuccessful = unsuccessfulIds(error);
        if (unsuccessful.length > 0) {
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
          // publishes anything: nothing of this request is on QDN.
          mark(
            ids.filter((id) => rowsRef.current[id] !== "done"),
            "failed"
          );
          setErrorText(errorMessage(error, "Publishing failed"));
          if (!detached) setPhase("settled");
          return;
        }
        // A timeout is not a failure: Hub keeps going on its own clock, so
        // ask QDN. A user who stopped waiting asked QDN back then, before
        // Hub had got through the batch, so ask again: Retry is only for
        // what is still not there now.
        await verify(request.resources.filter((r) => rowsRef.current[r.identifier] !== "done"));
        return;
      }
      answered();
      if (!alive.current) return;
      // Hub resolves (not rejects) with {error: {cancelled}} on Cancel and
      // with {error: {unsuccessfulPublishes}} when some failed.
      if (isHubDecline(answer)) {
        if (attempt.current === current) onError();
        return;
      }
      const unsuccessful = unsuccessfulIds(answer);
      mark(
        ids.filter((id) => !unsuccessful.includes(id)),
        "done"
      );
      if (unsuccessful.length && attempt.current === current) mark(unsuccessful, "failed");
      if (allDone()) finish();
      else if (attempt.current === current && waitingOn.current === current) setPhase("settled");
    },
    [mark, finish, allDone, onError, verify]
  );

  useEffect(() => {
    if (publishes && !hasStarted.current) {
      hasStarted.current = true;
      run(publishes);
    }
  }, [publishes, run]);

  const resources = publishes?.resources ?? [];
  const total = resources.length;
  const stateOf = (id: string): ResourceState => rows[id] ?? "waiting";
  const count = (state: ResourceState) => resources.filter((r) => stateOf(r.identifier) === state).length;
  // Not on QDN at the last check, but Hub has reported progress since.
  const isBusy = (id: string) => ["missing", "unknown"].includes(stateOf(id)) && Boolean(progress[id]);
  // Not on QDN, and Hub has not answered for the request that sent it yet.
  const isHeld = (id: string) => stateOf(id) === "missing" && id in awaiting;
  const doneCount = count("done");
  const failedCount = count("failed");
  const missingCount = count("missing");
  const heldCount = resources.filter((r) => isHeld(r.identifier)).length;
  const unknownCount = count("unknown");
  const settled = phase === "settled";
  const retryable = resources.filter((r) => {
    const state = stateOf(r.identifier);
    return state === "failed" || (state === "missing" && !isBusy(r.identifier) && !isHeld(r.identifier));
  });
  const uncertain = resources.filter((r) => ["missing", "unknown"].includes(stateOf(r.identifier)));
  const canStopWaiting = phase === "publishing" && elapsed >= STOP_WAITING_AFTER_S;

  const close = () => {
    const left = total - doneCount;
    onError(
      doneCount === 0
        ? "Nothing was published"
        : `${doneCount} of ${total} published; ${left} ${left === 1 ? "item is" : "items are"} not on QDN`
    );
  };
  // The identifiers, payloads, encrypt and publicKeys of the subset are the caller's, untouched.
  const retry = () => run({ ...publishes, resources: retryable });
  const checkAgain = () => {
    setErrorText(null);
    verify(uncertain);
  };
  // Hub carries on and is still listened to; only the app stops waiting.
  const stopWaiting = () => {
    waitingOn.current = 0;
    verify(resources.filter((r) => stateOf(r.identifier) !== "done"));
  };

  const title =
    phase === "publishing"
      ? "Publishing…"
      : phase === "checking"
        ? "Checking QDN"
        : unknownCount > 0
          ? "Publish not confirmed"
          : failedCount === total
            ? "Publish failed"
            : "Some items did not publish";

  return (
    <ResponsiveDialog
      open={isOpen}
      // While Hub publishes, the title bar's X (phone: Back) stops waiting; afterwards it closes.
      onClose={phase === "publishing" ? (canStopWaiting ? stopWaiting : undefined) : settled ? close : undefined}
      title={title}
      describedBy="qmail-publish-description"
      maxWidth="sm"
      actions={
        settled ? (
          <>
            <Button variant="outlined" color="inherit" onClick={close}>
              Close
            </Button>
            {uncertain.length > 0 && (
              <Button variant="outlined" onClick={checkAgain}>
                Check again
              </Button>
            )}
            {retryable.length > 0 && (
              <Button variant="contained" onClick={retry}>
                {retryable.some((r) => stateOf(r.identifier) === "missing") ? "Retry missing" : "Try again"}
              </Button>
            )}
          </>
        ) : canStopWaiting ? (
          <Button variant="outlined" color="inherit" onClick={stopWaiting}>
            Stop waiting
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {phase === "publishing" ? (
          <Box>
            <LinearProgress aria-label="Publishing" />
            <Typography id="qmail-publish-description" sx={{ mt: 1.5 }}>
              Confirm the publish in Hub if asked, then keep this tab open. Each item below is published once.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} aria-live="off">
              {clock(elapsed)} so far. Attachments take a while to reach the node; nothing is lost if you wait.
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
            <Typography id="qmail-publish-description" sx={{ mt: 1.5 }}>
              Checking QDN for what was published…
            </Typography>
          </Box>
        ) : (
          <Box>
            <LinearProgress
              variant="determinate"
              value={total ? (doneCount / total) * 100 : 0}
              aria-label="Published"
              color="warning"
            />
            <Typography id="qmail-publish-description" sx={{ mt: 1.5, fontWeight: 600 }}>
              {doneCount} of {total} published
            </Typography>
          </Box>
        )}

        {errorText && <Alert severity="error">{errorText}</Alert>}
        {settled && failedCount > 0 && (
          <Alert severity="warning">
            Everything must publish for the message to work. Wait a moment and try again; only the failed items are
            sent.
          </Alert>
        )}
        {settled && heldCount > 0 && (
          <Alert severity="info">
            Hub has not answered for this publish yet. It publishes one item at a time, so what is not on QDN yet may
            still be on its way, and Retry waits for Hub's answer so you never pay twice. Check again later, or close:
            Hub keeps publishing.
          </Alert>
        )}
        {settled && missingCount > heldCount && (
          <Alert severity="warning">
            Some items are not on QDN yet. Hub may still be publishing them, so check again before you retry: each
            retry costs a new fee.
          </Alert>
        )}
        {settled && unknownCount > 0 && (
          <Alert severity="warning">
            Could not check QDN. Hub may still be publishing, so check again or look in Sent before you send again.
          </Alert>
        )}

        <List dense disablePadding aria-label="Items to publish">
          {resources.map((resource, index) => {
            const state = stateOf(resource.identifier);
            const label = resourceLabel(resource, index, resources);
            const busy = isBusy(resource.identifier);
            // Hub's progress matters while the row waits on Hub, or when Hub
            // is still at work on a row the last check did not find.
            const working = state === "waiting" || busy ? progress[resource.identifier] : undefined;
            const percent = progressPercent(working);
            const line = busy
              ? [STILL_UPLOADING, progressText(working)].filter(Boolean).join(" · ")
              : (progressText(working) ?? STATE_TEXT[state]);
            return (
              <ListItem key={resource.identifier || index} divider sx={{ minHeight: 48, px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>
                  <ResourceIcon resource={resource} />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  secondary={
                    <>
                      {line}
                      {percent !== null && (
                        <LinearProgress
                          variant="determinate"
                          value={percent}
                          aria-label={`${label} upload`}
                          sx={{ mt: 0.75, height: 4, borderRadius: 1 }}
                        />
                      )}
                    </>
                  }
                  slotProps={{ primary: { noWrap: true, title: resource.identifier }, secondary: { component: "div" } }}
                />
                <Box sx={{ ml: 1, display: "flex", alignItems: "center" }} data-state={state}>
                  <StateIcon state={state} busy={busy} />
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </ResponsiveDialog>
  );
};
