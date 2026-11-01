import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Button, Typography } from "@mui/material";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { MultiplePublish } from "../../components/common/MultiplePublish/MultiplePublishAll";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import { addToHashMap, markSharesChanged } from "../../state/features/fileSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { buildShareRemoval, shareThumbnail, toMultiplePublish, type MultiplePublishRequest } from "../../utils/publishPayload";
import { formatQort, publishUnitFee } from "../../utils/publishBatches";
import { invalidateQdnSearches } from "../../utils/qdnSearch";

/**
 * "Remove from QDN" for the share's publisher: says what it replaces and what
 * it costs, then republishes the files, the thumbnail and the details as
 * delete markers through the publish dialog (batches, Pause, Continue). A
 * stop keeps what was replaced, so finishing it never pays twice.
 */
export function RemoveShareButton({ share, compact }: { share: any; compact?: boolean }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [publishes, setPublishes] = useState<MultiplePublishRequest | null>(null);
  const [unitFee, setUnitFee] = useState<number | null>(null);
  // Replaced by an earlier try: not sent again.
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set());
  const title: string = share.title || "this share";
  const owner: string = share.user;

  useEffect(() => {
    if (!confirming) return;
    let active = true;
    void publishUnitFee().then((fee) => {
      if (active) setUnitFee(fee);
    });
    return () => {
      active = false;
    };
  }, [confirming]);

  const planned = useMemo(
    () =>
      buildShareRemoval({
        name: owner,
        identifier: share.id,
        files: Array.isArray(share.files) ? share.files : [],
        thumbnail: shareThumbnail(share),
        done,
      }),
    [owner, share, done]
  );
  const fileCount = planned.filter((r) => r.service === "FILE").length;

  const removed = (note?: string) => {
    setPublishes(null);
    // Gone from lists and this page at once, as a delete marker read from QDN would be.
    dispatch(addToHashMap({ ...share, isValid: false, deleted: true }));
    dispatch(markSharesChanged());
    invalidateQdnSearches();
    dispatch(setNotification(note ? { msg: note, alertType: "info" } : { msg: "Removed from QDN", alertType: "success" }));
    navigate("/");
  };

  const stopped = (message?: string, published: string[] = []) => {
    const resources = publishes?.resources ?? [];
    const details = resources.find((r) => r.service === "DOCUMENT");
    if (details && published.includes(details.identifier)) {
      const left = resources.filter((r) => r.service === "FILE" && !published.includes(r.identifier)).length;
      removed(left > 0 ? `The share is gone, but ${left === 1 ? "1 file is" : `${left} files are`} still on QDN.` : undefined);
      return;
    }
    setPublishes(null);
    setDone((before) => new Set([...before, ...published]));
    if (published.length > 0) {
      dispatch(
        setNotification({
          msg: `${published.length} of ${resources.length} removed. Remove from QDN again to finish: what's done isn't paid for twice.`,
          alertType: "info",
        })
      );
    }
    if (message) dispatch(setNotification({ msg: message, alertType: "error" }));
  };

  return (
    <>
      <Button
        variant="outlined"
        color="error"
        startIcon={<DeleteOutlineOutlinedIcon />}
        aria-label="Remove from QDN"
        onClick={() => setConfirming(true)}
      >
        {compact ? "Remove" : "Remove from QDN"}
      </Button>

      <ResponsiveDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Remove from QDN?"
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirming(false);
                setPublishes(toMultiplePublish(planned));
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <Typography>
          “{title}”{fileCount > 0 ? ` and ${fileCount === 1 ? "its file" : `its ${fileCount} files`}` : ""} will be replaced on
          QDN with an empty marker. Nodes then drop the data, and the share leaves Q-Share. This can't be undone.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {planned.length === 1 ? "1 publish" : `${planned.length} publishes`}
          {unitFee !== null ? `, ${formatQort(unitFee * planned.length)} in fees` : ""}. Copies other people already saved
          stay theirs, and the record of the publish stays on the chain.
        </Typography>
      </ResponsiveDialog>

      {publishes && <MultiplePublish isOpen publishes={publishes} onSubmit={() => removed()} onError={stopped} />}
    </>
  );
}
