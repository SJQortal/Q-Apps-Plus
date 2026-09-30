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
import { fileKind, fileKindIconElement } from "../../../utils/fileKind";
import { formatBytes } from "../../../utils/formatBytes";
import type { MultiplePublishRequest, PublishResource } from "../../../utils/publishPayload";
import { publishErrorMessage } from "../../PublishFile/shareDraft";
import { ResponsiveDialog } from "../mobile/ResponsiveDialog";

interface MultiplePublishProps {
  publishes: MultiplePublishRequest;
  isOpen: boolean;
  /** Everything is on QDN. */
  onSubmit: () => void;
  /** The user declined, the request timed out, or they cancelled after a failure. */
  onError: (message?: string) => void;
}

type ResourceState = "waiting" | "done" | "failed";

const SECONDS_PER_RESOURCE = 30;

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
  if (state === "done") return <CheckCircleOutlinedIcon sx={{ color: "success.main" }} titleAccess="Published" />;
  if (state === "failed") return <ErrorOutlineOutlinedIcon sx={{ color: "error.main" }} titleAccess="Failed" />;
  return <CircularProgress size={20} aria-label="Waiting" />;
}

/**
 * Sends the share's resources to Hub in one PUBLISH_MULTIPLE_QDN_RESOURCES
 * request and shows what landed. Hub confirms the whole batch once and only
 * answers when it is finished, so there is no per-file progress: the bar is
 * indeterminate until the request returns, then each resource is done or
 * failed and the failed ones can be retried on their own.
 */
export const MultiplePublish = ({ publishes, isOpen, onSubmit, onError }: MultiplePublishProps) => {
  const [isPublishing, setIsPublishing] = useState(true);
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [errorText, setErrorText] = useState<string | null>(null);
  const hasStarted = useRef(false);
  // Hub reports nothing while it works, so at least show that time is passing.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isPublishing) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [isPublishing]);

  const run = useCallback(
    async (request: MultiplePublishRequest) => {
      const ids = request.resources.map((r) => r.identifier);
      setIsPublishing(true);
      setErrorText(null);
      try {
        await qortalRequestWithTimeout(request, request.resources.length * SECONDS_PER_RESOURCE * 1000);
        setDone((prev) => new Set([...prev, ...ids]));
        setFailed(new Set());
        onSubmit();
      } catch (error: any) {
        if (error?.error === "User declined request") {
          onError();
          return;
        }
        if (error?.error === "The request timed out") {
          onError("The request timed out");
          return;
        }
        const unsuccessful: string[] = (error?.error?.unsuccessfulPublishes || [])
          .map((item: { identifier?: string }) => item?.identifier)
          .filter(Boolean);
        // Without a list from Hub nothing in this batch is known to have landed.
        const failedIds = unsuccessful.length > 0 ? unsuccessful : ids;
        setFailed(new Set(failedIds));
        setDone((prev) => new Set([...prev, ...ids.filter((id) => !failedIds.includes(id))]));
        if (unsuccessful.length === 0) setErrorText(publishErrorMessage(error, "Publishing failed"));
      } finally {
        setIsPublishing(false);
      }
    },
    [onSubmit, onError]
  );

  useEffect(() => {
    if (publishes && !hasStarted.current) {
      hasStarted.current = true;
      run(publishes);
    }
  }, [publishes, run]);

  const retry = () => {
    run({ ...publishes, resources: publishes.resources.filter((r) => failed.has(r.identifier)) });
  };

  const resources = publishes?.resources ?? [];
  const total = resources.length;
  const totalBytes = resources.reduce((sum, r) => sum + (r.service === "FILE" ? r.file.size : 0), 0);
  const stateOf = (id: string): ResourceState => (failed.has(id) ? "failed" : done.has(id) ? "done" : "waiting");
  const showRetry = !isPublishing && failed.size > 0;

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={() => {
        if (!isPublishing) onError();
      }}
      title={isPublishing ? "Publishing" : "Publish incomplete"}
      maxWidth="sm"
      dismissible={false}
      actions={
        showRetry ? (
          <>
            <Button color="inherit" onClick={() => onError()}>
              Cancel
            </Button>
            <Button variant="contained" onClick={retry}>
              Retry failed
            </Button>
          </>
        ) : undefined
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {isPublishing ? (
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
          </Box>
        ) : (
          <Box>
            <LinearProgress
              variant="determinate"
              value={total ? (done.size / total) * 100 : 0}
              aria-label="Published"
              color={failed.size > 0 ? "warning" : "success"}
            />
            <Typography sx={{ mt: 1.5, fontWeight: 600 }}>
              {done.size} of {total} published
            </Typography>
          </Box>
        )}

        {errorText && <Alert severity="error">{errorText}</Alert>}
        {showRetry && (
          <Alert severity="warning">
            Some resources were not published. Retry sends only the failed ones; if it keeps failing, wait a minute
            and try again.
          </Alert>
        )}

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
                  secondary={state === "waiting" ? "Waiting" : state === "done" ? "Published" : "Failed"}
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
