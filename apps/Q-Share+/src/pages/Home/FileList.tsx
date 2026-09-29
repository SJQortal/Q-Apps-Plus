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

interface FileListProps {
  files: Video[];
  /** Hide the publisher (on a profile page every row has the same one). */
  showPublisher?: boolean;
}

export const FileList = ({ files, showPublisher = true }: FileListProps) => {
  const hashMapFiles = useSelector((state: RootState) => state.file.hashMapFiles);
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
      dispatch(setNotification({ msg: `Could not block ${user}`, alertType: "error" }));
    }
  };

  const copyLink = async (file: Video) => {
    try {
      await navigator.clipboard.writeText(shareLink(file.user, file.id));
      dispatch(setNotification({ msg: "Link copied", alertType: "success" }));
    } catch {
      dispatch(setNotification({ msg: "Could not copy the link", alertType: "error" }));
    }
  };

  return (
    <FileContainer>
      {files.map((file) => {
        const existingFile = hashMapFiles[file?.id];
        const fileObj: any = existingFile ?? file;
        const hasHash = Boolean(existingFile);
        const icon = getIconsFromObject(fileObj);
        const totalSize = fileObj?.files?.reduce((acc: number, cur: any) => acc + (cur?.size || 0), 0) ?? 0;
        const fileCount = fileObj?.files?.length ?? 0;
        return (
          <FileRow key={fileObj.id}>
            {hasHash ? (
              <>
                <RowMain
                  onClick={() => navigate(sharePath(fileObj.user, fileObj.id))}
                  aria-label={`Open ${fileObj.title}`}
                >
                  {icon ? <RowIcon src={icon} alt="" loading="lazy" /> : <AttachFileIcon />}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <VideoCardTitle>{fileObj.title}</VideoCardTitle>
                    <RowMeta>
                      <span>
                        {fileCount} {fileCount === 1 ? "file" : "files"} · {formatBytes(totalSize)}
                      </span>
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
                    <IconButton size="small" aria-label="Copy link" onClick={() => copyLink(fileObj)}>
                      <LinkOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {fileObj?.user === username ? (
                    <Tooltip title="Edit share">
                      <IconButton size="small" aria-label="Edit share" onClick={() => dispatch(setEditFile(fileObj))}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    username && (
                      <Tooltip title={`Block ${fileObj.user}`}>
                        <IconButton
                          size="small"
                          aria-label={`Block ${fileObj.user}`}
                          onClick={() => blockUserFunc(fileObj.user)}
                          sx={{ color: "error.main" }}
                        >
                          <BlockOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )
                  )}
                </RowActions>
              </>
            ) : (
              <Skeleton variant="rounded" sx={{ width: "100%", height: 44 }} />
            )}
          </FileRow>
        );
      })}
    </FileContainer>
  );
};
