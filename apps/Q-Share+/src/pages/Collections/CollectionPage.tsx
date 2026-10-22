import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Box, Button, CircularProgress, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
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
  buildCollectionBody,
  collectionKey,
  fetchCollection,
  publishCollection,
  toggleItem,
  type Collection,
} from "../../utils/collections";
import { avatarUrl, decodeParam, profilePath } from "../../utils/qortalLinks";
import { isHubDecline } from "../../utils/hubErrors";
import { resourceStatus } from "../../utils/qdnResource";
import { isNameHidden, useAppSettings } from "../../utils/settings";
import { formatDate } from "../../utils/time";
import { CollectionDialog } from "./CollectionDialog";
import { CardList, InfoCard, ItemRow, ItemRows, Page, PhoneHeader, PublisherLink } from "./Collections-styles";

/** "fetching": the node knows the collection but hasn't got its data yet; "unavailable": still not after the retries. */
type Status = "loading" | "ready" | "error" | "missing" | "fetching" | "unavailable";

const countLabel = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

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

/** /collection/:name/:id, keyed by the pair so every collection starts with fresh page state. */
export function CollectionPage() {
  const params = useParams();
  const name = decodeParam(params.name);
  const id = decodeParam(params.id);
  return <CollectionView key={`${name}/${id}`} name={name} id={id} />;
}

function CollectionView({ name, id }: { name: string; id: string }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const user = useSelector((state: RootState) => state.auth.user);
  const hashMapFiles = useSelector((state: RootState) => state.file.hashMapFiles);
  const reusedIdFiles = useSelector((state: RootState) => state.file.reusedIdFiles);
  const collection = useSelector((state: RootState) => state.collections.byKey[collectionKey(name, id)]);
  const [status, setStatus] = useState<Status>(!name || !id ? "missing" : collection ? "ready" : "loading");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Video | null>(null);
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
  const grid = useListView() === "grid";
  const items: Video[] = useMemo(
    () =>
      (collection?.items ?? [])
        .filter((item) => !isNameHidden(item.name, settings))
        .map((item) => ({
        id: item.identifier,
        user: item.name,
        title: "",
        description: "",
        created: undefined,
        service: "DOCUMENT",
      })),
    [collection?.items, settings]
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
  const goBack = useSafeBack("/collections");

  const republish = async (next: Collection, successMessage: string): Promise<boolean> => {
    setBusy(true);
    try {
      const saved = await publishCollection({
        name: next.name,
        identifier: next.identifier,
        previousItems: collection?.items ?? [],
        body: buildCollectionBody({
          title: next.title,
          description: next.description,
          items: next.items,
          created: next.created,
        }),
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

  const confirmRemove = async () => {
    if (!collection || !removeTarget) return;
    const next = toggleItem(collection, { name: removeTarget.user, identifier: removeTarget.id });
    if (await republish(next, `Removed from ${collection.title}`)) setRemoveTarget(null);
  };

  const confirmDelete = async () => {
    if (!collection) return;
    if (await republish({ ...collection, items: [] }, "Collection deleted")) {
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
  } else {
    body = (
      <>
        <InfoCard aria-label="About this collection">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
              {collection.title || "Untitled collection"}
            </Typography>
            {collection.description ? (
              <Typography sx={{ mt: 0.5, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {collection.description}
              </Typography>
            ) : null}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 1, color: "text.secondary", fontSize: 13 }}>
              <PublisherLink onClick={() => navigate(profilePath(name))} aria-label={`Shares by ${name}`} style={{ marginLeft: 0 }}>
                <Avatar sx={{ width: 22, height: 22 }} src={avatarUrl(name)} alt="" slotProps={{ img: { loading: "lazy" } }} />
                <span>{name}</span>
              </PublisherLink>
              <span>· {countLabel(collection.items.length)}</span>
              {collection.updated ? <span>· updated {formatDate(collection.updated)}</span> : null}
            </Box>
          </Box>
          {isOwner ? (
            <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" }, "& .MuiButton-root": { minHeight: 44 } }}>
              <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button variant="contained" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </Box>
          ) : null}
        </InfoCard>

        {items.length > 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: -1 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
              Shares
            </Typography>
            <ListViewToggle />
          </Box>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={<CollectionsBookmarkOutlinedIcon />}
            title="This collection is empty"
            description={isOwner ? "Save shares to it with the bookmark button on any share." : undefined}
          />
        ) : isOwner && grid ? (
          // Each card carries its own Remove button; the rows keep theirs beside them.
          <FileList files={items} onRemove={setRemoveTarget} />
        ) : isOwner ? (
          <ItemRows>
            {items.map((video) => (
              <ItemRow key={shareKey(video.user, video.id)}>
                <FileList files={[video]} />
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
          <FileList files={items} />
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
            {collection?.title || "Collection"}
          </Typography>
        </PhoneHeader>
      ) : (
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/collections")} sx={{ minHeight: 44 }}>
            Collections
          </Button>
        </Box>
      )}

      {body}

      {collection ? (
        <CollectionDialog open={editOpen} onClose={() => setEditOpen(false)} collection={collection} />
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
          “{shareTitle(removeTarget)}” will be removed from “{collection?.title}”.
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
        title="Delete collection?"
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
        <Typography>
          QDN keeps every publish, so a collection can't be erased. Deleting “{collection?.title}” removes all its items
          and keeps the title: it disappears from All, and stays under Mine as empty until you fill it again.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This republishes the collection: Hub asks you to confirm, and the usual small QDN fee applies.
        </Typography>
      </ResponsiveDialog>
    </Page>
  );
}
