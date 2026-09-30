import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Box, Button, List, ListItem, Skeleton, Typography } from "@mui/material";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { ResponsiveDialog } from "../mobile/ResponsiveDialog";
import { EmptyState } from "../EmptyState";
import { setNotification } from "../../../state/features/notificationsSlice";
import { isHubDecline, isHubTimeout } from "../../../utils/hubErrors";

interface PostModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Hub stops waiting for DELETE_LIST_ITEM after 30 s, but its dialog stays up
 * for 60 s and a late Accept still unblocks. Read the list again once the
 * dialog has gone.
 */
export const RECHECK_AFTER_TIMEOUT_MS = 35_000;

/**
 * The Qortal-wide `blockedNames` list. Reading and unblocking use the same
 * GET_LIST_ITEMS / DELETE_LIST_ITEM calls as the original app.
 */
export const BlockedNamesModal: React.FC<PostModalProps> = ({ open, onClose }) => {
  const dispatch = useDispatch();
  const [blockedNames, setBlockedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The user said no to Hub's "access your list" prompt: close without an error.
  const [declined, setDeclined] = useState(false);
  const recheckTimer = useRef<number | undefined>(undefined);

  // State is set in promise callbacks, never synchronously from the effect.
  const load = useCallback(() => {
    const listName = `blockedNames`;
    return Promise.resolve()
      .then(() =>
        qortalRequest({
          action: "GET_LIST_ITEMS",
          list_name: listName
        })
      )
      .then((response) => {
        setBlockedNames(Array.isArray(response) ? response : []);
        setError(null);
      })
      .catch((err) => {
        if (isHubDecline(err)) setDeclined(true);
        else setError("The blocked list could not be loaded.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (declined) onClose();
  }, [declined, onClose]);

  useEffect(() => () => window.clearTimeout(recheckTimer.current), []);

  const retry = () => {
    setLoading(true);
    setError(null);
    load();
  };

  const removeFromBlockList = async (name: string) => {
    setBusy(name);
    try {
      const response = await qortalRequest({
        action: "DELETE_LIST_ITEM",
        list_name: "blockedNames",
        item: name
      });

      if (response === true) {
        setBlockedNames((prev) => prev.filter((n) => n !== name));
      } else {
        // The node removed nothing: the name was not on its list, so show what is.
        load();
      }
    } catch (err) {
      if (isHubTimeout(err)) {
        window.clearTimeout(recheckTimer.current);
        recheckTimer.current = window.setTimeout(() => load(), RECHECK_AFTER_TIMEOUT_MS);
      } else if (!isHubDecline(err)) {
        dispatch(setNotification({ msg: `Could not unblock ${name}`, alertType: "error" }));
      }
    } finally {
      setBusy(null);
    }
  };

  let body: React.ReactNode;
  if (loading || declined) {
    body = (
      <Box role="status" aria-label="Loading blocked names" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} variant="rounded" height={44} />
        ))}
      </Box>
    );
  } else if (error) {
    body = <EmptyState title={error} description="Check that Hub is connected, then try again." actionLabel="Retry" onAction={retry} />;
  } else if (blockedNames.length === 0) {
    body = (
      <EmptyState
        icon={<PersonOffOutlinedIcon />}
        title="No blocked names"
        description="Names you block from a share's menu will show here."
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
            <Typography sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {name}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              aria-label={`Unblock ${name}`}
              disabled={busy === name}
              onClick={() => removeFromBlockList(name)}
              sx={{ minHeight: 44, minWidth: 88, flexShrink: 0 }}
            >
              Remove
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
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Close
        </Button>
      }
    >
      {body}
    </ResponsiveDialog>
  );
};
