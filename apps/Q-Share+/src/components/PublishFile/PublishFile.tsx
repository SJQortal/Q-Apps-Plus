import { useCallback, useEffect, useRef, useState } from "react";
import { Button, IconButton, Tooltip } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useDispatch, useSelector } from "react-redux";
import { OPEN_PUBLISH_EVENT } from "../../constants/events";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { markSharesChanged } from "../../state/features/fileSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import type { RootState } from "../../state/store";
import {
  buildSharePublish,
  toMultiplePublish,
  type FileRef,
  type MultiplePublishRequest,
  type ShareThumbnail,
} from "../../utils/publishPayload";
import { invalidateQdnSearches } from "../../utils/qdnSearch";
import type { CategoryListRef } from "../common/CategoryList/CategoryList";
import { ResponsiveDialog } from "../common/mobile/ResponsiveDialog";
import {
  filesNotOnQdnText,
  MultiplePublish,
  PublishAgainDialog,
  type PublishStopped,
} from "../common/MultiplePublish/MultiplePublishAll";
import { keptFilesText, landedRefs, newFileRefs, publishErrorMessage, toPublishInputs } from "./shareDraft";
import { ShareForm } from "./ShareForm";
import { useShareDraft } from "./useShareDraft";
import { useShareThumbnail } from "./useShareThumbnail";

/**
 * The "Share files" trigger and its dialog. The draft (files, title,
 * description, categories) lives here, so closing the dialog with Escape or
 * Back keeps it until the files are published. The shell can open the dialog
 * by dispatching OPEN_PUBLISH_EVENT on window.
 */
interface PublishFileProps {
  /** Render only the dialog (the phone shell has its own floating Share button). */
  hideTrigger?: boolean;
}

