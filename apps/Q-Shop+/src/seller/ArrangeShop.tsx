/**
 * Arrange the shop (Products tab → Arrange): the shop's listed products in
 * the order buyers see as "Featured", which the seller changes and
 * publishes (seller/useProductOrder.ts). The list starts from the order on
 * the product list, with products added since at the end, newest first;
 * "Newest first" drops the order again. Retired products aren't listed (one
 * put back on sale later goes at the end).
 */
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Alert } from "@mui/material";
import type { RootState } from "../state/store";
import { arrangeProducts, productOrderOf } from "../qdn/productOrder";
import { ArrangeDialog } from "./ArrangeDialog";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import type { SellerRow } from "./productList";
import { useProductOrder } from "./useProductOrder";

export function ArrangeShop({ onClose, onPublished }: { onClose: () => void; /** The order landed: the Products list shows it. */ onPublished?: () => void }) {
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const o = useProductOrder();

  const { listed, newest, current } = useMemo(() => {
    const listed = rows.filter((row) => row.status !== "RETIRED");
    const newest = [...listed].sort((a, b) => b.created - a.created).map((row) => row.productId);
    return { listed, newest, current: productOrderOf(dataContainer) };
  }, [rows, dataContainer]);
  const startRows = useMemo(() => {
    const byId = new Map(listed.map((row) => [row.productId, row]));
    return arrangeProducts(current, newest).map((id) => byId.get(id) as SellerRow);
  }, [listed, newest, current]);
  // A product list that changed (say, on another device) starts the arranging again from it.
  const startKey = startRows.map((row) => row.productId).join("\n");

  return (
    <>
      <ArrangeDialog
        key={startKey}
        title="Arrange your shop"
        intro="Buyers see your products in this order: it's the Featured sort, the first on your shop page, and they can still sort by newest or price. Products you add later go at the end until you move them."
        rows={startRows}
        doneLabel="Publish order"
        onDone={(order, reset) => void o.prepare(reset ? [] : order)}
        onClose={onClose}
        onReset={current.length > 0 ? () => newest : undefined}
        resetLabel="Newest first"
        busy={o.preparing || !!o.job}
        footer={
          <>
            {o.notice && <Alert severity="info">{o.notice}</Alert>}
            <FormError message={o.error} />
          </>
        }
      />
      {o.job && (
        <PublishProductsDialog
          open
          resources={o.job.resources}
          labels={o.job.labels}
          publicKey={publicKey}
          order="given"
          what="your shop's order"
          settledNote="Your shop keeps its previous order until this is published."
          onDone={() => {
            o.done();
            onPublished?.();
            onClose();
          }}
          onClose={(sent) => {
            o.closed(sent);
            if (sent.length > 0) {
              onPublished?.();
              onClose();
            }
          }}
        />
      )}
    </>
  );
}
