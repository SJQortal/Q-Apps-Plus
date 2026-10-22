/**
 * Publishes the seller's catalogues and product index and shows what landed
 * (it replaces the original's MultiplePublish dialog).
 *
 * - Up to 20 resources go in one PUBLISH_MULTIPLE_QDN_RESOURCES, exactly as
 *   the original sent them, with Hub's 30-minute budget.
 * - More go in batches of 20 (qdn/publishBatches.ts): before each batch the
 *   node is asked whether the seller's account has room (Core refuses a 26th
 *   unconfirmed transaction), and the product index goes last, only once
 *   every catalogue it names is on QDN.
 * - When Hub names resources that failed, only those are retried. A decline
 *   is quiet. A timeout is not a failure: Hub keeps going, so QDN is checked
 *   (the content, not only the identifier, since catalogues and the index
 *   replace older versions) before anything is offered again, because every
 *   retry costs a fee.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { errorMessage, isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { base64ToJson, type PublishResource } from "../qdn/payloads";
import { QdnFetchError, fetchQdnJson, mapWithConcurrency } from "../qdn/search";
import {
  MAX_UNCONFIRMED_PER_ACCOUNT,
  RESOURCES_PER_BATCH,
  formatQort,
  isProductIndex,
  publishUnitFee,
  roomTiming,
  splitPublishBatches,
  waitForRoom,
} from "../qdn/publishBatches";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";

type RowState = "queued" | "waiting" | "checking" | "done" | "failed" | "missing" | "unknown";
/** "ready": a publish in batches waits for Start; "room": waiting for the network between batches. */
type Phase = "ready" | "room" | "publishing" | "checking" | "settled";

const STATE_TEXT: Record<RowState, string> = {
  queued: "Not sent yet",
  waiting: "Publishing",
  checking: "Checking QDN",
  done: "Published",
  failed: "Failed",
  missing: "Not on QDN yet",
  unknown: "Not confirmed",
};

/** After this long without an answer from Hub, "Stop waiting" checks QDN instead. */
export const STOP_WAITING_AFTER_MS = 60_000;

/** The same JSON, whatever the key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Is exactly this resource on QDN? "done" when the node serves the content
 * this publish sent, "missing" when it serves something else or nothing,
 * "unknown" when the node can't be asked.
 */
export async function checkOnQdn(resource: PublishResource): Promise<"done" | "missing" | "unknown"> {
  try {
    const body = await fetchQdnJson(resource.service, resource.name, resource.identifier, { fresh: true });
    return canonical(body) === canonical(base64ToJson(resource.data64)) ? "done" : "missing";
  } catch (error) {
    return error instanceof QdnFetchError ? "missing" : "unknown";
  }
}

function StateIcon({ state }: { state: RowState }) {
  const title = STATE_TEXT[state];
  if (state === "done") return <CheckCircleOutlinedIcon sx={{ color: "success.main" }} titleAccess={title} />;
  if (state === "failed") return <ErrorOutlineOutlinedIcon sx={{ color: "error.main" }} titleAccess={title} />;
  if (state === "missing") return <ReportProblemOutlinedIcon sx={{ color: "warning.main" }} titleAccess={title} />;
  if (state === "unknown") return <HelpOutlineOutlinedIcon sx={{ color: "text.secondary" }} titleAccess={title} />;
  if (state === "queued") return <ScheduleOutlinedIcon sx={{ color: "text.secondary" }} titleAccess={title} />;
  return <CircularProgress size={20} aria-label={title} />;
}

export interface PublishProductsDialogProps {
  open: boolean;
  /** The catalogues, then the product index, as buildProductPublish returns them. */
  resources: PublishResource[];
  /** A readable name per identifier ("Catalogue · 10 products", "Product list"). */
  labels: Record<string, string>;
  /** The seller's public key, for the room check between batches. */
  publicKey?: string;
  /** Everything is on QDN. */
  onDone: () => void;
  /** Closed before everything was on QDN (declined, cancelled, or closed after a failure). */
  onClose: (published: string[]) => void;
}

