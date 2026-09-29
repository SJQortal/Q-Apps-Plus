import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Box, Button, IconButton, Skeleton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { CopyLinkButton } from "../../components/common/CopyLinkButton.tsx";
import { SaveToCollectionButton } from "../../components/common/SaveToCollection/SaveToCollectionButton";
import { FollowButton } from "../../components/common/FollowButton.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";
import { CommentSection } from "../../components/common/Comments/CommentSection";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { MyContext, isFailedStatus } from "../../wrappers/DownloadWrapper";
import { RootState } from "../../state/store";
import { addToHashMap } from "../../state/features/fileSlice.ts";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { searchQdn } from "../../utils/qdnSearch";
import { avatarUrl, profilePath, shareLink } from "../../utils/qortalLinks";
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

type LoadState = "loading" | "ready" | "notfound" | "error";
type FetchState = Exclude<LoadState, "ready">;

function decodeParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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

type ShareLookup = { kind: "notfound" } | { kind: "found"; data: any };

/** One search (limit 1) for the metadata, then one FETCH_QDN_RESOURCE for the JSON body. */
async function fetchShare(name: string, id: string): Promise<ShareLookup> {
  const rows = await searchQdn({ service: "DOCUMENT", identifier: id, name, limit: 1, includemetadata: true });
  if (!rows.length) return { kind: "notfound" };
  const summary = rows[0];
  const body = await qortalRequest({ action: "FETCH_QDN_RESOURCE", name, service: "DOCUMENT", identifier: id });
  if (!body || body.error) throw new Error(typeof body?.error === "string" ? body.error : "Could not read the share");
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
  /** Extra primary actions (e.g. Save to collection), rendered after Copy link. */
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
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const fileData: any = cached ?? null;
  const state: LoadState = cached ? "ready" : fetchState;

  // Measured once the description is in the DOM; long ones start collapsed.
  const measureDescription = useCallback((el: HTMLDivElement | null) => {
    if (el) setCollapsible(el.scrollHeight > DESCRIPTION_COLLAPSE_PX);
  }, []);

  /**
   * Starts the fetch; callers set `fetchState` to "loading" first. Returns a
   * cancel function so an unmounted page ignores a late answer. The found
   * share goes into hashMapFiles, which is what the page renders from (and
   * what makes the next open warm).
   */
  const load = useCallback(() => {
    let active = true;
    if (name && id) {
      fetchShare(name, id).then(
        (result) => {
          if (!active) return;
          if (result.kind === "notfound") setFetchState("notfound");
          else dispatch(addToHashMap(result.data));
        },
        () => {
          if (active) setFetchState("error");
        }
      );
    }
    return () => {
      active = false;
    };
  }, [dispatch, id, name]);

  useEffect(() => {
    if (!name || !id || cached) return;
    return load();
  }, [cached, id, load, name]);

  const retry = () => {
    setFetchState("loading");
    load();
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

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  const title: string = fileData?.title || "";

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

            <ActionRow>
              {files.length > 0 && (
                <Button
                  variant="contained"
                  startIcon={<CloudDownloadOutlinedIcon />}
                  onClick={fetchAll}
                  disabled={pendingFiles.length === 0}
                >
                  {allReady ? "All files ready" : pendingFiles.length === 0 ? "Fetching…" : files.length === 1 ? "Fetch file" : "Fetch all files"}
                </Button>
              )}
              <CopyLinkButton link={shareLink(author, id)} tooltipTitle="Copy link" label="Copy link" />
              <SaveToCollectionButton share={{ name: author, identifier: id, title: fileData?.title }} variant="button" size="medium" />
              {extraActions}
              {author !== username && <FollowButton followerName={author} />}
            </ActionRow>
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

          <CommentSection key={id} postId={id} postName={author} />
        </>
      )}
    </Page>
  );
};
