import { useMemo, useRef, useState } from "react";
import { Button } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { markSharesChanged, setEditFile, updateFile, updateInHashMap } from "../../state/features/fileSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import type { RootState } from "../../state/store";
import {
  buildSharePublish,
  toMultiplePublish,
  type FileRef,
  type MultiplePublishRequest,
} from "../../utils/publishPayload";
import { invalidateQdnSearches } from "../../utils/qdnSearch";
import { getCategoriesFromObject, type CategoryListRef } from "../common/CategoryList/CategoryList";
import { ResponsiveDialog } from "../common/mobile/ResponsiveDialog";
import {
  filesNotOnQdnText,
  MultiplePublish,
  PublishAgainDialog,
  type PublishStopped,
  type ReplacedVersions,
} from "../common/MultiplePublish/MultiplePublishAll";
import { draftFromRef, publishErrorMessage, toPublishInputs } from "../PublishFile/shareDraft";
import { ShareForm } from "../PublishFile/ShareForm";
import { useShareDraft } from "../PublishFile/useShareDraft";

/**
 * The "Update share" dialog. It opens when `file.editFileProperties` is set
 * (the row's Edit action). The dialog is keyed by the share's id, so each
 * share starts from its own stored values.
 */
export const EditFile = () => {
  const editFileProperties = useSelector((state: RootState) => state.file.editFileProperties);
  if (!editFileProperties) return null;
  return <EditShareDialog key={editFileProperties.id} share={editFileProperties} />;
};

export default EditFile;

interface EditShareDialogProps {
  /** The share as loaded into `hashMapFiles`: the stored JSON plus id, user, etc. */
  share: any;
}

function EditShareDialog({ share }: EditShareDialogProps) {
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector((state: RootState) => state.auth?.user?.address);

  const draft = useShareDraft({
    files: (Array.isArray(share.files) ? (share.files as FileRef[]) : []).map(draftFromRef),
    title: share.title || "",
    description: share.htmlDescription || (share.fullDescription ? `<p>${share.fullDescription}</p>` : ""),
  });
  const editCategories = useMemo(() => getCategoriesFromObject(share), [share]);
  const categoryListRef = useRef<CategoryListRef>(null);
  const [publishes, setPublishes] = useState<MultiplePublishRequest | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, unknown> | null>(null);
  // An update reuses the details identifier, so after a timeout QDN must
  // show a version newer than the one being replaced before it counts.
  const replaces = useMemo<ReplacedVersions>(
    () => ({ [share.id]: share.updated ?? share.created }),
    [share]
  );
  // The last update was left unconfirmed and Hub may still finish it, so the
  // next one asks first: it costs another fee.
  const [mayStillPublish, setMayStillPublish] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);

  const close = () => {
    dispatch(setEditFile(null));
  };

  const publish = async (confirmed = false) => {
    const categories = categoryListRef.current;
    const selected = categories?.getSelectedCategories() ?? [];
    const problems = draft.validate(Boolean(selected[0]));
    if (problems.length > 0 || !categories) return;
    if (mayStillPublish && !confirmed) {
      setConfirmAgain(true);
      return;
    }
    setConfirmAgain(false);

    if (!userAddress) {
      dispatch(setNotification({ msg: "Unable to locate user address", alertType: "error" }));
      return;
    }
    if (!username) {
      dispatch(
        setNotification({ msg: "Cannot publish without access to your name. Please authenticate.", alertType: "error" })
      );
      return;
    }
    if (share.user !== username) {
      dispatch(setNotification({ msg: "Cannot publish another user's resource", alertType: "error" }));
      return;
    }

    try {
      const { resources, fileObject } = await buildSharePublish({
        name: username,
        title: draft.title,
        descriptionHtml: draft.description,
        categoryFetchString: categories.getCategoriesFetchString(),
        categoriesObject: categories.categoriesToObject(),
        files: toPublishInputs(draft.files),
        edit: { identifier: share.id, version: share.version, commentsId: share.commentsId },
      });
      setPendingUpdate({ ...share, ...fileObject });
      setMayStillPublish(false);
      setPublishes(toMultiplePublish(resources));
    } catch (error) {
      dispatch(setNotification({ msg: publishErrorMessage(error, "Failed to publish update"), alertType: "error" }));
    }
  };

  const onPublished = (msg = "Share updated", alertType: "success" | "info" = "success") => {
    dispatch(markSharesChanged());
    invalidateQdnSearches();
    setPublishes(null);
    if (pendingUpdate) {
      // The new version's time, so that another update from here is checked
      // against this one rather than the version it replaced.
      const updated = { ...structuredClone(pendingUpdate), updated: Date.now() };
      dispatch(updateFile(updated));
      dispatch(updateInHashMap(updated));
    }
    dispatch(setNotification({ msg, alertType }));
    close();
  };

  const onPublishStopped = (message?: string, published: string[] = [], stopped?: PublishStopped) => {
    const resources = publishes?.resources ?? [];
    const detailsId = resources.find((r) => r.service === "DOCUMENT")?.identifier;
    if (detailsId && published.includes(detailsId)) {
      // The share's details are updated on QDN; only some new files are not.
      const missing = resources.filter((r) => r.service === "FILE" && !published.includes(r.identifier)).length;
      if (missing > 0) onPublished(`Share updated, but ${filesNotOnQdnText(missing, "new file")}`, "info");
      else onPublished();
      return;
    }
    setPublishes(null);
    if (stopped?.uncertain) {
      setMayStillPublish(true);
      dispatch(
        setNotification({
          msg: "Your update may still be publishing in Hub. Check the share before you publish it again.",
          alertType: "info",
        })
      );
    }
    if (message) dispatch(setNotification({ msg: message, alertType: "error" }));
  };

  return (
    <>
      <ResponsiveDialog
        open
        onClose={close}
        title="Update share"
        maxWidth="md"
        actions={
          <>
            <Button onClick={close} color="inherit">
              Cancel
            </Button>
            <Button variant="contained" onClick={() => publish()}>
              Publish update
            </Button>
          </>
        }
      >
        <ShareForm draft={draft} categoryListRef={categoryListRef} initialCategories={editCategories} />
      </ResponsiveDialog>

      <PublishAgainDialog
        open={confirmAgain}
        text="Your last update may still be finishing in Hub. Check the share first: publishing again costs another fee."
        onCancel={() => setConfirmAgain(false)}
        onConfirm={() => publish(true)}
      />

      {publishes && (
        <MultiplePublish
          isOpen
          publishes={publishes}
          replaces={replaces}
          onError={onPublishStopped}
          onSubmit={() => onPublished()}
        />
      )}
    </>
  );
}
