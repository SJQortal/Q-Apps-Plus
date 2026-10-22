/**
 * The seller's Collections tab (qdn/collections.ts): the shop's collections
 * in the order buyers see them, each with its picture, title, how many of
 * its products are listed, and Edit, Move up, Move down and Remove (with
 * Undo); New collection opens the editor. Changes stay in a working copy for
 * the session (other tabs and pages keep it) until Publish sends them in one
 * publish (the document, and the first time the product list's pointer to
 * it); Discard drops them, after asking. Nothing can be changed while a
 * publish is being prepared or sent.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import type { RootState } from "../state/store";
import { EmptyState } from "../components/common/EmptyState";
import { ResponsiveDialog } from "../components/common/mobile";
import { useBottomChromeHeight } from "../components/layout/BottomNav/BottomNav";
import { MAX_COLLECTIONS, type ShopCollection } from "../qdn/collections";
import type { SellerRow } from "./productList";
import { CollectionEditor } from "./CollectionEditor";
import { PublishProductsDialog } from "./PublishProductsDialog";
import { FormError } from "./FormError";
import { useCollections } from "./useCollections";

/** Products a buyer can see: listed, not retired. */
function isShown(row: SellerRow | undefined): boolean {
  return !!row && row.status !== "RETIRED";
}

type Control = "up" | "down" | "edit" | "remove";

