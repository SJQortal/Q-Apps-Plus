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
import { MultiplePublish } from "../common/MultiplePublish/MultiplePublishAll";
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

  const close = () => {
    dispatch(setEditFile(null));
  };

  const publish = async () => {
    const categories = categoryListRef.current;
    const selected = categories?.getSelectedCategories() ?? [];
    const problems = draft.validate(Boolean(selected[0]));
    if (problems.length > 0 || !categories) return;

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
      setPublishes(toMultiplePublish(resources));
    } catch (error) {
      dispatch(setNotification({ msg: publishErrorMessage(error, "Failed to publish update"), alertType: "error" }));
    }
  };

  const onPublished = () => {
    dispatch(markSharesChanged());
    invalidateQdnSearches();
    setPublishes(null);
    if (pendingUpdate) {
      const updated = structuredClone(pendingUpdate);
      dispatch(updateFile(updated));
      dispatch(updateInHashMap(updated));
    }
    dispatch(setNotification({ msg: "Share updated", alertType: "success" }));
    close();
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
            <Button variant="contained" onClick={publish}>
              Publish update
            </Button>
          </>
        }
      >
        <ShareForm draft={draft} categoryListRef={categoryListRef} initialCategories={editCategories} />
      </ResponsiveDialog>

      {publishes && (
        <MultiplePublish
          isOpen
          publishes={publishes}
          onError={(message) => {
            setPublishes(null);
            if (message) dispatch(setNotification({ msg: message, alertType: "error" }));
          }}
          onSubmit={onPublished}
        />
      )}
    </>
  );
}
