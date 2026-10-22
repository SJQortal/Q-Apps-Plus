/**
 * The seller's Collections tab (qdn/collections.ts): the shop's collections
 * in the order buyers see them, each with its picture, title, how many of
 * its products are listed, and Edit, Move up, Move down and Remove; New
 * collection opens the editor. Changes stay here until Publish sends them
 * in one publish (the document, and the first time the product list's
 * pointer to it); Discard drops them.
 */
import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Skeleton, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import type { RootState } from "../state/store";
import { EmptyState } from "../components/common/EmptyState";
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

export function CollectionsTab({ ready, loading = false }: { ready: boolean; loading?: boolean }) {
  const c = useCollections();
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const byId = useMemo(() => new Map(rows.map((row) => [row.productId, row])), [rows]);
  const [editing, setEditing] = useState<{ key: number; collection: ShopCollection | null } | null>(null);
  const [publishing, setPublishing] = useState(false);

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

  const publish = async () => {
    if (await c.prepare()) setPublishing(true);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {pending && (
        <Paper variant="outlined" component="section" aria-label="Changes to publish" sx={{ p: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, borderColor: "info.main" }}>
          <Typography sx={{ flex: "1 1 240px", minWidth: 0 }}>
            {c.dirty ? "Your changes aren't published yet: buyers see them once you publish." : "Your shop doesn't show its collections yet. Publish them to show them."}
          </Typography>
          {c.dirty && (
            <Button color="inherit" onClick={c.discard} disabled={c.preparing} sx={{ minHeight: 44 }}>
              Discard
            </Button>
          )}
          <Button
            variant="contained"
            onClick={() => void publish()}
            disabled={c.preparing}
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
            disabled={full}
            sx={{ minHeight: 44 }}
          >
            New collection
          </Button>
        </Box>
      )}
      {full && (
        <Typography variant="body2" color="text.secondary">
          A shop can have {MAX_COLLECTIONS} collections.
        </Typography>
      )}

      {c.collections.length === 0 ? (
        <EmptyState
          icon={<CollectionsBookmarkOutlinedIcon />}
          title="Group your products into collections"
          description="Each collection has a picture and a description, and shows as a card at the top of your shop: buyers tap it to see its products."
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
                      <IconButton aria-label={`Move ${col.title} up`} onClick={() => c.move(col.id, -1)} disabled={i === 0} sx={{ width: 44, height: 44 }}>
                        <ArrowUpwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Move down">
                    <span>
                      <IconButton
                        aria-label={`Move ${col.title} down`}
                        onClick={() => c.move(col.id, 1)}
                        disabled={i === c.collections.length - 1}
                        sx={{ width: 44, height: 44 }}
                      >
                        <ArrowDownwardIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    variant="outlined"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => setEditing({ key: Date.now(), collection: col })}
                    aria-label={`Edit ${col.title}`}
                    sx={{ minHeight: 44 }}
                  >
                    Edit
                  </Button>
                  <Tooltip title="Remove">
                    <IconButton aria-label={`Remove ${col.title}`} onClick={() => c.remove(col.id)} sx={{ width: 44, height: 44 }}>
                      <DeleteOutlineOutlinedIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {editing && (
        <CollectionEditor
          key={editing.key}
          collection={editing.collection}
          onClose={() => setEditing(null)}
          onSave={(col) => {
            c.save(col);
            setEditing(null);
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