export const PublishFile = ({ hideTrigger = false }: PublishFileProps) => {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector((state: RootState) => state.auth?.user?.address);

  const [isOpen, setIsOpen] = useState(false);
  const draft = useShareDraft();
  // A new share's thumbnail is made from its first image or video unless the user picks or removes it.
  const thumbnail = useShareThumbnail(draft.files, { kind: "auto" });
  const categoryListRef = useRef<CategoryListRef>(null);
  // CategoryList keeps its own selection, so it is stashed here while the
  // dialog is closed and handed back as initialCategories on reopen.
  const [savedCategories, setSavedCategories] = useState<string[] | undefined>(undefined);
  const [publishes, setPublishes] = useState<MultiplePublishRequest | null>(null);
  // Where each new draft file goes on QDN in the publish under way, by draft key.
  const [fileRefs, setFileRefs] = useState<Record<string, FileRef>>({});
  // The new thumbnail that publish sends, if any.
  const [newThumbnail, setNewThumbnail] = useState<ShareThumbnail | null>(null);
  // The last publish was left unconfirmed and Hub may still finish it, so
  // the next Publish asks first: it would make a second share.
  const [mayStillPublish, setMayStillPublish] = useState(false);
  const [confirmAgain, setConfirmAgain] = useState(false);
  // Making the thumbnail can take a few seconds: a second tap meanwhile must
  // not build a second publish (its identifiers would replace the first's).
  const preparing = useRef(false);
  const [isPreparing, setIsPreparing] = useState(false);

  useEffect(() => {
    if (!username) return;
    const openDialog = () => setIsOpen(true);
    window.addEventListener(OPEN_PUBLISH_EVENT, openDialog);
    return () => window.removeEventListener(OPEN_PUBLISH_EVENT, openDialog);
  }, [username]);

  const close = useCallback(() => {
    const selected = categoryListRef.current?.getSelectedCategories();
    if (selected) setSavedCategories(selected);
    setIsOpen(false);
  }, []);

  const publish = async (confirmed = false) => {
    if (preparing.current) return;
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

    preparing.current = true;
    setIsPreparing(true);
    try {
      const thumb = await thumbnail.resolve();
      const { resources, fileReferences, fileObject } = await buildSharePublish({
        name: username,
        title: draft.title,
        descriptionHtml: draft.description,
        categoryFetchString: categories.getCategoriesFetchString(),
        categoriesObject: categories.categoriesToObject(),
        files: toPublishInputs(draft.files),
        thumbnail: thumb,
      });
      setMayStillPublish(false);
      setFileRefs(newFileRefs(draft.files, fileReferences));
      setNewThumbnail(thumb && "file" in thumb ? (fileObject.thumbnail ?? null) : null);
      setPublishes(toMultiplePublish(resources));
    } catch (error) {
      dispatch(setNotification({ msg: publishErrorMessage(error, "Failed to publish share"), alertType: "error" }));
    } finally {
      preparing.current = false;
      setIsPreparing(false);
    }
  };

  const onPublished = (msg = "Files published", alertType: "success" | "info" = "success") => {
    dispatch(markSharesChanged());
    invalidateQdnSearches();
    setPublishes(null);
    setMayStillPublish(false);
    setIsOpen(false);
    draft.reset();
    thumbnail.set({ kind: "auto" });
    setSavedCategories(undefined);
    categoryListRef.current?.clearCategories();
    dispatch(setNotification({ msg, alertType }));
  };

  const onPublishStopped = (message?: string, published: string[] = [], stopped?: PublishStopped) => {
    const resources = publishes?.resources ?? [];
    const detailsId = resources.find((r) => r.service === "DOCUMENT")?.identifier;
    if (detailsId && published.includes(detailsId)) {
      // The share itself is on QDN and only some files are not. Publishing
      // the draft again would make a second share, so finish here.
      const missing = resources.filter((r) => r.service === "FILE" && !published.includes(r.identifier)).length;
      if (missing > 0) onPublished(`Share published, but ${filesNotOnQdnText(missing)}`, "info");
      else onPublished();
      return;
    }
    setPublishes(null);
    // Files that landed stay in the draft as references: the next publish
    // lists them without sending them (and paying for them) again.
    const landed = landedRefs(fileRefs, published);
    const landedCount = Object.keys(landed).length;
    if (landedCount > 0) draft.keepPublished(landed);
    // So does a thumbnail that landed.
    if (newThumbnail && published.includes(newThumbnail.identifier)) thumbnail.set({ kind: "existing", ref: newThumbnail });
    const notes = [
      landedCount > 0 ? keptFilesText(landedCount, Object.keys(fileRefs).length) : "",
      stopped?.uncertain ? "Your share may still be publishing in Hub. Check My shares before you publish it again." : "",
    ].filter(Boolean);
    if (stopped?.uncertain) setMayStillPublish(true);
    if (notes.length > 0) dispatch(setNotification({ msg: notes.join(" "), alertType: "info" }));
    if (message) dispatch(setNotification({ msg: message, alertType: "error" }));
  };

  if (!username) return null;

  return (
    <>
      {hideTrigger ? null : phone ? (
        <Tooltip title="Share files">
          <IconButton
            aria-label="Share files"
            color="primary"
            onClick={() => setIsOpen(true)}
            sx={{ minWidth: 44, minHeight: 44 }}
          >
            <UploadFileOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          color="primary"
          aria-label="Share files"
          startIcon={<UploadFileOutlinedIcon />}
          onClick={() => setIsOpen(true)}
          sx={{ minHeight: 40, whiteSpace: "nowrap" }}
        >
          Share
        </Button>
      )}

      <ResponsiveDialog
        open={isOpen}
        onClose={close}
        title="Share files"
        maxWidth="md"
        actions={
          <>
            <Button onClick={close} color="inherit">
              Cancel
            </Button>
            <Button variant="contained" onClick={() => publish()} disabled={isPreparing}>
              Publish
            </Button>
          </>
        }
      >
        <ShareForm
          draft={draft}
          categoryListRef={categoryListRef}
          initialCategories={savedCategories}
          thumbnail={thumbnail}
        />
      </ResponsiveDialog>

      <PublishAgainDialog
        open={confirmAgain}
        text="Your last publish may still be finishing in Hub. Check My shares first: if the share is there, publishing again makes a second copy and costs another fee."
        onCancel={() => setConfirmAgain(false)}
        onConfirm={() => publish(true)}
      />

      {publishes && (
        <MultiplePublish
          isOpen
          publishes={publishes}
          onError={onPublishStopped}
          onSubmit={() => onPublished()}
        />
      )}
    </>
  );
};

export default PublishFile;
