import { Avatar, IconButton, Skeleton, Tooltip } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FileContainer,
  FileRow,
  NameLink,
  RowActions,
  RowIcon,
  RowMain,
  RowMainStatic,
  RowMeta,
  VideoCardTitle,
} from "./FileList-styles.tsx";
import { blockUser, setEditFile, Video } from "../../state/features/fileSlice.ts";
import { setNotification } from "../../state/features/notificationsSlice.ts";
import { formatBytes } from "../../utils/formatBytes.ts";
import { formatDate } from "../../utils/time.ts";
import { RootState } from "../../state/store.ts";
import { getIconsFromObject } from "../../constants/Categories/CategoryFunctions.ts";
import { avatarUrl, profilePath, shareLink, sharePath } from "../../utils/qortalLinks.ts";
import { usePhoneLayout } from "../../hooks/usePhoneLayout.ts";
import { SaveToCollectionButton } from "../../components/common/SaveToCollection/SaveToCollectionButton";
import { shareTitleFromIdentifier } from "../../hooks/useFetchFiles.tsx";
import { copyText } from "../../utils/clipboard.ts";
import { isHubDecline } from "../../utils/hubErrors.ts";

interface FileListProps {
  files: Video[];
  /** Hide the publisher (on a profile page every row has the same one). */
  showPublisher?: boolean;
}

export const FileList = ({ files, showPublisher = true }: FileListProps) => {
  const hashMapFiles = useSelector((state: RootState) => state.file.hashMapFiles);
  const unavailableFiles = useSelector((state: RootState) => state.file.unavailableFiles);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const actionSize = phone ? "medium" : "small";
  const actionSx = phone ? { minWidth: 44, minHeight: 44 } : undefined;

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
  const copyLink = async (file: Video) => {
    const copied = await copyText(shareLink(file.user, file.id));
    dispatch(
      setNotification(
        copied ? { msg: "Link copied", alertType: "success" } : { msg: "Could not copy the link", alertType: "error" }
      )
    );
  };

  return (
    <FileContainer>
      {files.map((file) => {
        const existingFile = hashMapFiles[file?.id];
        // A body fetched without a search (e.g. from a collection page) has no created stamp.
        const fileObj: any = existingFile ? { ...existingFile, created: existingFile.created ?? file.created } : file;
        // Until the body lands the row shows the search's metadata. A body that never
        // comes still gets a readable row, which opens the share page (it has Retry).
        const loaded = Boolean(existingFile);
        const unavailable = !loaded && Boolean(unavailableFiles[file?.id]);
        const title: string = fileObj.title || (loaded || unavailable ? shareTitleFromIdentifier(fileObj.id) : "");
        const icon = getIconsFromObject(fileObj);
        if (existingFile?.isValid === false) {
          // Home and profiles leave deleted shares out; a collection can still list one.
          return (
            <FileRow key={fileObj.id}>
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
        return (
          <FileRow key={fileObj.id} aria-busy={!loaded && !unavailable ? true : undefined}>
            <RowMain
              className="row-main"
              onClick={() => navigate(sharePath(fileObj.user, fileObj.id))}
              aria-label={`Open ${title || "share"}`}
            >
              {icon ? <RowIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon />}
              <div style={{ minWidth: 0, flex: 1 }}>
                {title ? (
                  <VideoCardTitle>{title}</VideoCardTitle>
                ) : (
                  <Skeleton variant="text" sx={{ fontSize: 15, width: "60%" }} />
                )}
                <RowMeta>
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
                </RowMeta>
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
          </FileRow>
        );
      })}
    </FileContainer>
  );
};
