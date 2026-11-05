/**
 * Finish deleting (seller/pendingDeletes.ts): a product delete took products
 * off the product list, but some catalogues still hold them, so they can
 * still be ordered by their links. This reads those catalogues fresh, takes
 * the products out (qdn/payloads.ts buildRemoveFromCataloguesPublish) and
 * sends them through PublishProductsDialog; the entry goes once they land.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Button, CircularProgress } from "@mui/material";
import type { AppDispatch, RootState } from "../state/store";
import { updateCatalogueHashMap, type Catalogue } from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { emptiedPicturesOf } from "../qdn/productPictures";
import { buildRemoveFromCataloguesPublish, type CatalogueDoc, type PublishResource } from "../qdn/payloads";
import { invalidateQdnJson } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import { clearPendingCatalogues, usePendingDelete } from "./pendingDeletes";
import { noteSentCatalogue } from "./sentCatalogues";
import { DELETE_CATALOGUES_UNREADABLE_TEXT, DELETE_NODE_BEHIND_TEXT, readCataloguesFresh } from "./useDeleteProducts";

interface FinishJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  catalogues: CatalogueDoc[];
  name: string;
  storeId: string;
  /** Every catalogue the entry named: all are cleared once these land. */
  pendingIds: string[];
}

export function FinishDeletesCard() {
  const dispatch = useDispatch<AppDispatch>();
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id);
  const pending = usePendingDelete(name, storeId);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<FinishJob | null>(null);

  if (!pending || !name || !storeId) return null;
  const n = pending.productIds.length;

  const start = async () => {
    setError(null);
    setPreparing(true);
    try {
      const fresh = await readCataloguesFresh(name, pending.catalogueIds);
      if (fresh.behind) return setError(DELETE_NODE_BEHIND_TEXT);
      if (fresh.failed) return setError(DELETE_CATALOGUES_UNREADABLE_TEXT);
      const built = buildRemoveFromCataloguesPublish({ name, productIds: pending.productIds, catalogues: fresh.read });
      // The products' pictures past the third go empty with them (qdn/productPictures.ts).
      const gone = Object.values(fresh.read).flatMap((cat) =>
        pending.productIds.map((id) => cat?.products?.[id] as { id: string; title?: unknown } | undefined).filter((p): p is { id: string; title?: unknown } => !!p && typeof p.id === "string")
      );
      const pictures = emptiedPicturesOf(name, gone);
      if (built.resources.length === 0) {
        // Already clean (another device, or a late answer from Hub).
        clearPendingCatalogues(name, storeId, pending.catalogueIds);
        dispatch(setNotification({ msg: "Your catalogues no longer hold those products.", alertType: "success" }));
        return;
      }
      const labels: Record<string, string> = {};
      built.catalogues.forEach((cat, i) => {
        labels[cat.id] = `Catalogue ${i + 1}`;
      });
      pictures.forEach((r, i) => {
        labels[r.identifier] = `More pictures ${i + 1}`;
      });
      setJob({ ...built, resources: [...built.resources, ...pictures], labels, name, storeId, pendingIds: pending.catalogueIds });
    } catch (e) {
      setError(errorMessage(e, "Couldn't prepare it. Try again."));
    } finally {
      setPreparing(false);
    }
  };

  /** The catalogues that landed are clean: the page follows, and they leave the entry. */
  const landed = (current: FinishJob, sent: Set<string>, all: boolean) => {
    const map: Record<string, Catalogue> = {};
    for (const cat of current.catalogues) {
      if (!sent.has(cat.id)) continue;
      map[cat.id] = { ...cat, user: current.name, isValid: true } as unknown as Catalogue;
      noteSentCatalogue(current.name, cat);
      invalidateQdnJson("DOCUMENT", current.name, cat.id);
    }
    if (Object.keys(map).length > 0) dispatch(updateCatalogueHashMap(map));
    clearPendingCatalogues(current.name, current.storeId, all ? current.pendingIds : [...sent]);
  };

  return (
    <>
      <Alert
        severity="warning"
        action={
          <Button
            color="inherit"
            onClick={() => void start()}
            disabled={preparing}
            startIcon={preparing ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ minHeight: 44, whiteSpace: "nowrap" }}
          >
            Finish deleting
          </Button>
        }
      >
        {n === 1 ? "A product you deleted is" : `${n} products you deleted are`} still in your catalogues, so{" "}
        {n === 1 ? "it" : "they"} can still be ordered by {n === 1 ? "its link" : "their links"}. Finish deleting takes{" "}
        {n === 1 ? "it" : "them"} out (Hub asks you to confirm).
      </Alert>
      <FormError message={error} />
      {job && (
        <PublishProductsDialog
          open
          resources={job.resources}
          labels={job.labels}
          publicKey={publicKey}
          order="given"
          verb="delete"
          settledNote="What didn't go through stays here to finish later."
          onDone={() => {
            landed(job, new Set(job.resources.map((r) => r.identifier)), true);
            dispatch(setNotification({ msg: "Delete finished", alertType: "success" }));
            setJob(null);
          }}
          onClose={(sent) => {
            landed(job, new Set(sent), false);
            setJob(null);
          }}
        />
      )}
    </>
  );
}
