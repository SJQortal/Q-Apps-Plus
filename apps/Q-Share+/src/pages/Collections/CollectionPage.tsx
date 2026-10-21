import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Box, Breadcrumbs, Button, CircularProgress, IconButton, Link, Skeleton, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import LibraryAddOutlinedIcon from "@mui/icons-material/LibraryAddOutlined";
import RemoveCircleOutlinedIcon from "@mui/icons-material/RemoveCircleOutlined";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useSafeBack } from "../../hooks/useSafeBack";
import { useFetchFiles } from "../../hooks/useFetchFiles";
import { EmptyState } from "../../components/common/EmptyState";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import { FileGridSkeleton, FileList } from "../Home/FileList";
import { ListViewToggle, useListView } from "../../components/common/ListViewToggle";
import { upsertCollection } from "../../state/features/collectionsSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { heldShare, shareKey, type Video } from "../../state/features/fileSlice";
import type { RootState } from "../../state/store";
import {
  COLLECTION_SERVICE,
  MAX_FOLDERS,
  MAX_FOLDER_DEPTH,
  collectionKey,
  collectionPath,
  editCollectionBody,
  fetchCollection,
  publishCollection,
  type Collection,
} from "../../utils/collections";
import { avatarUrl, decodeParam, profilePath } from "../../utils/qortalLinks";
import { isHubDecline } from "../../utils/hubErrors";
import { resourceStatus } from "../../utils/qdnResource";
import { isNameHidden, useAppSettings } from "../../utils/settings";
import { formatDate } from "../../utils/time";
import {
  contentsCount,
  findFolder,
  folderCount,
  isDeletedCollection,
  isEmptyCollection,
  moveItem,
  removeFolder,
  toggleItemIn,
  type Container,
} from "../../utils/collectionFolders";
import { CollectionCover } from "./CollectionCover";
import { CollectionDialog } from "./CollectionDialog";
import { FolderDialog } from "./FolderDialog";
import { FolderGrid } from "./FolderGrid";
import { MoveDialog } from "./MoveDialog";
import { CopyCollectionDialog } from "./CopyCollectionDialog";
import { useMyCollections } from "../../components/common/SaveToCollection/useMyCollections";
import { CardList, InfoCard, ItemRow, ItemRows, Page, PhoneHeader, PublisherLink } from "./Collections-styles";

/** "fetching": the node knows the collection but hasn't got its data yet; "unavailable": still not after the retries. */
type Status = "loading" | "ready" | "error" | "missing" | "fetching" | "unavailable";

const countLabel = (n: number) => `${n} ${n === 1 ? "share" : "shares"}`;
const foldersLabel = (n: number) => `${n} ${n === 1 ? "folder" : "folders"}`;

/**
 * Core's statuses for a resource the node knows about but can't serve yet.
 * A FETCH_QDN_RESOURCE of it holds for up to about 15 s and then fails
 * ("Data unavailable") while the node asks its peers for the data.
 */
const NOT_LOCAL_YET = new Set(["PUBLISHED", "DOWNLOADING", "DOWNLOADED", "BUILDING", "MISSING_DATA"]);
/** Every chunk is here: FETCH again (the node builds it on the way). The share page's set. */
const LOCAL = new Set(["READY", "DOWNLOADED", "BUILDING"]);
/** Waits between status checks while the node fetches from peers (about 30 s in all). */
const PEER_RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

/**
 * The collection's Core status, or null when the node doesn't answer.
 * resourceStatus encodes names such as "Vallot-/8/", which q-apps.js breaks.
 */
async function collectionStatus(name: string, identifier: string): Promise<string | null> {
  try {
    const response = await resourceStatus({ service: COLLECTION_SERVICE, name, identifier });
    return typeof response?.status === "string" ? response.status : null;
  } catch {
    return null;
  }
}

function folderSummary(folder: Container): string {
  const { shares } = contentsCount(folder);
  const inside = folderCount(folder);
  return [countLabel(shares), ...(inside > 0 ? [foldersLabel(inside)] : [])].join(", ");
}

