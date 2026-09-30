import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Box, Button, IconButton, LinearProgress, Skeleton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { CopyLinkButton } from "../../components/common/CopyLinkButton.tsx";
import { SaveAllZipButton } from "../../components/common/SaveAllZipButton";
import { SaveToCollectionButton } from "../../components/common/SaveToCollection/SaveToCollectionButton";
import { FollowButton } from "../../components/common/FollowButton.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";
import { CommentSection } from "../../components/common/Comments/CommentSection";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { MyContext, isFailedStatus } from "../../wrappers/DownloadWrapper";
import { RootState } from "../../state/store";
import { addToHashMap, setEditFile } from "../../state/features/fileSlice.ts";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useSafeBack } from "../../hooks/useSafeBack";
import { searchQdn, type QdnResourceSummary } from "../../utils/qdnSearch";
import { avatarUrl, profilePath, shareLink, decodeParam } from "../../utils/qortalLinks";
import { formatDate } from "../../utils/time";
import { allCategoryData } from "../../constants/Categories/1stCategories.ts";
import { getCategoriesFromObject, type Category } from "../../components/common/CategoryList/CategoryList.tsx";
import { getIconsFromObject } from "../../constants/Categories/CategoryFunctions.ts";
import { FileRow, type ShareFile } from "./FileRow";
import {
  ActionRow,
  AuthorLink,
  Card,
  CategoryIcon,
  CompactActionRow,
  DescriptionFade,
  FileDescription,
  FileList,
  FileTitle,
  Meta,
  Page,
  SectionTitle,
  SubHeader,
} from "./FileContent-styles.tsx";

const DESCRIPTION_COLLAPSE_PX = 300;

/**
 * - "fetching": the JSON is on the network but not on this node yet.
 * - "missing": still not here after the retries below.
 * - "deleted": the publisher replaced the body with a delete marker.
 */
type LoadState = "loading" | "fetching" | "ready" | "notfound" | "deleted" | "missing" | "error";
type FetchState = Exclude<LoadState, "ready">;

/** Waits between status checks while the JSON comes from peers (about 30 s in all). */
export const SHARE_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000];
/** The node is getting the JSON from peers, or has it: worth waiting for. */
const ON_THE_WAY = new Set(["PUBLISHED", "DOWNLOADING", "DOWNLOADED", "BUILDING", "MISSING_DATA"]);
/** Every chunk is here: FETCH again (the node builds it on the way). */
const LOCAL = new Set(["READY", "DOWNLOADED", "BUILDING"]);

/** "Category > Subcategory" from the share's stored category ids. */
export function categoryPath(fileData: any): string {
  if (!fileData) return "";
  const ids = getCategoriesFromObject(fileData);
  const names = ids.map((categoryId, index) => {
    let match: Category | undefined;
    if (index === 0) {
      match = allCategoryData.category.find((item) => item?.id === +ids[0]);
    } else {
      const subCategories = allCategoryData.subCategories[index - 1];
      const list = subCategories?.[ids[index - 1]];
      match = list?.find((item) => item?.id === +ids[index]);
    }
    return match?.name;
  });
  return names.filter(Boolean).join(" > ");
}

type ShareLookup =
  | { kind: "notfound" }
  | { kind: "deleted" }
  | { kind: "unavailable"; percent: number | null }
  | { kind: "found"; data: any };

type ResourceStatus = { status?: string; percentLoaded?: number | null };

async function readShareStatus(name: string, id: string): Promise<ResourceStatus | null> {
  try {
    return await qortalRequest({ action: "GET_QDN_RESOURCE_STATUS", name, service: "DOCUMENT", identifier: id });
  } catch {
    return null;
  }
}

/**
 * Deletes elsewhere (Torq, qapp-core) replace the JSON with a non-JSON body
 * such as "D" or "\n", which q-apps.js hands back as a string; some also
 * retitle the metadata "deleted" with the tag "deleted".
 */
function isDeletedShare(summary: QdnResourceSummary, body: unknown): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return true;
  const meta = summary?.metadata;
  const files = (body as { files?: unknown }).files;
  return meta?.title === "deleted" && !!meta.tags?.includes("deleted") && !(Array.isArray(files) && files.length > 0);
}

/**
 * One search (limit 1) for the metadata, then one FETCH_QDN_RESOURCE for the
 * JSON body. Core answers that FETCH with "Data unavailable" within
 * milliseconds when the JSON isn't on this node yet (it has asked its peers),
 * so a failed FETCH asks for the status to tell "on its way" from "gone".
 */
