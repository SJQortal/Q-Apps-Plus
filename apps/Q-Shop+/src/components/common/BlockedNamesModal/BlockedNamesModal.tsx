/**
 * Settings → Blocked names: the `blockedNames_q-blog` list, which the original
 * Q-Shop (built from Q-Blog) shares with Q-Blog, read and changed with the
 * same GET_LIST_ITEMS / DELETE_LIST_ITEM calls (Simon, night 1: keep the
 * shared list so the original keeps working). Full-screen on phones.
 *
 * Hub refuses list actions on a public node (GO's default) and a declined
 * "access your list" dialog is the user's choice: neither is an error
 * (docs/QORTAL.md, pitfalls 11 and 13).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Box, Button, List, ListItem, Skeleton, Typography } from "@mui/material";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { ResponsiveDialog } from "../mobile/ResponsiveDialog";
import { EmptyState } from "../EmptyState";
import { setNotification } from "../../../state/features/notificationsSlice";
import { HUB_DIALOG_GRACE_MS, isHubDecline, isHubTimeout, isPublicNodeRefusal } from "../../../qdn/hubErrors";

/** The list the original Q-Shop reads and writes (shared with Q-Blog). */
export const BLOCKED_NAMES_LIST = "blockedNames_q-blog";

/**
 * Hub stops waiting for DELETE_LIST_ITEM after 30 s, but its dialog stays up
 * for 60 s and a late Accept still unblocks. Read the list again once the
 * dialog has gone.
 */
export const RECHECK_AFTER_TIMEOUT_MS = HUB_DIALOG_GRACE_MS;

export { isPublicNodeRefusal };

export const PUBLIC_NODE_TEXT = "Not available on a public node";

type Unavailable = "public-node" | "declined" | null;

interface BlockedNamesModalProps {
  open: boolean;
  onClose: () => void;
}

export const BlockedNamesModal: React.FC<BlockedNamesModalProps> = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [blockedNames, setBlockedNames] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState<Unavailable>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const recheckTimer = useRef<number | undefined>(undefined);

  // State is set in promise callbacks, never synchronously from the effect.
  const load = useCallback(
    () =>
      Promise.resolve()
        .then(() => qortalRequest({ action: "GET_LIST_ITEMS", list_name: BLOCKED_NAMES_LIST }))
        .then((response) => {
          setBlockedNames(Array.isArray(response) ? response.filter((n): n is string => typeof n === "string") : []);
          setFailed(false);
          setUnavailable(null);
        })
        .catch((err) => {
          setBlockedNames((prev) => prev ?? []);
          if (isPublicNodeRefusal(err)) setUnavailable("public-node");
          else if (isHubDecline(err)) setUnavailable("declined");
          else setFailed(true);
        }),
    []
  );

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => () => window.clearTimeout(recheckTimer.current), []);

  const retry = () => {
    setBlockedNames(null);
    setFailed(false);
    setUnavailable(null);
    load();
  };

  const unblock = async (name: string) => {
    setBusy(name);
    try {
      const response = await qortalRequest({ action: "DELETE_LIST_ITEM", list_name: BLOCKED_NAMES_LIST, item: name });
      if (response === true) setBlockedNames((prev) => (prev ?? []).filter((n) => n !== name));
      // The node removed nothing: the name was not on its list, so show what is.
      else load();
    } catch (err) {
      if (isPublicNodeRefusal(err)) setUnavailable("public-node");
      else if (isHubTimeout(err)) {
        window.clearTimeout(recheckTimer.current);
        recheckTimer.current = window.setTimeout(() => load(), RECHECK_AFTER_TIMEOUT_MS);
      } else if (!isHubDecline(err)) {
        dispatch(setNotification({ msg: `Could not unblock ${name}. Try again in a moment.`, alertType: "error" }));
      }
    } finally {
      setBusy(null);
    }
  };

  let body: React.ReactNode;
  if (unavailable === "public-node") {
    body = (
      <Typography variant="body2" color="text.secondary" role="status" sx={{ py: 1 }}>
        {PUBLIC_NODE_TEXT}. Your block list lives on your own node; open Q-Shop+ there to change it.
      </Typography>
    );
  } else if (blockedNames === null) {
    body = (
      <Box role="status" aria-label="Loading blocked names" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} variant="rounded" height={44} />
        ))}
      </Box>
    );
  } else if (unavailable === "declined") {
    body = (
      <EmptyState
        title="Access not granted"
        description="Allow Q-Shop+ to read your block list in Hub to see it here."
        actionLabel="Try again"
        onAction={retry}
      />
    );
  } else if (failed) {
    body = (
      <EmptyState
        title="The block list could not be loaded"
        description="Check that Hub is connected to your node, then try again."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (blockedNames.length === 0) {
    body = (
      <EmptyState
        icon={<PersonOffOutlinedIcon />}
        title="No blocked names"
        description="Names you block in Q-Shop or Q-Blog show here."
      />
    );
  } else {
    body = (
      <List disablePadding aria-label="Blocked names">
        {blockedNames.map((name) => (
          <ListItem
            key={name}
            disableGutters
            sx={{ minHeight: 52, gap: 1, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
          >
            <Typography sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{name}</Typography>
            <Button
              variant="outlined"
              size="small"
              aria-label={`Unblock ${name}`}
              disabled={busy === name}
              onClick={() => unblock(name)}
              sx={{ minHeight: 44, minWidth: 96, flexShrink: 0 }}
            >
              {busy === name ? "Unblocking…" : "Unblock"}
            </Button>
          </ListItem>
        ))}
      </List>
    );
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Blocked names"
      maxWidth="xs"
      actions={
        <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
          Done
        </Button>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        The block list Q-Shop shares with Q-Blog. Unblocking a name here unblocks it in both.
      </Typography>
      {body}
    </ResponsiveDialog>
  );
};
