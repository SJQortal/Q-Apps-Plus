/**
 * Saving the order the seller arranged their shop's products in
 * (qdn/productOrder.ts): one publish of the product list with
 * `productOrder`, under the same rules as every list write:
 * - one list write at a time (seller/listWrite.ts);
 * - the list is read fresh first (seller/freshIndex.ts): a change from
 *   another device is shown and nothing goes out; a list the node answers
 *   for but can't serve, or a node that can't be asked, stops it too (an
 *   order is never worth overwriting products for);
 * - once it lands the page holds the new list, and its own publish isn't
 *   mistaken later for a change from elsewhere.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setDataContainer } from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { dataContainerIdentifier } from "../qdn/identifiers";
import type { DataContainerDoc, PublishResource } from "../qdn/payloads";
import { buildProductOrderPublish } from "../qdn/productOrder";
import { invalidateQdnJson } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { indexKey, notePublishedIndex } from "./productIndex";
import { INDEX_CHANGED_TEXT, INDEX_UNREADABLE_TEXT, PrepareError, indexOnQdn, useShowNewerIndex } from "./freshIndex";
import { LIST_BUSY_TEXT, LIST_CHANGED_TEXT, releaseListWrite, takeListWrite, useListWriteOwner } from "./listWrite";

export interface ProductOrderJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  dataContainer: DataContainerDoc;
  storeId: string;
  name: string;
  baseKey: string;
}

export function useProductOrder() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const lock = useListWriteOwner();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const showNewerIndex = useShowNewerIndex();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<ProductOrderJob | null>(null);

  /** Resolves true when the publish is ready to send (`job`). An empty order is newest first again. */
  const prepare = useCallback(
    async (order: string[]): Promise<boolean> => {
      setError(null);
      setNotice(null);
      if (!name) {
        setError("Sign in with your Qortal name to arrange your shop.");
        return false;
      }
      if (!storeId || !dataContainer?.products || dataContainer.storeId !== storeId) {
        setError("Your shop's product list isn't loaded yet. Try again in a moment.");
        return false;
      }
      if (!takeListWrite(lock)) {
        setError(LIST_BUSY_TEXT);
        return false;
      }
      let handedOver = false;
      setPreparing(true);
      try {
        const seen = dataContainer as unknown as DataContainerDoc;
        const onQdn = await indexOnQdn(name, storeId, seen);
        if (onQdn.kind === "newer") {
          await showNewerIndex(seen, onQdn.merged, storeId, name);
          setNotice(INDEX_CHANGED_TEXT);
          return false;
        }
        if (onQdn.kind === "unknown") throw new PrepareError(INDEX_UNREADABLE_TEXT);
        if (store.getState().global.dataContainer !== dataContainer) throw new PrepareError(LIST_CHANGED_TEXT);
        const built = buildProductOrderPublish({ name, storeId, dataContainer: seen, order });
        setJob({
          resources: built.resources,
          labels: { [built.resources[0].identifier]: order.length > 0 ? "Product list (your order)" : "Product list (newest first)" },
          dataContainer: built.dataContainer,
          storeId,
          name,
          baseKey: indexKey(seen),
        });
        handedOver = true;
        return true;
      } catch (e) {
        setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
        return false;
      } finally {
        setPreparing(false);
        if (!handedOver) releaseListWrite(lock);
      }
    },
    [name, storeId, dataContainer, lock, showNewerIndex, store]
  );

  const apply = useCallback(
    (current: ProductOrderJob) => {
      const listId = dataContainerIdentifier(current.storeId);
      notePublishedIndex(current.storeId, current.baseKey, indexKey(current.dataContainer));
      dispatch(setDataContainer({ ...current.dataContainer, id: listId }));
      invalidateQdnJson("DOCUMENT", current.name, listId);
    },
    [dispatch]
  );

  /** It landed. */
  const done = useCallback(() => {
    if (!job) return;
    apply(job);
    dispatch(setNotification({ msg: "Your shop's order is published", alertType: "success" }));
    setJob(null);
    releaseListWrite(lock);
  }, [job, apply, dispatch, lock]);

  /** Closed: if the list landed anyway, the page follows it. */
  const closed = useCallback(
    (sent: string[]) => {
      if (job && sent.length > 0) apply(job);
      setJob(null);
      releaseListWrite(lock);
    },
    [job, apply, lock]
  );

  return { prepare, preparing, error, notice, job, done, closed };
}