async function fetchShare(name: string, id: string): Promise<ShareLookup> {
  const rows = await searchQdn({ service: "DOCUMENT", identifier: id, name, limit: 1, includemetadata: true });
  if (!rows.length) return { kind: "notfound" };
  const summary = rows[0];
  let body: any;
  try {
    body = await qortalRequest({ action: "FETCH_QDN_RESOURCE", name, service: "DOCUMENT", identifier: id });
  } catch (error) {
    const status = await readShareStatus(name, id);
    if (status?.status === "NOT_PUBLISHED") return { kind: "notfound" };
    if (status?.status && ON_THE_WAY.has(status.status)) return { kind: "unavailable", percent: status.percentLoaded ?? null };
    throw error;
  }
  if (isDeletedShare(summary, body)) return { kind: "deleted" };
  if (body.error) throw new Error(typeof body.error === "string" ? body.error : "Could not read the share");
  return {
    kind: "found",
    data: {
      title: summary?.metadata?.title,
      category: summary?.metadata?.category,
      categoryName: summary?.metadata?.categoryName,
      tags: summary?.metadata?.tags || [],
      description: summary?.metadata?.description,
      created: summary?.created,
      updated: summary?.updated,
      user: summary.name,
      videoImage: "",
      id: summary.identifier,
      ...body,
    },
  };
}

export interface FileContentProps {
  /** Extra primary actions, rendered after Fetch all and Save all as .zip (full width on phones). */
  extraActions?: ReactNode;
}

/**
 * The share page, /share/:name/:id. Cold open: one search (limit 1) for the
 * metadata and one FETCH_QDN_RESOURCE for the JSON; a share already in
 * `hashMapFiles` renders with no calls at all. Keyed by the share id so every
 * share starts with fresh page state.
 */
export const FileContent = (props: FileContentProps = {}) => {
  const params = useParams();
  const name = decodeParam(params.name);
  const id = decodeParam(params.id);
  return <SharePage key={`${name}/${id}`} name={name} id={id} {...props} />;
};

interface SharePageProps extends FileContentProps {
  name: string;
  id: string;
}