export function PublishProductsDialog({ open, resources, labels, publicKey, onDone, onClose }: PublishProductsDialogProps) {
  const batched = resources.length > RESOURCES_PER_BATCH;
  const plan = useMemo(() => splitPublishBatches(resources), [resources]);
  const [phase, setPhase] = useState<Phase>(batched ? "ready" : "publishing");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const rowsRef = useRef(rows);
  const [batch, setBatch] = useState({ index: 0, count: plan.length });
  const [unconfirmed, setUnconfirmed] = useState<number | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [unitFee, setUnitFee] = useState<number | null>(null);
  // Requests to Hub so far, and the one that has waited a minute without an answer.
  const [round, setRound] = useState(0);
  const [slowRound, setSlowRound] = useState(0);
  const alive = useRef(true);
  const finished = useRef(false);
  const started = useRef(false);
  // Each run through the batches is numbered: Pause, Stop waiting and Close end the one before.
  const sequence = useRef(0);
  // Each request to Hub is numbered; Stop waiting detaches the current one.
  const attempt = useRef(0);
  const detached = useRef(0);
  const inFlight = useRef<PublishResource[]>([]);
  const roomWait = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      roomWait.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!batched) return;
    let active = true;
    void publishUnitFee().then((fee) => {
      if (active) setUnitFee(fee);
    });
    return () => {
      active = false;
    };
  }, [batched]);

  // Hub has no cancel for a publish; after a minute, offer to check QDN instead of waiting.
  useEffect(() => {
    if (phase !== "publishing") return;
    const timer = window.setTimeout(() => setSlowRound(round), STOP_WAITING_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [phase, round]);
  const slow = phase === "publishing" && round > 0 && slowRound === round;

  const mark = useCallback((ids: string[], state: RowState) => {
    if (ids.length === 0) return;
    const next = { ...rowsRef.current };
    for (const id of ids) next[id] = state;
    rowsRef.current = next;
    if (alive.current) setRows(next);
  }, []);

  const publishedIds = useCallback(
    () => resources.filter((r) => rowsRef.current[r.identifier] === "done").map((r) => r.identifier),
    [resources]
  );
  const allDone = useCallback(() => resources.every((r) => rowsRef.current[r.identifier] === "done"), [resources]);

  const finish = useCallback(() => {
    if (finished.current || !alive.current) return;
    finished.current = true;
    onDone();
  }, [onDone]);

  const verify = useCallback(
    async (list: PublishResource[]) => {
      const ids = list.map((r) => r.identifier);
      setPhase("checking");
      mark(ids, "checking");
      const results = await mapWithConcurrency(list, 4, checkOnQdn);
      if (!alive.current) return;
      list.forEach((r, i) => {
        if (rowsRef.current[r.identifier] === "checking") mark([r.identifier], results[i]);
      });
      if (allDone()) finish();
      else setPhase("settled");
    },
    [mark, allDone, finish]
  );

  /** One request to Hub for one batch. */
  const run = useCallback(
    async (part: PublishResource[]): Promise<"next" | "stop"> => {
      const ids = part.map((r) => r.identifier);
      const n = ++attempt.current;
      setRound(n);
      inFlight.current = part;
      mark(ids, "waiting");
      setPhase("publishing");
      setErrorText(null);
      const notDone = () => ids.filter((id) => rowsRef.current[id] !== "done");
      try {
        await qortalRequestWithTimeout({ action: "PUBLISH_MULTIPLE_QDN_RESOURCES", resources: part }, PUBLISH_TIMEOUT_MS);
      } catch (error: any) {
        if (!alive.current || detached.current === n) return "stop";
        if (isHubDecline(error)) {
          mark(notDone(), "queued");
          if (publishedIds().length === 0) onClose([]);
          else setPhase("settled");
          return "stop";
        }
        const unsuccessful: string[] = (error?.error?.unsuccessfulPublishes || [])
          .map((item: { identifier?: string }) => item?.identifier)
          .filter((id: unknown): id is string => typeof id === "string" && ids.includes(id));
        if (unsuccessful.length > 0) {
          mark(
            ids.filter((id) => !unsuccessful.includes(id)),
            "done"
          );
          mark(unsuccessful, "failed");
          if (allDone()) finish();
          // Nothing of the batch landed: the next ones would fare the same.
          if (ids.every((id) => unsuccessful.includes(id))) {
            setPhase("settled");
            return "stop";
          }
          return "next";
        }
        if (isHubTimeout(error)) {
          await verify(part.filter((r) => rowsRef.current[r.identifier] !== "done"));
          return "stop";
        }
        // Hub's checks before it publishes anything (name, balance, space): nothing of this batch is on QDN.
        mark(notDone(), "failed");
        setErrorText(errorMessage(error, "Publishing failed"));
        setPhase("settled");
        return "stop";
      }
      if (!alive.current) return "stop";
      mark(ids, "done");
      // A late answer after Stop waiting still counts.
      if (detached.current === n) {
        if (allDone()) finish();
        return "stop";
      }
      return "next";
    },
    [mark, publishedIds, onClose, allDone, finish, verify]
  );

  const runAll = useCallback(
    async (list: PublishResource[]) => {
      const mine = ++sequence.current;
      const current = () => alive.current && sequence.current === mine;
      const parts = batched ? splitPublishBatches(list) : [list];
      mark(
        list.map((r) => r.identifier),
        "queued"
      );
      setErrorText(null);
      for (let i = 0; i < parts.length; i++) {
        if (!current()) return;
        let part = parts[i];
        // The index names every catalogue: it goes only once they are all on QDN.
        if (batched && part.some(isProductIndex)) {
          const here = new Set(part.map((r) => r.identifier));
          const left = resources.some(
            (r) => !isProductIndex(r) && !here.has(r.identifier) && rowsRef.current[r.identifier] !== "done"
          );
          if (left) part = part.filter((r) => !isProductIndex(r));
          if (part.length === 0) continue;
        }
        setBatch({ index: i, count: parts.length });
        if (batched && publicKey) {
          setUnconfirmed(null);
          setPhase("room");
          const controller = new AbortController();
          roomWait.current = controller;
          await waitForRoom(publicKey, part.length, {
            signal: controller.signal,
            onWaiting: (count) => {
              if (current()) setUnconfirmed(count);
            },
            unknownWaitMs: i > 0 ? roomTiming.unknownMs : 0,
          });
          if (roomWait.current === controller) roomWait.current = null;
          if (controller.signal.aborted || !current()) return;
        }
        if ((await run(part)) === "stop") return;
      }
      if (!current()) return;
      if (allDone()) finish();
      else setPhase("settled");
    },
    [batched, mark, resources, publicKey, run, allDone, finish]
  );

  useEffect(() => {
    if (started.current || batched || resources.length === 0) return;
    started.current = true;
    void runAll(resources);
  }, [batched, resources, runAll]);

  const stateOf = (id: string): RowState => rows[id] ?? "queued";
  const count = (state: RowState) => resources.filter((r) => stateOf(r.identifier) === state).length;
  const total = resources.length;
  const doneCount = count("done");
  const failedCount = count("failed");
  const missingCount = count("missing");
  const unknownCount = count("unknown");
  const queuedCount = count("queued");
  const retryable = resources.filter((r) => ["failed", "missing", "queued"].includes(stateOf(r.identifier)));
  const uncertain = resources.filter((r) => ["missing", "unknown"].includes(stateOf(r.identifier)));
  const settled = phase === "settled";

  const close = () => {
    sequence.current += 1;
    roomWait.current?.abort();
    onClose(publishedIds());
  };
  const pause = () => {
    sequence.current += 1;
    roomWait.current?.abort();
    setPhase("settled");
  };
  const stopWaiting = () => {
    detached.current = attempt.current;
    sequence.current += 1;
    void verify(inFlight.current.filter((r) => rowsRef.current[r.identifier] !== "done"));
  };
  const start = () => {
    started.current = true;
    void runAll(resources);
  };

  const title =
    phase === "ready"
      ? `Publish in ${plan.length} batches`
      : phase === "room"
        ? "Waiting for the network"
        : phase === "publishing"
          ? batched
            ? `Publishing batch ${batch.index + 1} of ${batch.count}`
            : "Publishing products"
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
      open={open}
      // While Hub publishes, the title bar's X (phone: Back) stops waiting and checks QDN; Hub carries on.
      onClose={phase === "publishing" ? stopWaiting : phase === "room" ? pause : phase === "checking" ? () => {} : close}
      title={title}
      maxWidth="sm"
      dismissible={false}
      actions={
        phase === "ready" ? (
          <>
            <Button color="inherit" onClick={close}>
              Cancel
            </Button>
            <Button variant="contained" onClick={start}>
              Start publishing
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
              <Button variant="outlined" onClick={() => void verify(uncertain)}>
                Check again
              </Button>
            )}
            {retryable.length > 0 && (
              <Button variant="contained" onClick={() => void runAll(retryable)}>
                {failedCount > 0 ? "Retry failed" : missingCount > 0 ? "Retry missing" : "Continue"}
              </Button>
            )}
          </>
        ) : phase === "publishing" && slow ? (
          <Button color="inherit" onClick={stopWaiting}>
            Stop waiting
          </Button>
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {phase === "ready" ? (
          <>
            <Typography>
              {total} publishes in {plan.length} batches of up to {RESOURCES_PER_BATCH}
              {unitFee ? `, ${formatQort(unitFee * total)} in fees` : ""}.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Qortal takes at most {MAX_UNCONFIRMED_PER_ACCOUNT} unconfirmed publishes per account, so each batch waits for
              the network to confirm the one before; a block comes about once a minute. Hub asks you to confirm each batch.
              Your product list goes last, once every product is on QDN. Keep this tab open until it finishes.
            </Typography>
          </>
        ) : phase === "room" ? (
          <Box>
            <LinearProgress aria-label="Waiting for the network" />
            <Typography sx={{ mt: 1.5 }}>
              {batch.index === 0
                ? `Your account has publishes waiting for a block. Qortal takes at most ${MAX_UNCONFIRMED_PER_ACCOUNT} per account, so the first batch goes once they are confirmed.`
                : `Batch ${batch.index} of ${batch.count} is sent. The next goes once the network has confirmed it, about a minute.`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {unconfirmed !== null ? `${unconfirmed} still unconfirmed. ` : ""}
              {doneCount} of {total} published.
            </Typography>
          </Box>
        ) : phase === "publishing" ? (
          <Box>
            <LinearProgress aria-label="Publishing" />
            <Typography sx={{ mt: 1.5 }}>
              Hub asks you to confirm, then publishes. Keep this tab open. {batched ? `${doneCount} of ${total} published.` : ""}
            </Typography>
            {slow && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Hub hasn&apos;t answered yet. Stop waiting checks QDN for what has landed; Hub keeps publishing either way.
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
            <LinearProgress variant="determinate" value={total ? (doneCount / total) * 100 : 0} aria-label="Published" />
            <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
              {doneCount} of {total} published
            </Typography>
          </Box>
        )}

        {errorText && <Alert severity="error">{errorText}</Alert>}
        {settled && failedCount > 0 && (
          <Alert severity="warning">
            Some parts were not published. Retry sends only those; if it keeps failing, wait a minute and try again.
          </Alert>
        )}
        {settled && queuedCount > 0 && failedCount === 0 && (
          <Alert severity="info">
            {queuedCount === 1 ? "1 part hasn't" : `${queuedCount} parts haven't`} been sent yet. Continue sends{" "}
            {queuedCount === 1 ? "it" : "them"}.
          </Alert>
        )}
        {settled && missingCount > 0 && (
          <Alert severity="warning">
            Some parts are not on QDN yet. Hub may still be publishing them, so check again before you retry: each retry
            costs a new fee.
          </Alert>
        )}
        {settled && unknownCount > 0 && (
          <Alert severity="warning">Could not check QDN. Hub may still be publishing, so check again before you publish again.</Alert>
        )}
        {settled && (
          <Typography variant="body2" color="text.secondary">
            Your shop shows the changes once its product list is published. Until then your drafts stay in Ready to publish.
          </Typography>
        )}

        <List dense disablePadding aria-label="What is published">
          {resources.map((r) => {
            const state = stateOf(r.identifier);
            return (
              <ListItem key={r.identifier} divider sx={{ minHeight: 48, px: 0 }}>
                <ListItemText primary={labels[r.identifier] ?? r.identifier} secondary={STATE_TEXT[state]} />
                <ListItemIcon sx={{ minWidth: 0, ml: 1 }}>
                  <StateIcon state={state} />
                </ListItemIcon>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </ResponsiveDialog>
  );
}