export function CollectionsTab({ ready, loading = false }: { ready: boolean; loading?: boolean }) {
  const c = useCollections();
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const byId = useMemo(() => new Map(rows.map((row) => [row.productId, row])), [rows]);
  const bottomChrome = useBottomChromeHeight();
  const [editing, setEditing] = useState<{ key: number; collection: ShopCollection | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [removed, setRemoved] = useState<{ collection: ShopCollection; at: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // After Move, Remove, Undo or the editor, focus goes back to a control of the same (or the next)
  // collection once the list has re-rendered.
  const focusAfter = useRef<{ id: string; control: Control } | null>(null);
  const controls = useRef(new Map<string, HTMLElement | null>());
  const setFocusAfter = (next: { id: string; control: Control }) => {
    focusAfter.current = next;
  };

  useEffect(() => {
    const wanted = focusAfter.current;
    if (!wanted) return;
    focusAfter.current = null;
    const target = controls.current.get(`${wanted.id}\n${wanted.control}`);
    const fallback = controls.current.get(`${wanted.id}\nedit`);
    const element = target && !(target as HTMLButtonElement).disabled ? target : fallback;
    element?.focus();
  }, [c.collections, editing, removed]);

  if (!ready && !loading) {
    return <EmptyState title="Your collections show here once your product list loads" description="See the note above." />;
  }
  if (!ready || c.status === "loading") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }} aria-busy="true" aria-label="Loading collections">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Box>
    );
  }
  if (c.status === "unavailable") {
    return (
      <EmptyState
        title="Couldn't load your collections from your node"
        description="They may still be on their way from peers. Nothing can be changed until they load."
        actionLabel="Retry"
        onAction={c.reload}
      />
    );
  }

  const shownCount = (col: ShopCollection) => col.products.filter((id) => isShown(byId.get(id))).length;
  const full = c.collections.length >= MAX_COLLECTIONS;
  const pending = c.dirty || c.pointerMissing;
  const locked = c.busy;
  const ref = (id: string, control: Control) => (element: HTMLElement | null) => {
    controls.current.set(`${id}\n${control}`, element);
  };

  const publish = async () => {
    if (await c.prepare()) setPublishing(true);
  };
  const move = (col: ShopCollection, at: number, by: -1 | 1) => {
    c.move(col.id, by);
    const to = at + by + 1;
    setAnnouncement(`${col.title} moved to ${to} of ${c.collections.length}.`);
    setFocusAfter({ id: col.id, control: by === -1 ? "up" : "down" });
  };
  const remove = (col: ShopCollection, at: number) => {
    c.remove(col.id);
    setRemoved({ collection: col, at });
    const next = c.collections[at + 1] ?? c.collections[at - 1];
    if (next) setFocusAfter({ id: next.id, control: "remove" });
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {pending && (
        <Paper variant="outlined" component="section" aria-label="Changes to publish" sx={{ p: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, borderColor: "info.main" }}>
          <Typography sx={{ flex: "1 1 240px", minWidth: 0 }}>
            {c.dirty
              ? "Your changes aren't published yet: buyers see them once you publish."
              : "Your shop doesn't show its collections yet. Publish them to show them."}
          </Typography>
          {c.dirty && (
            <Button color="inherit" onClick={() => setConfirmDiscard(true)} disabled={locked} sx={{ minHeight: 44 }}>
              Discard
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => void publish()}
            disabled={locked}
            startIcon={c.preparing ? <CircularProgress size={18} color="inherit" /> : undefined}
            sx={{ minHeight: 44 }}
          >
            Publish
          </Button>
        </Paper>
      )}
      {c.notice && <Alert severity="info">{c.notice}</Alert>}
      <FormError message={c.error} />

      {c.collections.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {/* The list's heading (its rows are h3), styled as the count it is. */}
          <Typography component="h2" sx={{ flex: 1, minWidth: 0, color: "text.secondary", fontSize: "inherit", fontWeight: 400 }}>
            {c.collections.length === 1 ? "1 collection" : `${c.collections.length} collections`}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setEditing({ key: Date.now(), collection: null })}
            disabled={full || locked}
            sx={{ minHeight: 44 }}
          >
            New collection
          </Button>
        </Box>
      )}
      {full && (
        <Typography variant="body2" color="text.secondary">
          A shop can have up to {MAX_COLLECTIONS} collections. Remove one to add another.
        </Typography>
      )}

      {c.collections.length === 0 ? (
        <EmptyState
          icon={<CollectionsBookmarkOutlinedIcon />}
          title="Group your products into collections"
          description="Give a group of products a title, and a picture and a description if you like. It shows as a card at the top of your shop: buyers tap it to see its products."
          actionLabel="New collection"
          onAction={() => setEditing({ key: Date.now(), collection: null })}
        />
      ) : (
        <Box component="ul" aria-label="Collections" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {c.collections.map((col, i) => {
            const n = shownCount(col);
            return (
              <Box
                component="li"
                key={col.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.5,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    aspectRatio: "4 / 3",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "action.hover",
                    color: "text.secondary",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {col.image ? (
                    <Box component="img" src={col.image} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <CollectionsBookmarkOutlinedIcon aria-hidden />
                  )}
                </Box>
                <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                  <Typography component="h3" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>
                    {col.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {n === 1 ? "1 product" : `${n} products`}
                    {n === 0 ? " · buyers don't see it until it has some" : ""}
                  </Typography>
                  {col.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
                    >
                      {col.description}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: "auto" }}>
                  <Tooltip title="Move up">
                    <span>
                      <IconButton
                        ref={ref(col.id, "up")}
                        aria-label={`Move up: ${col.title}`}
                        onClick={() => move(col, i, -1)}
                        disabled={i === 0 || locked}
                        sx={{ width: 44, height: 44 }}
                      >
                        <ArrowUpwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        ref={ref(col.id, "down")}
                        aria-label={`Move down: ${col.title}`}
                        onClick={() => move(col, i, 1)}
                        disabled={i === c.collections.length - 1 || locked}
                        sx={{ width: 44, height: 44 }}
                      >
                        <ArrowDownwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    ref={ref(col.id, "edit")}
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => setEditing({ key: Date.now(), collection: col })}
                    disabled={locked}
                    aria-label={`Edit: ${col.title}`}
                    sx={{ minHeight: 44 }}
                  >
                    Edit
                  </Button>
                  <Tooltip title="Remove">
                    <span>
                      <IconButton
                        ref={ref(col.id, "remove")}
                        aria-label={`Remove: ${col.title}`}
                        onClick={() => remove(col, i)}
                        disabled={locked}
                        sx={{ width: 44, height: 44 }}
                      >
                        <DeleteOutlineOutlinedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
      {/* Moves are said out loud: the rows change places without moving the focus out of them. */}
      <Box role="status" aria-live="polite" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        {announcement}
      </Box>

      <Snackbar
        open={!!removed}
        onClose={(_e, reason) => reason !== "clickaway" && setRemoved(null)}
        autoHideDuration={8000}
        message={removed ? `${removed.collection.title} removed. Publish to remove it from your shop.` : ""}
        sx={{ bottom: { xs: `${bottomChrome + 16}px` } }}
        action={
          <Button
            color="inherit"
            onClick={() => {
              if (removed) {
                c.restore(removed.collection, removed.at);
                setFocusAfter({ id: removed.collection.id, control: "remove" });
              }
              setRemoved(null);
            }}
            sx={{ minHeight: 44 }}
          >
            Undo
          </Button>
        }
      />

      <ResponsiveDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard your changes?"
        maxWidth="xs"
        actions={
          <>
            <Button color="inherit" onClick={() => setConfirmDiscard(false)}>
              Keep them
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirmDiscard(false);
                c.discard();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <Typography>Every change to your collections since you last published them will be lost.</Typography>
      </ResponsiveDialog>

      {editing && (
        <CollectionEditor
          key={editing.key}
          collection={editing.collection}
          onClose={() => setEditing(null)}
          onSave={(col) => {
            c.save(col);
            setEditing(null);
            setFocusAfter({ id: col.id, control: "edit" });
          }}
        />
      )}
      {publishing && c.job && (
        <PublishProductsDialog
          open
          resources={c.job.resources}
          labels={c.job.labels}
          publicKey={publicKey}
          order="given"
          what="collections"
          settledNote="Your shop shows your collections once they're published. Your changes stay here until then."
          onDone={() => {
            c.done();
            setPublishing(false);
          }}
          onClose={(sent) => {
            c.closed(sent);
            setPublishing(false);
          }}
        />
      )}
    </Box>
  );
}