const SharePage = ({ name, id, extraActions }: SharePageProps) => {
  const phone = usePhoneLayout();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const cached = useSelector((state: RootState) => state.file.hashMapFiles[id]);

  const [fetchState, setFetchState] = useState<FetchState>("loading");
  const [fetchPercent, setFetchPercent] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  // A list row whose body turned out not to be a share: marked deleted, or
  // unreadable (then this page looks for itself).
  const cachedDeleted = (cached as { deleted?: unknown } | undefined)?.deleted === true;
  const usable = cached && cached.isValid !== false && !cachedDeleted ? cached : null;
  const fileData: any = usable;
  const state: LoadState = cachedDeleted ? "deleted" : usable ? "ready" : fetchState;

  // Measured once the description is in the DOM; long ones start collapsed.
  const measureDescription = useCallback((el: HTMLDivElement | null) => {
    if (el) setCollapsible(el.scrollHeight > DESCRIPTION_COLLAPSE_PX);
  }, []);

  /**
   * Cold open. The found share goes into hashMapFiles, which is what the page
   * renders from (and what makes the next open warm). When the JSON is still
   * on its way from peers, the node's status is checked again after each of
   * SHARE_RETRY_DELAYS_MS (held while the tab is hidden) and the FETCH repeats
   * once every chunk is local. Cleanup drops late answers and timers.
   */
  useEffect(() => {
    if (!name || !id || usable || cachedDeleted) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onVisible: (() => void) | undefined;

    const whenVisible = (fn: () => void) => {
      if (document.visibilityState !== "hidden") return fn();
      const listener = () => {
        if (document.visibilityState === "hidden") return;
        document.removeEventListener("visibilitychange", listener);
        onVisible = undefined;
        if (active) fn();
      };
      onVisible = listener;
      document.addEventListener("visibilitychange", listener);
    };

    const attempt = (next: number) => {
      fetchShare(name, id).then(
        (result) => {
          if (!active) return;
          if (result.kind === "found") dispatch(addToHashMap(result.data));
          else if (result.kind === "unavailable") wait(next, result.percent);
          else setFetchState(result.kind);
        },
        () => {
          if (active) setFetchState("error");
        }
      );
    };

    const wait = (next: number, percent: number | null) => {
      if (next >= SHARE_RETRY_DELAYS_MS.length) {
        setFetchState("missing");
        return;
      }
      setFetchPercent(percent);
      setFetchState("fetching");
      timer = setTimeout(
        () =>
          whenVisible(() => {
            void readShareStatus(name, id).then((status) => {
              if (!active) return;
              if (status?.status === "NOT_PUBLISHED") setFetchState("notfound");
              else if (status?.status && LOCAL.has(status.status)) attempt(next + 1);
              else wait(next + 1, status?.percentLoaded ?? percent);
            });
          }),
        SHARE_RETRY_DELAYS_MS[next]
      );
    };

    attempt(0);
    return () => {
      active = false;
      clearTimeout(timer);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cachedDeleted, dispatch, id, name, reloadKey, usable]);

  const retry = () => {
    setFetchState("loading");
    setFetchPercent(null);
    setReloadKey((k) => k + 1);
  };

  const icon = useMemo(() => (fileData ? getIconsFromObject(fileData) : undefined), [fileData]);
  const categories = useMemo(() => categoryPath(fileData), [fileData]);
  const files: ShareFile[] = useMemo(() => (Array.isArray(fileData?.files) ? fileData.files : []), [fileData]);
  const author: string = fileData?.user || name;

  const pendingFiles = useMemo(
    () => files.filter((f) => f?.identifier && (!downloads?.[f.identifier] || isFailedStatus(downloads[f.identifier]?.status?.status))),
    [downloads, files]
  );
  const allReady = files.length > 0 && files.every((f) => downloads?.[f.identifier]?.status?.status === "READY");

  const fetchAll = () => {
    for (const file of pendingFiles) {
      const service = file.service || "FILE";
      downloadVideo({
        name: file.name,
        service,
        identifier: file.identifier,
        properties: { ...file, service, mimeType: file.mimetype, jsonId: id },
      });
    }
  };

  // window.history is shared by every Hub tab, so Back follows the app's own stack.
  const goBack = useSafeBack("/");
  const title: string = fileData?.title || "";

  // A single file has its own Download in its row, so "Fetch all" only
  // appears for two or more (the .zip button has the same rule).
  const primaryActions =
    files.length > 1 || extraActions ? (
      <>
        {files.length > 1 && (
          <Button variant="contained" startIcon={<CloudDownloadOutlinedIcon />} onClick={fetchAll} disabled={pendingFiles.length === 0}>
            {allReady ? "All files ready" : pendingFiles.length === 0 ? "Fetching…" : "Fetch all files"}
          </Button>
        )}
        <SaveAllZipButton files={files} title={title} allReady={allReady} />
        {extraActions}
      </>
    ) : null;
  // On phones these become one compact row of icon-over-label buttons.
  const secondaryActions = fileData ? (
    <>
      <CopyLinkButton link={shareLink(author, id)} tooltipTitle="Copy link" label="Copy link" />
      <SaveToCollectionButton
        share={{ name: author, identifier: id, title: fileData.title }}
        variant="button"
        size="medium"
        compact={phone}
      />
      {author === username ? (
        <Button
          variant="outlined"
          startIcon={<EditOutlinedIcon />}
          aria-label="Edit share"
          onClick={() => dispatch(setEditFile(fileData))}
        >
          {phone ? "Edit" : "Edit share"}
        </Button>
      ) : (
        <FollowButton followerName={author} compact={phone} />
      )}
    </>
  ) : null;

  return (
    <Page>
      {phone && (
        <SubHeader>
          <IconButton aria-label="Back" onClick={goBack} sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography component="h2" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, pr: 1 }}>
            {title || "Share"}
          </Typography>
        </SubHeader>
      )}

      {state === "fetching" && (
        <Card role="status" aria-live="polite" aria-label="Fetching share">
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <Box sx={{ color: "text.secondary", display: "flex", pt: 0.25 }}>
              <CloudDownloadOutlinedIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>Not on your node yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Fetching it from peers…{fetchPercent ? ` ${Math.round(fetchPercent)}%` : ""}
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant={fetchPercent ? "determinate" : "indeterminate"}
            value={fetchPercent ? Math.min(100, Math.round(fetchPercent)) : undefined}
            aria-label="Share download progress"
            sx={{ borderRadius: 1, height: 6 }}
          />
        </Card>
      )}

      {state === "loading" && (
        <>
          <Card aria-busy="true" aria-label="Loading share">
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
              <Skeleton variant="rounded" width={48} height={48} />
              <Skeleton variant="text" sx={{ flex: 1, fontSize: 24 }} />
            </Box>
            <Skeleton variant="text" width="45%" />
            <Skeleton variant="text" width="60%" />
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1 }}>
              <Skeleton variant="rounded" height={48} sx={{ width: { xs: "100%", sm: 160 } }} />
              <Skeleton variant="rounded" height={48} sx={{ width: { xs: "100%", sm: 130 } }} />
            </Box>
          </Card>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={112} />
            ))}
          </Box>
        </>
      )}

      {state === "notfound" && (
        <EmptyState
          title="Share not found"
          description="It may have been removed, or the link points at a different name."
          actionLabel="Back to all shares"
          onAction={() => navigate("/")}
        />
      )}

      {state === "deleted" && (
        <EmptyState
          icon={<DeleteOutlineOutlinedIcon />}
          title="This share was deleted by its publisher"
          actionLabel="Back to all shares"
          onAction={() => navigate("/")}
        />
      )}

      {state === "missing" && (
        <EmptyState
          icon={<CloudOffOutlinedIcon />}
          title="This share isn't on your node yet"
          description="Your node has asked its peers for it. Try again in a minute."
          actionLabel="Retry"
          onAction={retry}
        />
      )}

      {state === "error" && (
        <EmptyState
          icon={<ErrorOutlineOutlinedIcon />}
          title="This share could not be loaded"
          description="Check that your node is running, then try again."
          actionLabel="Retry"
          onAction={retry}
        />
      )}

      {state === "ready" && fileData && (
        <>
          <Card aria-labelledby="share-title">
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", minWidth: 0 }}>
              {icon ? (
                <CategoryIcon src={icon} alt="" loading="lazy" />
              ) : (
                <Box sx={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
                  <AttachFileIcon />
                </Box>
              )}
              <FileTitle id="share-title" component="h1">
                {title || "Untitled share"}
              </FileTitle>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}>
              <AuthorLink type="button" onClick={() => navigate(profilePath(author))} aria-label={`Shares by ${author}`}>
                <Avatar src={avatarUrl(author)} alt="" sx={{ width: 32, height: 32 }} slotProps={{ img: { loading: "lazy" } }} />
                <span>
                  by <strong>{author}</strong>
                </span>
              </AuthorLink>
              {fileData.created && (
                <Meta>
                  Shared {formatDate(fileData.created)}
                  {fileData.updated && fileData.updated !== fileData.created ? ` · updated ${formatDate(fileData.updated)}` : ""}
                </Meta>
              )}
              {categories && <Meta>{categories}</Meta>}
            </Box>

            {phone ? (
              <>
                {primaryActions && <ActionRow>{primaryActions}</ActionRow>}
                <CompactActionRow role="group" aria-label="Share actions">
                  {secondaryActions}
                </CompactActionRow>
              </>
            ) : (
              <ActionRow>
                {primaryActions}
                {secondaryActions}
              </ActionRow>
            )}
          </Card>

          {(fileData.htmlDescription || fileData.fullDescription) && (
            <Card aria-label="Description">
              <Box
                ref={measureDescription}
                sx={{
                  position: "relative",
                  maxHeight: collapsible && !expanded ? DESCRIPTION_COLLAPSE_PX : "none",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                {fileData.htmlDescription ? (
                  <DisplayHtml html={fileData.htmlDescription} />
                ) : (
                  <FileDescription>{fileData.fullDescription}</FileDescription>
                )}
                {collapsible && !expanded && <DescriptionFade aria-hidden />}
              </Box>
              {collapsible && (
                <Button
                  variant="text"
                  onClick={() => setExpanded((e) => !e)}
                  aria-expanded={expanded}
                  sx={{ alignSelf: "flex-start", minHeight: 44 }}
                >
                  {expanded ? "Show less" : "Show more"}
                </Button>
              )}
            </Card>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <SectionTitle component="h2">
              {files.length === 1 ? "1 file" : `${files.length} files`}
            </SectionTitle>
            {files.length === 0 ? (
              <EmptyState title="No files in this share" description="The publisher did not attach any files." />
            ) : (
              <FileList>
                {files.map((file, index) => (
                  <FileRow key={`${file.identifier || file.filename}-${index}`} file={file} jsonId={id} />
                ))}
              </FileList>
            )}
          </Box>

          <CommentSection
            key={id}
            postId={id}
            postName={author}
            commentsId={typeof fileData.commentsId === "string" ? fileData.commentsId : undefined}
          />
        </>
      )}
    </Page>
  );
};
