import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Box, Button, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
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
import { FileList } from "../Home/FileList";
import { upsertCollection } from "../../state/features/collectionsSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import type { Video } from "../../state/features/fileSlice";
import type { RootState } from "../../state/store";
import { queue } from "../../wrappers/GlobalWrapper";
import {
  buildCollectionBody,
  collectionKey,
  fetchCollection,
  publishCollection,
  toggleItem,
  type Collection,
} from "../../utils/collections";
import { avatarUrl, decodeParam, profilePath } from "../../utils/qortalLinks";
import { isNameHidden, useAppSettings } from "../../utils/settings";
import { formatDate } from "../../utils/time";
import { CollectionDialog } from "./CollectionDialog";
import { CardList, InfoCard, ItemRow, ItemRows, Page, PhoneHeader, PublisherLink } from "./Collections-styles";

type Status = "loading" | "ready" | "error" | "missing";

const countLabel = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

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
  const collection = useSelector((state: RootState) => state.collections.byKey[collectionKey(name, id)]);
  const [status, setStatus] = useState<Status>(!name || !id ? "missing" : collection ? "ready" : "loading");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Video | null>(null);
  const [busy, setBusy] = useState(false);
  const { getFile, checkAndUpdateFile } = useFetchFiles();

  // State changes happen in the promise callbacks, so effects only start the read.
  const read = useCallback(
    (fresh: boolean): Promise<void> =>
      fetchCollection(name, id, { fresh }).then(
        (loaded) => {
          if (!loaded) {
            setStatus("missing");
            return;
          }
          dispatch(upsertCollection(loaded));
          setStatus("ready");
        },
        () => setStatus("error")
      ),
    [name, id, dispatch]
  );

  useEffect(() => {
    if (name && id) read(false);
  }, [read, name, id]);

  const retry = () => {
    setStatus("loading");
    read(true);
  };

  // Hidden names (Settings → Content) apply here as on Home and in comments.
  const settings = useAppSettings();
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

  // One FETCH per share body through the queue; no search per item.
  const requested = useRef(new Set<string>());
  useEffect(() => {
    for (const video of items) {
      if (requested.current.has(video.id) || !checkAndUpdateFile(video)) continue;
      requested.current.add(video.id);
      queue.push(() => getFile(video.user, video.id, video));
    }
  }, [items, checkAndUpdateFile, getFile]);

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
    } catch {
      dispatch(setNotification({ msg: `Could not update ${next.title}`, alertType: "error" }));
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

  const shareTitle = (video: Video | null) =>
    (video && hashMapFiles[video.id]?.title) || video?.id || "this share";

  let body: React.ReactNode;
  if (status === "loading" || (status === "ready" && !collection)) {
    body = (
      <>
        <Skeleton variant="rounded" sx={{ width: "100%", height: 120 }} />
        <CardList aria-busy="true" aria-label="Loading collection">
          {[0, 1, 2].map((n) => (
            <li key={n}>
              <Skeleton variant="rounded" sx={{ width: "100%", height: 64 }} />
            </li>
          ))}
        </CardList>
      </>
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

        {items.length === 0 ? (
          <EmptyState
            icon={<CollectionsBookmarkOutlinedIcon />}
            title="This collection is empty"
            description={isOwner ? "Save shares to it with the bookmark button on any share." : undefined}
          />
        ) : isOwner ? (
          <ItemRows>
            {items.map((video) => (
              <ItemRow key={video.id}>
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
