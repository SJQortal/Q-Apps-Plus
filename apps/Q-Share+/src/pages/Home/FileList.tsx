import { memo, useState } from "react";
import { Avatar, IconButton, Skeleton, Tooltip } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import RemoveCircleOutlinedIcon from "@mui/icons-material/RemoveCircleOutlined";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  CardArt,
  CardBody,
  CardCorner,
  CardFooter,
  CardIcon,
  CardMain,
  CardMainStatic,
  CardMeta,
  CardPublisher,
  CardTitle,
  FileCard,
  FileContainer,
  FileGrid,
  FileRow,
  NameLink,
  RowActions,
  RowIcon,
  RowMain,
  RowMainStatic,
  RowMeta,
  VideoCardTitle,
} from "./FileList-styles.tsx";
import { blockUser, heldShare, setEditFile, shareKey, Video } from "../../state/features/fileSlice.ts";
import { setNotification } from "../../state/features/notificationsSlice.ts";
import { formatBytes } from "../../utils/formatBytes.ts";
import { formatDate } from "../../utils/time.ts";
import { RootState } from "../../state/store.ts";
import { getIconsFromObject } from "../../constants/Categories/CategoryFunctions.ts";
import { avatarUrl, profilePath, shareLink, sharePath } from "../../utils/qortalLinks.ts";
import { LANDSCAPE_PHONE_MEDIA, usePhoneLayout } from "../../hooks/usePhoneLayout.ts";
import { SaveToCollectionButton } from "../../components/common/SaveToCollection/SaveToCollectionButton";
import { shareTitleFromIdentifier } from "../../hooks/useFetchFiles.tsx";
import { copyText } from "../../utils/clipboard.ts";
import { ManualCopyDialog } from "../../components/common/CopyLinkButton.tsx";
import { isHubDecline } from "../../utils/hubErrors.ts";
import { useListView } from "../../components/common/ListViewToggle.tsx";

interface FileListProps {
  files: Video[];
  /** Hide the publisher (on a profile page every row has the same one). */
  showPublisher?: boolean;
  /**
   * Grid only: a Remove button on each card, for the owner of a collection
   * (the list layout keeps its own button beside each row). Pass a stable
   * function, such as a state setter, so the cards stay memoized.
   */
  onRemove?: (file: Video) => void;
}

/**
 * Placeholder cards while a grid's first page loads, in the grid's own
 * columns and about as tall as the cards (lower on a phone in landscape,
 * where the card art is).
 */
export function FileGridSkeleton({ count, label }: { count: number; label?: string }) {
  return (
    <FileGrid aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <Skeleton
            variant="rounded"
            sx={{ width: "100%", height: { xs: 232, sm: 208 }, [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { height: 192 } }}
          />
        </li>
      ))}
    </FileGrid>
  );
}

/**
 * One list per page, one memoized row per share: each row selects its own
 * body, so a body landing re-renders that row and not the whole list. The
 * layout setting (useListView) turns the rows into a grid of cards with the
 * same states and actions.
 */
export const FileList = ({ files, showPublisher = true, onRemove }: FileListProps) => {
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const phone = usePhoneLayout();
  const grid = useListView() === "grid";
  const items = files.map((file) => (
    // Two names can publish under one identifier: each is its own row.
    <FileListRow
      key={shareKey(file.user, file.id)}
      file={file}
      showPublisher={showPublisher}
      phone={phone}
      username={username}
      grid={grid}
      onRemove={grid ? onRemove : undefined}
    />
  ));
  return grid ? <FileGrid>{items}</FileGrid> : <FileContainer>{items}</FileContainer>;
};

/** A card's Remove button, over its art, on a collection its owner opens. The page's dialog confirms. */
function CardRemoveButton({ title, phone, onClick }: { title: string; phone: boolean; onClick: () => void }) {
  return (
    <CardCorner className="row-actions">
      <Tooltip title="Remove from collection">
        <IconButton
          aria-label={`Remove ${title} from collection`}
          onClick={onClick}
          sx={{
            width: phone ? 44 : 36,
            height: phone ? 44 : 36,
            // Solid, so it reads on the tinted art in every theme.
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            "&:hover": {
              bgcolor: "background.paper",
              backgroundImage: (theme) => `linear-gradient(${theme.palette.action.hover}, ${theme.palette.action.hover})`,
            },
          }}
        >
          <RemoveCircleOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </CardCorner>
  );
}

