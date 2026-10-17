import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import type { RootState } from "../../../state/store";
import { fileKind, fileKindIconElement } from "../../../utils/fileKind";
import { formatBytes } from "../../../utils/formatBytes";
import { errorMessage, isHubDecline, isHubTimeout } from "../../../utils/hubErrors";
import {
  FILES_PER_BATCH,
  MAX_UNCONFIRMED_PER_ACCOUNT,
  UNCHECKED_BATCH_MAX,
  formatQort,
  publishUnitFee,
  splitPublishBatches,
  waitForRoom,
} from "../../../utils/publishBatches";
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
   * identifier), each with the node's time for the version already on QDN
   * (never the device clock, which can be minutes off). The QDN check counts
   * such a resource only when it finds a newer version, and never when that
   * time is unknown. Any other identifier is new, so being on QDN is enough.
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

/** "queued": in a later batch, not sent to Hub yet. */
type ResourceState = "queued" | "waiting" | "checking" | "done" | "failed" | "missing" | "unknown";
/**
 * "ready": a share in several batches waits for Start, so the user knows
 * what it takes first. "room": between batches, until the network has
 * confirmed enough of the last one (utils/publishBatches.ts).
 */
type Phase = "ready" | "room" | "publishing" | "checking" | "settled";
/** After a batch: go on with the next one, or stop (the dialog has settled, closed or moved on). */
type BatchOutcome = "next" | "stop";

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
  queued: "Queued",
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

function resourceLabel(resource: PublishResource): string {
  return resource.service === "DOCUMENT" ? "Share details" : resource.filename;
}

function ResourceIcon({ resource }: { resource: PublishResource }) {
  if (resource.service === "DOCUMENT") return <DescriptionOutlinedIcon />;
  return fileKindIconElement(fileKind(resource.file?.type, resource.filename));
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
 * Hub's PUBLISH_STATUS message, or null for anything else. While it
 * publishes for this tab, Hub posts one when a file's upload starts
 * (0 of n chunks), after each 5 MB chunk, with `retry` when it waits to try
 * again, and with `processed` once the resource is signed and on its way to
 * QDN (Qortal-Hub AppViewer.tsx:154-195, qdn/publish/publish.ts). Hub
 * URI-encodes the identifier and name it reports.
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
  if (state === "queued") return <ScheduleOutlinedIcon sx={{ color: "text.secondary" }} titleAccess={title} />;
  return <CircularProgress size={20} aria-label={title} />;
}

function without<T>(record: Record<string, T>, ids: string[]): Record<string, T> {
  if (!ids.some((id) => id in record)) return record;
  const next = { ...record };
  for (const id of ids) delete next[id];
  return next;
}

/** `awaiting` without the rows request `n` held: Hub has answered it. */
function answeredBy(awaiting: Record<string, number>, ids: string[], n: number): Record<string, number> {
  return without(awaiting, ids.filter((id) => awaiting[id] === n));
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
 * The time of the newest version of a resource on QDN, by the node's clock
 * (Core stamps each version with its own time), or undefined when QDN does
 * not have it. Throws when the node cannot be asked.
 */
export async function versionOnQdn(resource: { service: string; name: string; identifier: string }): Promise<number | undefined> {
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
  if (row?.identifier !== resource.identifier) return undefined;
  return row.updated ?? row.created ?? 0;
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
      const time = await versionOnQdn(resource);
      if (time === undefined) return false;
      if (!(resource.identifier in replaces)) return true;
      const before = replaces[resource.identifier];
      // Without the old version's time, QDN cannot tell this publish from it.
      return before !== undefined && time > before;
    });
    return new Set(resources.filter((_, i) => found[i]).map((r) => r.identifier));
  } catch {
    return null;
  }
}

/**
 * Set once Hub granted PUBLISH_MULTIPLE_QDN_RESOURCES for the session (Hub
 * keeps the grant per tab until it closes), so a second big share doesn't ask
 * for it again.
 */
let hubApprovesPublishes = false;

/** For tests. */
export function resetHubApproval(): void {
  hubApprovesPublishes = false;
}

