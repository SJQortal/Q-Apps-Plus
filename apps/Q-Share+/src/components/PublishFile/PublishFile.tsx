import { useCallback, useEffect, useRef, useState } from "react";
import { Button, IconButton, Tooltip } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useDispatch, useSelector } from "react-redux";
import { OPEN_PUBLISH_EVENT } from "../../constants/events";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { markSharesChanged } from "../../state/features/fileSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import type { RootState } from "../../state/store";
import { buildSharePublish, toMultiplePublish, type MultiplePublishRequest } from "../../utils/publishPayload";
import { invalidateQdnSearches } from "../../utils/qdnSearch";
import type { CategoryListRef } from "../common/CategoryList/CategoryList";
import { ResponsiveDialog } from "../common/mobile/ResponsiveDialog";
import { MultiplePublish } from "../common/MultiplePublish/MultiplePublishAll";
import { publishErrorMessage, toPublishInputs } from "./shareDraft";
import { ShareForm } from "./ShareForm";
import { useShareDraft } from "./useShareDraft";

/**
 * The "Share files" trigger and its dialog. The draft (files, title,
 * description, categories) lives here, so closing the dialog with Escape or
 * Back keeps it until the files are published. The shell can open the dialog
 * by dispatching OPEN_PUBLISH_EVENT on window.
 */
export const PublishFile = () => {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const userAddress = useSelector((state: RootState) => state.auth?.user?.address);

  const [isOpen, setIsOpen] = useState(false);
  const draft = useShareDraft();
  const categoryListRef = useRef<CategoryListRef>(null);
  // CategoryList keeps its own selection, so it is stashed here while the
  // dialog is closed and handed back as initialCategories on reopen.
  const [savedCategories, setSavedCategories] = useState<string[] | undefined>(undefined);
  const [publishes, setPublishes] = useState<MultiplePublishRequest | null>(null);

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

    try {
      const { resources } = await buildSharePublish({
        name: username,
        title: draft.title,
        descriptionHtml: draft.description,
        categoryFetchString: categories.getCategoriesFetchString(),
        categoriesObject: categories.categoriesToObject(),
        files: toPublishInputs(draft.files),
      });
      setPublishes(toMultiplePublish(resources));
    } catch (error) {
      dispatch(setNotification({ msg: publishErrorMessage(error, "Failed to publish share"), alertType: "error" }));
    }
  };

  const onPublished = () => {
    dispatch(markSharesChanged());
    invalidateQdnSearches();
    setPublishes(null);
    setIsOpen(false);
    draft.reset();
    setSavedCategories(undefined);
    categoryListRef.current?.clearCategories();
    dispatch(setNotification({ msg: "Files published", alertType: "success" }));
  };

  if (!username) return null;

  return (
    <>
      {phone ? (
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
            <Button variant="contained" onClick={publish}>
              Publish
            </Button>
          </>
        }
      >
        <ShareForm draft={draft} categoryListRef={categoryListRef} initialCategories={savedCategories} />
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
};

export default PublishFile;