interface FileListRowProps {
  file: Video;
  showPublisher: boolean;
  phone: boolean;
  username?: string;
  /** A card in the grid layout instead of a row. */
  grid: boolean;
  onRemove?: (file: Video) => void;
}

const FileListRow = memo(function FileListRow({ file, showPublisher, phone, username, grid, onRemove }: FileListRowProps) {
  // Only a body from this row's own name (another can reuse the identifier).
  const existingFile = useSelector((state: RootState) => heldShare(state.file, file.user, file.id));
  const isUnavailable = useSelector((state: RootState) => Boolean(state.file.unavailableFiles[shareKey(file.user, file.id)]));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const actionSize = phone ? "medium" : "small";
  const actionSx = phone ? { minWidth: 44, minHeight: 44 } : undefined;
  // Set when copying is blocked outright: the link is shown for a manual copy.
  const [manualLink, setManualLink] = useState<string | null>(null);

  const blockUserFunc = async (user: string) => {
    if (user === "Q-Share") return;
    try {
      const response = await qortalRequest({
        action: "ADD_LIST_ITEMS",
        list_name: "blockedNames",
        items: [user],
      });
      if (response === true) {
        dispatch(blockUser(user));
        dispatch(setNotification({ msg: `${user} is now blocked`, alertType: "success" }));
      }
    } catch (error) {
      // Saying no in Hub's dialog is not a failure.
      if (!isHubDecline(error)) dispatch(setNotification({ msg: `Could not block ${user}`, alertType: "error" }));
    }
  };

  // copyText falls back to execCommand where navigator.clipboard is missing (a node on plain http).
  const copyLink = async (share: Video) => {
    const link = shareLink(share.user, share.id);
    if (await copyText(link)) dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    else setManualLink(link);
  };

  // A body fetched without a search (e.g. from a collection page) has no created stamp.
  const fileObj: any = existingFile ? { ...existingFile, created: existingFile.created ?? file.created } : file;
  // Until the body lands the row shows the search's metadata. A body that never
  // comes still gets a readable row, which opens the share page (it has Retry).
  const loaded = Boolean(existingFile);
  const unavailable = !loaded && isUnavailable;
  const title: string = fileObj.title || (loaded || unavailable ? shareTitleFromIdentifier(fileObj.id) : "");
  const icon = getIconsFromObject(fileObj);
  if (existingFile?.isValid === false) {
    // Home and profiles leave deleted shares out; a collection can still list one.
    if (grid) {
      const shownTitle = /^deleted$/i.test(title) ? shareTitleFromIdentifier(fileObj.id) : title;
      return (
        <FileCard className="share-card">
          <CardMainStatic>
            <CardArt>{icon ? <CardIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon color="disabled" fontSize="large" />}</CardArt>
            <CardBody>
              <CardTitle sx={{ color: "text.secondary" }}>{shownTitle}</CardTitle>
              <CardMeta>{existingFile.deleted ? "Deleted by its publisher" : "This share can't be read"}</CardMeta>
            </CardBody>
          </CardMainStatic>
          {showPublisher && (
            <CardFooter>
              <CardPublisher onClick={() => navigate(profilePath(fileObj.user))} aria-label={`Shares by ${fileObj.user}`}>
                <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(fileObj.user)} alt="" slotProps={{ img: { loading: "lazy" } }} />
                <span>{fileObj.user}</span>
              </CardPublisher>
            </CardFooter>
          )}
          {onRemove && <CardRemoveButton title={shownTitle} phone={phone} onClick={() => onRemove(file)} />}
        </FileCard>
      );
    }
    return (
      <FileRow>
        <RowMainStatic className="row-main">
          {icon ? <RowIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon color="disabled" />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <VideoCardTitle sx={{ color: "text.secondary" }}>
              {/* Some deletes also retitle the share "deleted". */}
              {/^deleted$/i.test(title) ? shareTitleFromIdentifier(fileObj.id) : title}
            </VideoCardTitle>
            <RowMeta>
              <span>{existingFile.deleted ? "Deleted by its publisher" : "This share can't be read"}</span>
            </RowMeta>
          </div>
        </RowMainStatic>
        {showPublisher && (
          <NameLink onClick={() => navigate(profilePath(fileObj.user))} aria-label={`Shares by ${fileObj.user}`}>
            <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(fileObj.user)} alt="" slotProps={{ img: { loading: "lazy" } }} />
            <span>{fileObj.user}</span>
          </NameLink>
        )}
      </FileRow>
    );
  }
  const totalSize = fileObj?.files?.reduce((acc: number, cur: any) => acc + (cur?.size || 0), 0) ?? 0;
  const fileCount = fileObj?.files?.length ?? 0;
  const pending = !loaded && !unavailable ? true : undefined;
  const openLabel = `Open ${title || shareTitleFromIdentifier(fileObj.id)}`;
  const meta = (
    <>
      {loaded ? (
        <span>
          {fileCount} {fileCount === 1 ? "file" : "files"} · {formatBytes(totalSize)}
        </span>
      ) : unavailable ? (
        <span>Not available on your node right now</span>
      ) : (
        <Skeleton variant="text" sx={{ width: 96 }} />
      )}
      {fileObj?.created && <span>· {formatDate(fileObj.created)}</span>}
    </>
  );
  const actions = (
    <RowActions className="row-actions">
      <Tooltip title="Copy link">
        <IconButton size={actionSize} sx={actionSx} aria-label="Copy link" onClick={() => copyLink(fileObj)}>
          <LinkOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <SaveToCollectionButton
        share={{ name: fileObj.user, identifier: fileObj.id, title }}
        size={actionSize}
      />
      {fileObj?.user === username ? (
        // Editing needs the share's JSON body.
        loaded && (
          <Tooltip title="Edit share">
            <IconButton size={actionSize} sx={actionSx} aria-label="Edit share" onClick={() => dispatch(setEditFile(fileObj))}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      ) : (
        username && (
          <Tooltip title={`Block ${fileObj.user}`}>
            <IconButton
              size={actionSize}
              aria-label={`Block ${fileObj.user}`}
              onClick={() => blockUserFunc(fileObj.user)}
              sx={{ color: "error.main", ...actionSx }}
            >
              <BlockOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )
      )}
    </RowActions>
  );
  if (grid) {
    return (
      <FileCard className="share-card" aria-busy={pending}>
        <CardMain className="row-main" onClick={() => navigate(sharePath(fileObj.user, fileObj.id))} aria-label={openLabel}>
          <CardArt>{icon ? <CardIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon fontSize="large" />}</CardArt>
          <CardBody>
            {title ? <CardTitle>{title}</CardTitle> : <Skeleton variant="text" sx={{ fontSize: 15, width: "80%" }} />}
            <CardMeta>{meta}</CardMeta>
          </CardBody>
        </CardMain>
        <CardFooter>
          {showPublisher && (
            <CardPublisher onClick={() => navigate(profilePath(fileObj.user))} aria-label={`Shares by ${fileObj.user}`}>
              <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(fileObj.user)} alt="" slotProps={{ img: { loading: "lazy" } }} />
              <span>{fileObj.user}</span>
            </CardPublisher>
          )}
          {actions}
        </CardFooter>
        {onRemove && (
          <CardRemoveButton title={title || shareTitleFromIdentifier(fileObj.id)} phone={phone} onClick={() => onRemove(file)} />
        )}
        {manualLink && <ManualCopyDialog open onClose={() => setManualLink(null)} link={manualLink} />}
      </FileCard>
    );
  }
  return (
    <FileRow aria-busy={pending}>
      <RowMain
        className="row-main"
        onClick={() => navigate(sharePath(fileObj.user, fileObj.id))}
        aria-label={openLabel}
      >
        {icon ? <RowIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon />}
        <div style={{ minWidth: 0, flex: 1 }}>
          {title ? (
            <VideoCardTitle>{title}</VideoCardTitle>
          ) : (
            <Skeleton variant="text" sx={{ fontSize: 15, width: "60%" }} />
          )}
          <RowMeta>{meta}</RowMeta>
        </div>
      </RowMain>
      {showPublisher && (
        <NameLink
          onClick={() => navigate(profilePath(fileObj.user))}
          aria-label={`Shares by ${fileObj.user}`}
        >
          <Avatar
            sx={{ width: 22, height: 22 }}
            src={avatarUrl(fileObj.user)}
            alt=""
            slotProps={{ img: { loading: "lazy" } }}
          />
          <span>{fileObj.user}</span>
        </NameLink>
      )}
      {actions}
      {manualLink && <ManualCopyDialog open onClose={() => setManualLink(null)} link={manualLink} />}
    </FileRow>
  );
});