/**
 * Sends the share's resources to Hub with PUBLISH_MULTIPLE_QDN_RESOURCES and
 * shows what landed. Up to 20 files go in one request, which Hub confirms
 * once and answers when it is finished; a bigger share goes in batches of
 * 20 files (utils/publishBatches.ts), the share details with the last, and
 * each batch waits until the network has confirmed enough of the one before.
 * Meanwhile Hub's PUBLISH_STATUS messages give each row its upload progress,
 * and mark it published once signed. When Hub names the resources that
 * failed, the next batches still go, and only those can be retried; an error
 * without that list comes from Hub's checks before it publishes anything.
 * When Hub does not answer in time, or the user stops waiting, Hub may
 * still publish some or all of the batch, so the app asks QDN instead of
 * guessing (a blind retry would charge the fee twice) and keeps listening
 * to Hub: a late answer or status message still completes the batch.
 */
export const MultiplePublish = ({ publishes, isOpen, replaces, onSubmit, onError }: MultiplePublishProps) => {
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const batches = useMemo(() => splitPublishBatches(publishes.resources), [publishes]);
  const multi = batches.length > 1;
  const [phase, setPhase] = useState<Phase>(multi ? "ready" : "publishing");
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
  const sentBy = useRef(new Map<string, number>());
  // Rows a request may still publish, by request number: the app stopped
  // waiting for them and QDN has not confirmed them yet.
  const unsure = useRef(new Map<string, number>());
  // Rows sent in a request Hub has not answered yet, by request number. Hub
  // publishes a batch one resource at a time and reports only on the one it
  // is at, so a row QDN does not have yet may just be queued behind it:
  // retrying it would pay for it twice. Retry waits for Hub's answer.
  const [awaiting, setAwaiting] = useState<Record<string, number>>({});
  // Each run through the batches is numbered too: Continue, Pause and close end the one before.
  const sequence = useRef(0);
  const roomWait = useRef<AbortController | null>(null);
  const [batch, setBatch] = useState({ index: 0, count: batches.length, size: batches[0]?.length ?? 0 });
  const [unconfirmed, setUnconfirmed] = useState<number | null>(null);
  const [approveAll, setApproveAll] = useState(false);
  const [approved, setApproved] = useState(hubApprovesPublishes);
  const [asking, setAsking] = useState(false);
  const [approvalNote, setApprovalNote] = useState<string | null>(null);
  const [unitFee, setUnitFee] = useState<number | null>(null);
  // Status messages stop between resources (and a small file sends only
  // one), so also show that time is passing.
  const [elapsed, setElapsed] = useState(0);
  const ticking = phase === "publishing" || phase === "room";
  useEffect(() => {
    if (!ticking) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [ticking, phase, batch.index]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      roomWait.current?.abort();
    };
  }, []);

  // The start screen of a share in batches names the fees.
  useEffect(() => {
    if (!multi) return;
    let active = true;
    void publishUnitFee().then((fee) => {
      if (active) setUnitFee(fee);
    });
    return () => {
      active = false;
    };
  }, [multi]);

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
      for (const id of ids) unsure.current.set(id, sentBy.current.get(id) ?? 0);
      // Progress from before the check is old news; what arrives from now
      // on shows Hub is still at work on the row.
      setProgress((prev) => without(prev, ids));
      const found = await findOnQdn(resources, replaces);
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
    [mark, allDone, finish, replaces]
  );

  /** One request to Hub for one batch. */
  const run = useCallback(
    async (request: MultiplePublishRequest): Promise<BatchOutcome> => {
      const ids = request.resources.map((r) => r.identifier);
      const current = ++attempt.current;
      waitingOn.current = current;
      for (const id of ids) sentBy.current.set(id, current);
      mark(ids, "waiting");
      setProgress((prev) => without(prev, ids));
      setAwaiting((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, current])) }));
      setPhase("publishing");
      setErrorText(null);
      setElapsed(0);
      const answered = () => {
        if (alive.current) setAwaiting((prev) => answeredBy(prev, ids, current));
      };
      // Another run, Stop waiting or Pause took over while Hub worked on this one.
      const movedOn = () => attempt.current !== current || waitingOn.current !== current;
      try {
        await qortalRequestWithTimeout(request, request.resources.length * PUBLISH_MS_PER_RESOURCE);
      } catch (error: any) {
        answered();
        if (!alive.current) return "stop";
        // A retry replaced this request: take only what its answer confirms.
        const superseded = attempt.current !== current;
        // The user stopped waiting for it and QDN has been checked already.
        const detached = !superseded && waitingOn.current !== current;
        // A decline (in any of Hub's languages, or its 60 s auto-decline) and
        // Hub's Cancel, which stops the batch and removes what it had
        // published, are the user's choice: close without an error. Once
        // earlier batches are on QDN, pause instead, so they aren't lost
        // from sight and Continue can send the rest.
        if (isHubDecline(error)) {
          settleUnsure(ids, current);
          if (superseded) return "stop";
          if (multi && publishedIds().length > 0) {
            mark(
              ids.filter((id) => rowsRef.current[id] !== "done"),
              "queued"
            );
            setPhase("settled");
          } else {
            onError(undefined, publishedIds(), stopped());
          }
          return "stop";
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
          return superseded || detached ? "stop" : "next";
        }
        if (superseded) return "stop";
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
          return "stop";
        }
        // A timeout is not a failure: Hub keeps going on its own clock, so
        // ask QDN. A user who stopped waiting asked QDN back then, before
        // Hub had got through the batch, so ask again: Retry is only for
        // what is still not there now.
        await verify(request.resources.filter((r) => rowsRef.current[r.identifier] !== "done"));
        return "stop";
      }
      answered();
      mark(ids, "done");
      if (allDone()) finish();
      return movedOn() ? "stop" : "next";
    },
    [mark, settleUnsure, finish, allDone, onError, publishedIds, stopped, verify, multi]
  );

  /**
   * Sends `resources` batch by batch. Before each batch of a share in
   * batches (and any batch bigger than the old 11-resource publish) the node
   * is asked whether the account has room for it.
   */
  const runAll = useCallback(
    async (resources: PublishResource[]) => {
      const mine = ++sequence.current;
      const parts = splitPublishBatches(resources);
      const current = () => alive.current && sequence.current === mine;
      mark(
        resources.map((r) => r.identifier),
        "queued"
      );
      setErrorText(null);
      for (let i = 0; i < parts.length; i++) {
        if (!current()) return;
        let part = parts[i];
        // A share in batches publishes its details only once every file is on
        // QDN (or goes in the same request): a share listing files that never
        // arrived could only be mended in Edit, with new uploads and fees.
        // Held back, the details wait for Retry or Continue.
        if (multi && part.some((r) => r.service === "DOCUMENT")) {
          const here = new Set(part.map((r) => r.identifier));
          const filesLeft = publishes.resources.some(
            (r) => r.service === "FILE" && !here.has(r.identifier) && rowsRef.current[r.identifier] !== "done"
          );
          if (filesLeft) part = part.filter((r) => r.service !== "DOCUMENT");
          if (part.length === 0) continue;
        }
        setBatch({ index: i, count: parts.length, size: part.length });
        if (publicKey && (multi || part.length > UNCHECKED_BATCH_MAX)) {
          setUnconfirmed(null);
          setPhase("room");
          const controller = new AbortController();
          roomWait.current = controller;
          await waitForRoom(publicKey, part.length, {
            signal: controller.signal,
            onWaiting: (count) => {
              if (current()) setUnconfirmed(count);
            },
          });
          if (roomWait.current === controller) roomWait.current = null;
          if (controller.signal.aborted || !current()) return;
        }
        if ((await run({ ...publishes, resources: part })) === "stop") return;
      }
      if (!current()) return;
      if (allDone()) finish();
      else setPhase("settled");
    },
    [mark, publicKey, multi, run, publishes, allDone, finish]
  );

  useEffect(() => {
    if (publishes && !hasStarted.current && !multi) {
      hasStarted.current = true;
      void runAll(publishes.resources);
    }
  }, [publishes, runAll, multi]);

  const resources = publishes?.resources ?? [];
  const total = resources.length;
  const fileTotal = resources.filter((r) => r.service === "FILE").length;
  const totalBytes = resources.reduce((sum, r) => sum + (r.service === "FILE" ? r.file.size : 0), 0);
  const stateOf = (id: string): ResourceState => rows[id] ?? "queued";
  const count = (state: ResourceState) => resources.filter((r) => stateOf(r.identifier) === state).length;
  // Not on QDN at the last check, but Hub has reported progress since.
  const isBusy = (id: string) => ["missing", "unknown"].includes(stateOf(id)) && Boolean(progress[id]);
  // Not on QDN, and Hub has not answered for the request that sent it yet.
  const isHeld = (id: string) => stateOf(id) === "missing" && id in awaiting;
  const doneCount = count("done");
  const failedCount = count("failed");
  const missingCount = count("missing");
  const queuedCount = count("queued");
  const heldCount = resources.filter((r) => isHeld(r.identifier)).length;
  const unknownCount = count("unknown");
  const settled = phase === "settled";
  // Hub is still at a batch the app stopped waiting for: the next batches
  // wait for its answer, or they would pile up past the account's limit
  // (Hub hasn't sent that batch's transactions yet, so the room check can't
  // see them) and the share details could land before those files.
  const hubBusy = Object.keys(awaiting).length > 0;
  const retryable = resources.filter((r) => {
    const state = stateOf(r.identifier);
    return (
      state === "failed" ||
      (state === "queued" && !hubBusy) ||
      (state === "missing" && !isBusy(r.identifier) && !isHeld(r.identifier))
    );
  });
  const uncertain = resources.filter((r) => ["missing", "unknown"].includes(stateOf(r.identifier)));
  const detailsDone = resources.some((r) => r.service === "DOCUMENT" && stateOf(r.identifier) === "done");
  const filesLeft = resources.filter((r) => r.service === "FILE" && stateOf(r.identifier) !== "done").length;
  const canRetryFiles = retryable.some((r) => r.service === "FILE");
  const canStopWaiting = phase === "publishing" && elapsed >= STOP_WAITING_AFTER_S;

  const close = () => {
    sequence.current += 1;
    roomWait.current?.abort();
    onError(undefined, publishedIds(), stopped());
  };
  const retry = () => void runAll(retryable);
  const checkAgain = () => {
    setErrorText(null);
    verify(uncertain);
  };
  // Hub carries on and is still listened to; only the app stops waiting.
  const stopWaiting = () => {
    waitingOn.current = 0;
    sequence.current += 1;
    verify(resources.filter((r) => !["done", "queued"].includes(stateOf(r.identifier))));
  };
  // Between batches nothing is out with Hub: stop before the next one.
  const pause = () => {
    sequence.current += 1;
    roomWait.current?.abort();
    setPhase("settled");
  };

  const start = async () => {
    if (approveAll && !approved) {
      setAsking(true);
      setApprovalNote(null);
      try {
        // Hub's own dialog explains the grant; give the user time to read it.
        await qortalRequestWithTimeout(
          { action: "SESSION_PERMISSIONS", permissions: ["PUBLISH_MULTIPLE_QDN_RESOURCES"] },
          5 * 60 * 1000
        );
        hubApprovesPublishes = true;
        setApproved(true);
      } catch (error) {
        if (!alive.current) return;
        setAsking(false);
        setApproveAll(false);
        setApprovalNote(
          isHubDecline(error)
            ? "Hub didn't grant it, so it will ask you to confirm each batch."
            : "This version of Hub can't approve every batch at once, so it will ask you to confirm each batch."
        );
        return;
      }
      if (!alive.current) return;
      setAsking(false);
    }
    hasStarted.current = true;
    void runAll(resources);
  };

  const hubAsks = approved ? "Hub publishes it without asking again" : "Hub asks you to confirm this batch";
  const title =
    phase === "ready"
      ? `Publish in ${batches.length} batches`
      : phase === "room"
        ? "Waiting for the network"
        : phase === "publishing"
          ? multi
            ? `Publishing batch ${batch.index + 1} of ${batch.count}`
            : "Publishing"
          : phase === "checking"
            ? "Checking QDN"
            : unknownCount > 0
              ? "Publish not confirmed"
              : failedCount === total
                ? "Publish failed"
                : queuedCount > 0 && failedCount === 0 && missingCount === 0
                  ? "Publish paused"
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
        phase === "ready" ? (
          <>
            <Button color="inherit" onClick={close} disabled={asking}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void start()} disabled={asking}>
              {asking ? "Waiting for Hub…" : "Start publishing"}
            </Button>
          </>
        ) : phase === "room" ? (
          <Button color="inherit" onClick={pause}>
            Pause
          </Button>
        ) : settled ? (
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
                {retryable.some((r) => stateOf(r.identifier) === "queued")
                  ? "Continue"
                  : retryable.some((r) => stateOf(r.identifier) === "missing")
                    ? "Retry missing"
                    : "Retry failed"}
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
        {phase === "ready" ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography>
              {fileTotal} files{total > fileTotal ? " and the share details" : ""}: {total} publishes in{" "}
              {batches.length} batches of up to {FILES_PER_BATCH} files
              {totalBytes > 0 ? ` (${formatBytes(totalBytes)})` : ""}
              {unitFee ? `, ${formatQort(unitFee * total)} in fees` : ""}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Qortal takes at most {MAX_UNCONFIRMED_PER_ACCOUNT} unconfirmed publishes per account, so each batch waits
              for the network to confirm the one before. A block comes about once a minute. Keep this tab open until it
              finishes. If you stop, the files already on QDN stay in your draft and aren't sent again.
            </Typography>
            {approved ? (
              <Alert severity="info">Hub approves Q-Share+'s publishes for this session, so it won't ask for each batch.</Alert>
            ) : (
              <Box>
                <FormControlLabel
                  control={<Switch checked={approveAll} onChange={(e) => setApproveAll(e.target.checked)} disabled={asking} />}
                  label="Approve every batch at once"
                  sx={{ minHeight: 44, mr: 0 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Hub asks once, then publishes from Q-Share+ without asking again until you close this tab. Otherwise
                  Hub asks you to confirm each of the {batches.length} batches.
                </Typography>
              </Box>
            )}
            {approvalNote && <Alert severity="info">{approvalNote}</Alert>}
          </Box>
        ) : phase === "room" ? (
          <Box>
            <LinearProgress aria-label="Waiting for the network" />
            <Typography sx={{ mt: 1.5 }}>
              {batch.index === 0
                ? `Your account has transactions waiting for a block. Qortal takes at most ${MAX_UNCONFIRMED_PER_ACCOUNT} per account, so the first batch goes once they are confirmed.`
                : `Batch ${batch.index} of ${batch.count} is published. Batch ${batch.index + 1} goes once the network has confirmed it: a block comes about once a minute.`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }} aria-live="off">
              {unconfirmed !== null ? `${unconfirmed} still unconfirmed · ` : ""}
              {clock(elapsed)} so far. {doneCount} of {total} published.
            </Typography>
          </Box>
        ) : phase === "publishing" ? (
          <Box>
            <LinearProgress aria-label="Publishing" />
            {multi ? (
              <Typography sx={{ mt: 1.5 }}>
                Publishing {batch.size} {batch.size === 1 ? "resource" : "resources"}… {hubAsks}, then keep this tab
                open. {doneCount} of {total} published.
              </Typography>
            ) : (
              <Typography sx={{ mt: 1.5 }}>
                Publishing {total} {total === 1 ? "resource" : "resources"}
                {totalBytes > 0 ? ` (${formatBytes(totalBytes)})` : ""}… Hub asks you to confirm once, then keep this
                tab open.
              </Typography>
            )}
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
        {settled && queuedCount > 0 && (
          <Alert severity="info">
            {queuedCount === 1 ? "1 resource hasn't" : `${queuedCount} resources haven't`} been sent yet.{" "}
            {hubBusy
              ? "Continue comes back once Hub answers for the batch it is on."
              : `Continue sends ${queuedCount === 1 ? "it" : "them"}, waiting for the network between batches.`}
          </Alert>
        )}
        {settled && failedCount > 0 && (
          <Alert severity="warning">
            Some resources were not published. Retry sends only the failed ones; if it keeps failing, wait a minute
            and try again.
          </Alert>
        )}
        {settled && heldCount > 0 && (
          <Alert severity="info">
            Hub has not answered for this publish yet. It publishes one resource at a time, so what is not on QDN yet
            may still be on its way, and Retry waits for Hub's answer so you never pay twice. Check again later, or
            close: Hub keeps publishing.
          </Alert>
        )}
        {settled && missingCount > heldCount && (
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
            const label = resourceLabel(resource);
            const busy = isBusy(resource.identifier);
            // Hub's progress matters while the row waits on Hub, or when Hub
            // is still at work on a row the last check did not find.
            const working = state === "waiting" || busy ? progress[resource.identifier] : undefined;
            const percent = progressPercent(working);
            const line = busy
              ? [STILL_UPLOADING, progressText(working)].filter(Boolean).join(" · ")
              : (progressText(working) ?? STATE_TEXT[state]);
            return (
              <ListItem key={resource.identifier} divider sx={{ minHeight: 48, px: 0 }}>
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
                  slotProps={{ primary: { noWrap: true, title: label } }}
                />
                <Box sx={{ ml: 1, display: "flex", alignItems: "center" }}>
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