/**
 * /collection/:name/:id and /collection/:name/:id/folder/:folderId, keyed by
 * the pair so every collection starts with fresh page state (its folders
 * share the collection's).
 */
export function CollectionPage() {
  const params = useParams();
  const name = decodeParam(params.name);
  const id = decodeParam(params.id);
  const folderId = params.folderId ? decodeParam(params.folderId) : null;
  return <CollectionView key={`${name}/${id}`} name={name} id={id} folderId={folderId || null} />;
}

function CollectionView({ name, id, folderId }: { name: string; id: string; folderId: string | null }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  // The "Copy of … by …" links: 44 px tall on phones, to be tapped.
  const creditLinkSx = {
    font: "inherit",
    fontWeight: 600,
    verticalAlign: phone ? "middle" : "baseline",
    ...(phone ? { minHeight: 44, display: "inline-flex", alignItems: "center", textAlign: "left" as const } : {}),
  };
  const user = useSelector((state: RootState) => state.auth.user);
  const hashMapFiles = useSelector((state: RootState) => state.file.hashMapFiles);
  const reusedIdFiles = useSelector((state: RootState) => state.file.reusedIdFiles);
  const collection = useSelector((state: RootState) => state.collections.byKey[collectionKey(name, id)]);
  const [status, setStatus] = useState<Status>(!name || !id ? "missing" : collection ? "ready" : "loading");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Video | null>(null);
  const [moveTarget, setMoveTarget] = useState<Video | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  // The folder dialog: a new folder in this page's container, or an edit of this folder.
  const [folderDialog, setFolderDialog] = useState<"new" | "edit" | null>(null);
  const [busy, setBusy] = useState(false);
  // Which of PEER_RETRY_DELAYS_MS the next status check waits for.
  const [peerRetry, setPeerRetry] = useState(0);
  const { queueBodies } = useFetchFiles();

  // State changes happen in the promise callbacks, so effects only start the read.
  // `retry` counts the status checks made so far in this round.
  const read = useCallback(
    (fresh: boolean, retry = 0): Promise<void> =>
      fetchCollection(name, id, { fresh }).then(
        (loaded) => {
          if (!loaded) {
            setStatus("missing");
            return;
          }
          dispatch(upsertCollection(loaded));
          setStatus("ready");
        },
        async () => {
          const state = await collectionStatus(name, id);
          if (state === "NOT_PUBLISHED") {
            setStatus("missing");
          } else if (state && NOT_LOCAL_YET.has(state)) {
            if (retry < PEER_RETRY_DELAYS_MS.length) {
              setPeerRetry(retry);
              setStatus("fetching");
            } else {
              setStatus("unavailable");
            }
          } else {
            setStatus("error");
          }
        }
      ),
    [name, id, dispatch]
  );

  useEffect(() => {
    if (name && id) read(false);
  }, [read, name, id]);

  // While the node fetches from peers, check its status after each delay,
  // counting only time the page is visible, and FETCH again only once every
  // chunk is local, as the share page does: each FETCH of data that isn't
  // local would hold a node thread for ~15 s.
  useEffect(() => {
    if (status !== "fetching") return;
    let active = true;
    let timer: number | undefined;
    let fired = false;
    const next = peerRetry + 1;
    const check = () =>
      collectionStatus(name, id).then((state) => {
        if (!active) return;
        if (state === "NOT_PUBLISHED") setStatus("missing");
        else if (state && LOCAL.has(state)) void read(true, next);
        else if (next < PEER_RETRY_DELAYS_MS.length) setPeerRetry(next);
        else setStatus("unavailable");
      });
    const schedule = () => {
      if (fired || timer !== undefined || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        fired = true;
        void check();
      }, PEER_RETRY_DELAYS_MS[peerRetry]);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        schedule();
      } else if (timer !== undefined && !fired) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, peerRetry, read, name, id]);

  const retry = () => {
    setStatus("loading");
    read(true);
  };

  // Hidden names (Settings → Content) apply here as on Home and in comments.
  const settings = useAppSettings();
  const grid = useListView("collectionView") === "grid";
  // This page's part of the collection: the collection itself, or one of its folders.
  const { found, container } = useMemo(() => {
    const inFolder = collection && folderId ? findFolder(collection, folderId) : null;
    const place: Container | null = collection ? (folderId ? (inFolder?.folder ?? null) : collection) : null;
    return { found: inFolder, container: place };
  }, [collection, folderId]);
  const items: Video[] = useMemo(
    () =>
      (container?.items ?? [])
        .filter((item) => !isNameHidden(item.name, settings))
        .map((item) => ({
        id: item.identifier,
        user: item.name,
        title: "",
        description: "",
        created: undefined,
        service: "DOCUMENT",
      })),
    [container, settings]
  );

  // One FETCH per share body through the shared queue, never one another list
  // or an earlier visit already has queued; no search per item. With no search
  // to refresh, shares already marked unavailable are left alone (their rows
  // still open the share page, which has Retry).
  useEffect(() => {
    queueBodies(items, false);
  }, [items, queueBodies]);

  const isOwner = Boolean(
    user && name && (user.name === name || (user.names ?? []).some((record) => record.name === name))
  );
  // A copy of this collection the signed-in name already has (a deleted,
  // emptied one doesn't count, so the collection can be copied again).
  const { myName, byKey: knownCollections, ensure: ensureMine } = useMyCollections(!isOwner && Boolean(user?.name));
  const copyIn = useCallback(
    (collections: Record<string, Collection>) =>
      isOwner || !myName
        ? null
        : (Object.values(collections).find(
            (c) =>
              c.name === myName &&
              c.copiedFrom?.name === name &&
              c.copiedFrom.identifier === id &&
              !isEmptyCollection(c)
          ) ?? null),
    [isOwner, myName, name, id]
  );
  const myCopy = useMemo(() => copyIn(knownCollections), [copyIn, knownCollections]);
  // Your collections load a moment after the page: Copy waits for them, so
  // a copy you already have is opened rather than made a second time.
  const reduxStore = useStore<RootState>();
  const [checkingCopy, setCheckingCopy] = useState(false);
  const startCopy = async () => {
    setCheckingCopy(true);
    try {
      await ensureMine();
    } finally {
      setCheckingCopy(false);
    }
    const existing = copyIn(reduxStore.getState().collections.byKey);
    if (existing) {
      dispatch(setNotification({ msg: "You already have a copy of this collection.", alertType: "info" }));
      navigate(collectionPath(existing.name, existing.identifier));
    } else {
      setCopyOpen(true);
    }
  };
  const parentId = found && found.path.length > 1 ? found.path[found.path.length - 2].id : null;
  const parentPath = folderId ? collectionPath(name, id, parentId) : "/collections";
  const goBack = useSafeBack(parentPath);

  const republish = async (next: Collection, successMessage: string): Promise<boolean> => {
    setBusy(true);
    try {
      const saved = await publishCollection({
        name: next.name,
        identifier: next.identifier,
        previous: collection ?? null,
        body: editCollectionBody(next),
      });
      dispatch(upsertCollection(saved));
      dispatch(setNotification({ msg: successMessage, alertType: "success" }));
      return true;
    } catch (error) {
      // A "no" in Hub's dialog is the user's choice, not a failure.
      if (!isHubDecline(error)) dispatch(setNotification({ msg: `Could not update ${next.title}`, alertType: "error" }));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const here = found?.folder ?? null;
  const placeTitle = here ? here.title || "Untitled folder" : collection?.title || "Untitled collection";

  const confirmRemove = async () => {
    if (!collection || !removeTarget) return;
    const next = toggleItemIn(collection, folderId, { name: removeTarget.user, identifier: removeTarget.id });
    if (await republish(next, `Removed from ${placeTitle}`)) setRemoveTarget(null);
  };

  const confirmMove = async (to: string | null) => {
    if (!collection || !moveTarget) return;
    const next = moveItem(collection, { name: moveTarget.user, identifier: moveTarget.id }, folderId, to);
    const target = to ? findFolder(collection, to)?.folder.title || "Untitled folder" : collection.title;
    if (await republish(next, `Moved to ${target}`)) setMoveTarget(null);
  };

  const confirmDelete = async () => {
    if (!collection) return;
    if (here) {
      if (await republish(removeFolder(collection, here.id), "Folder deleted")) {
        setDeleteOpen(false);
        navigate(parentPath, { replace: true });
      }
      return;
    }
    if (await republish({ ...collection, items: [], folders: [] }, "Collection deleted")) {
      setDeleteOpen(false);
      navigate("/collections");
    }
  };

  // Only this row's name's body: another name's under the same identifier is a different share.
  const shareTitle = (video: Video | null) =>
    (video && heldShare({ hashMapFiles, reusedIdFiles }, video.user, video.id)?.title) || video?.id || "this share";

  let body: React.ReactNode;
  if (status === "loading" || (status === "ready" && !collection)) {
    body = (
      <>
        <Skeleton variant="rounded" sx={{ width: "100%", height: 120 }} />
        {grid ? (
          <FileGridSkeleton count={3} label="Loading collection" />
        ) : (
          <CardList aria-busy="true" aria-label="Loading collection">
            {[0, 1, 2].map((n) => (
              <li key={n}>
                <Skeleton variant="rounded" sx={{ width: "100%", height: 64 }} />
              </li>
            ))}
          </CardList>
        )}
      </>
    );
  } else if (status === "fetching") {
    body = (
      <EmptyState
        icon={<CircularProgress size={36} aria-hidden />}
        title="Not on your node yet"
        description="Fetching it from peers…"
      />
    );
  } else if (status === "unavailable") {
    body = (
      <EmptyState
        icon={<CollectionsBookmarkOutlinedIcon />}
        title="Not on your node yet"
        description="Your node couldn't get it from its peers yet. Try again in a minute."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (status === "error") {
    body = (
      <EmptyState
        title="Couldn't load this collection"
        description="Check that your node is running, then try again."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (status === "missing") {
    body = (
      <EmptyState
        icon={<CollectionsBookmarkOutlinedIcon />}
        title="Collection not found"
        description="It may not have reached your node yet, or the link is wrong."
        actionLabel="Retry"
        onAction={retry}
      />
    );
  } else if (collection && isDeletedCollection(collection)) {
    body = (
      <EmptyState
        icon={<CollectionsBookmarkOutlinedIcon />}
        title={`${collection.title || "This collection"} was deleted`}
        description={`${name} deleted this collection. The shares that were in it are still on QDN.`}
        actionLabel="Collections"
        onAction={() => navigate("/collections", { replace: true })}
      />
    );
  } else if (folderId && !here) {
    body = (
      <EmptyState
        icon={<FolderOutlinedIcon />}
        title="Folder not found"
        description="It may have been deleted, or moved out of this collection."
        actionLabel="Open the collection"
        onAction={() => navigate(collectionPath(name, id), { replace: true })}
      />
    );
  } else {
    const counts = contentsCount(container ?? { items: [] });
    const subfolders = container?.folders ?? [];
    const canAddFolder = folderCount(collection) < MAX_FOLDERS && (found?.path.length ?? 0) < MAX_FOLDER_DEPTH;
    body = (
      <>
        <InfoCard aria-label={here ? "About this folder" : "About this collection"}>
          <CollectionCover
            cover={here ? here.cover : collection.cover}
            kind={here ? "folder" : "collection"}
            size={phone ? 88 : 120}
          />
          <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
            {found ? (
              <Breadcrumbs aria-label="Where this folder is" separator="›" sx={{ mb: 0.5, fontSize: 14, "& .MuiBreadcrumbs-ol": { flexWrap: "wrap" } }}>
                {[{ id: null as string | null, title: collection.title || "Untitled collection" }, ...found.path.slice(0, -1).map((f) => ({ id: f.id as string | null, title: f.title || "Untitled folder" }))].map(
                  (crumb) => (
                    <Link
                      key={crumb.id ?? "root"}
                      component="button"
                      type="button"
                      underline="hover"
                      color="text.secondary"
                      onClick={() => navigate(collectionPath(name, id, crumb.id))}
                      sx={{ font: "inherit", minHeight: phone ? 44 : 28, textAlign: "left", wordBreak: "break-word" }}
                    >
                      {crumb.title}
                    </Link>
                  )
                )}
              </Breadcrumbs>
            ) : null}
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
              {placeTitle}
            </Typography>
            {collection.copiedFrom ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, wordBreak: "break-word" }}>
                Copy of{" "}
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => collection.copiedFrom && navigate(collectionPath(collection.copiedFrom.name, collection.copiedFrom.identifier))}
                  sx={creditLinkSx}
                >
                  “{collection.copiedFrom.title || "a collection"}”
                </Link>{" "}
                by{" "}
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  color="inherit"
                  onClick={() => collection.copiedFrom && navigate(profilePath(collection.copiedFrom.name))}
                  sx={creditLinkSx}
                >
                  {collection.copiedFrom.name}
                </Link>
              </Typography>
            ) : null}
            {(here ? here.description : collection.description) ? (
              <Typography sx={{ mt: 0.5, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {here ? here.description : collection.description}
              </Typography>
            ) : null}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1, color: "text.secondary", fontSize: 13 }}>
              <PublisherLink onClick={() => navigate(profilePath(name))} aria-label={`Shares by ${name}`} style={{ marginLeft: 0 }}>
                <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(name)} alt="" slotProps={{ img: { loading: "lazy" } }} />
                <span>{name}</span>
              </PublisherLink>
              <span>· {countLabel(counts.shares)}</span>
              {counts.folders > 0 ? <span>· {foldersLabel(counts.folders)}</span> : null}
              {collection.updated ? <span>· updated {formatDate(collection.updated)}</span> : null}
            </Box>
          </Box>
          {isOwner ? (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
                width: { xs: "100%", sm: "auto" },
                "& .MuiButton-root": { minHeight: 44 },
              }}
            >
              <Button
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => (here ? setFolderDialog("edit") : setEditOpen(true))}
              >
                Edit
              </Button>
              {canAddFolder ? (
                <Button variant="outlined" startIcon={<CreateNewFolderOutlinedIcon />} onClick={() => setFolderDialog("new")}>
                  New folder
                </Button>
              ) : null}
              <Button variant="contained" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </Box>
          ) : myName && !here ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, width: { xs: "100%", sm: "auto" }, "& .MuiButton-root": { minHeight: 44 } }}>
              {myCopy ? (
                <Button variant="outlined" onClick={() => navigate(collectionPath(myCopy.name, myCopy.identifier))}>
                  Open your copy
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<LibraryAddOutlinedIcon />}
                  onClick={() => void startCopy()}
                  loading={checkingCopy}
                  loadingPosition="start"
                >
                  Copy to my collections
                </Button>
              )}
            </Box>
          ) : null}
        </InfoCard>

        {subfolders.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
              Folders
            </Typography>
            <FolderGrid name={name} identifier={id} folders={subfolders} />
          </Box>
        ) : null}

        {items.length > 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: -1 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
              Shares
            </Typography>
            <ListViewToggle setting="collectionView" />
          </Box>
        ) : null}

        {items.length === 0 ? (
          subfolders.length > 0 ? null : (
            <EmptyState
              icon={here ? <FolderOutlinedIcon /> : <CollectionsBookmarkOutlinedIcon />}
              title={here ? "This folder is empty" : "This collection is empty"}
              description={
                isOwner
                  ? `Add shares with the bookmark button on any share and pick ${here ? "this folder" : "this collection"}.`
                  : undefined
              }
            />
          )
        ) : isOwner && grid ? (
          // Each card carries its own Move and Remove buttons; the rows keep theirs beside them.
          <FileList
            files={items}
            layout="collectionView"
            onRemove={setRemoveTarget}
            onMove={folderCount(collection) > 0 ? setMoveTarget : undefined}
          />
        ) : isOwner ? (
          <ItemRows>
            {items.map((video) => (
              <ItemRow key={shareKey(video.user, video.id)}>
                <FileList files={[video]} layout="collectionView" />
                {folderCount(collection) > 0 ? (
                  <Tooltip title="Move to a folder">
                    <IconButton
                      aria-label={`Move ${shareTitle(video)}`}
                      onClick={() => setMoveTarget(video)}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <DriveFileMoveOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                ) : null}
                <Tooltip title="Remove from collection">
                  <IconButton
                    aria-label={`Remove ${shareTitle(video)} from collection`}
                    onClick={() => setRemoveTarget(video)}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <RemoveCircleOutlinedIcon />
                  </IconButton>
                </Tooltip>
              </ItemRow>
            ))}
          </ItemRows>
        ) : (
          <FileList files={items} layout="collectionView" />
        )}
      </>
    );
  }

  return (
    <Page>
      {phone ? (
        <PhoneHeader>
          <IconButton aria-label="Back" onClick={goBack} sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography noWrap sx={{ flex: 1, fontSize: 18, fontWeight: 700 }}>
            {here ? placeTitle : collection?.title || "Collection"}
          </Typography>
        </PhoneHeader>
      ) : (
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(parentPath)} sx={{ minHeight: 44 }}>
            {!folderId
              ? "Collections"
              : parentId
                ? findFolder(collection ?? { items: [] }, parentId)?.folder.title || "Back"
                : collection?.title || "Collection"}
          </Button>
        </Box>
      )}

      {body}

      {collection ? (
        <CollectionDialog open={editOpen} onClose={() => setEditOpen(false)} collection={collection} />
      ) : null}

      {collection && folderDialog ? (
        <FolderDialog
          open
          onClose={() => setFolderDialog(null)}
          collection={collection}
          folder={folderDialog === "edit" ? here : null}
          parentId={folderId}
          onSaved={(savedId) => {
            if (folderDialog === "new") navigate(collectionPath(name, id, savedId));
          }}
        />
      ) : null}

      {collection && copyOpen ? (
        <CopyCollectionDialog
          open
          onClose={() => setCopyOpen(false)}
          source={collection}
          onCopied={(copy) => {
            setCopyOpen(false);
            navigate(collectionPath(copy.name, copy.identifier));
          }}
        />
      ) : null}

      {collection && moveTarget ? (
        <MoveDialog
          open
          onClose={() => setMoveTarget(null)}
          collection={collection}
          shareTitle={shareTitle(moveTarget)}
          from={folderId}
          busy={busy}
          onMove={confirmMove}
        />
      ) : null}

      <ResponsiveDialog
        open={Boolean(removeTarget)}
        onClose={() => {
          if (!busy) setRemoveTarget(null);
        }}
        dismissible={!busy}
        title="Remove from collection?"
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setRemoveTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="contained" color="error" onClick={confirmRemove} disabled={busy}>
              {busy ? "Publishing…" : "Remove"}
            </Button>
          </>
        }
      >
        <Typography>
          “{shareTitle(removeTarget)}” will be removed from “{placeTitle}”.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This republishes the collection: Hub asks you to confirm, and the usual small QDN fee applies.
        </Typography>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={deleteOpen}
        onClose={() => {
          if (!busy) setDeleteOpen(false);
        }}
        dismissible={!busy}
        title={here ? "Delete folder?" : "Delete collection?"}
        maxWidth="xs"
        actions={
          <>
            <Button onClick={() => setDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="contained" color="error" onClick={confirmDelete} disabled={busy}>
              {busy ? "Publishing…" : "Delete"}
            </Button>
          </>
        }
      >
        {here ? (
          <Typography>
            “{placeTitle}” and everything in it ({folderSummary(here)}) will be removed from “{collection?.title}”. The
            shares themselves stay on QDN.
          </Typography>
        ) : (
          <Typography>
            QDN keeps every publish, so a collection can't be erased. Deleting “{collection?.title}” removes all its
            shares and folders and keeps the title: it disappears from All, and stays under Mine as empty until you fill
            it again.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This republishes the collection: Hub asks you to confirm, and the usual small QDN fee applies.
        </Typography>
      </ResponsiveDialog>
    </Page>
  );
}
