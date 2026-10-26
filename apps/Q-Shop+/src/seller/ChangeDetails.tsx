/**
 * One kind of unpublished change, in words (seller/changeSummary.ts), for
 * the seller page's View changes: the working copy against what's published,
 * read from the session's copies (no new reads unless one is missing).
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Skeleton, Typography } from "@mui/material";
import type { RootState } from "../state/store";
import { fetchDeliveryDoc } from "../delivery/deliveryDoc";
import type { DeliveryDoc } from "../delivery/model";
import { fetchQdnJson } from "../qdn/search";
import { collectionsIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { normalizeCollections, type ShopCollection } from "../qdn/collections";
import { localDiscountSecret } from "../discounts/discountsDoc";
import { draftsOf } from "../discounts/drafts";
import { draftKey } from "./deviceDrafts";
import { deliveryDrafts, discountDrafts } from "./sellerDrafts";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";
import { collectionChanges, deliveryChanges, discountChanges, type NameOf } from "./changeSummary";
import type { ChangeArea } from "./usePendingChanges";
import type { SellerRow } from "./productList";
import { shopAssets } from "../money/coins";

/** More lines than this fold into "and N more". */
const MOST = 14;

function useNameOf(): NameOf {
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const catalogues = useSelector((state: RootState) => state.global.catalogueHashMap);
  const drafts = useSelector((state: RootState) => state.global.productsToSave);
  return (id) => {
    const row = rows.find((r) => r.productId === id);
    const title = (row && catalogues[row.catalogueId]?.products?.[id]?.title) || (drafts[id] as { title?: string } | undefined)?.title;
    return typeof title === "string" && title.trim() ? title.trim() : "a product";
  };
}

/** What's published for a kind, read once (the session's copy when there is one); undefined while it's read. */
function usePublished<T>(read: (() => Promise<T>) | null, key: string): T | undefined | null {
  const [got, setGot] = useState<{ key: string; value: T | null } | null>(null);
  useEffect(() => {
    if (!read) return;
    let alive = true;
    read().then(
      (value) => alive && setGot({ key, value }),
      () => alive && setGot({ key, value: null })
    );
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return got?.key === key ? got.value : undefined;
}

export function ChangeDetails({ area }: { area: Exclude<ChangeArea, "products"> }) {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name || "");
  const signedIn = useSelector((state: RootState) => state.auth.user?.name || "");
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  const shop = useSelector((state: RootState) => state.global.currentStore);
  const nameOf = useNameOf();
  const key = `${area}\n${owner}\n${storeId}`;
  const publishedDelivery = usePublished<DeliveryDoc | null>(area === "delivery" ? () => fetchDeliveryDoc(owner, storeId) : null, key);
  const publishedCollections = usePublished<ShopCollection[]>(
    area === "collections" ? () => fetchQdnJson<unknown>("DOCUMENT", signedIn, collectionsIdentifier(shortStoreIdOf(storeId))).then(normalizeCollections, () => []) : null,
    key
  );

  let lines: string[] | null = null;
  if (area === "delivery") {
    const draft = deliveryDrafts.get(draftKey(owner, storeId));
    if (draft && publishedDelivery !== undefined) lines = deliveryChanges(publishedDelivery, draft, nameOf, (id) => shopAssets(shop).find((a) => String(a.id) === id)?.name || `asset #${id}`);
  } else if (area === "collections") {
    const draft = collectionDrafts.get(collectionsDraftKey(signedIn, storeId));
    if (draft && publishedCollections !== undefined) lines = collectionChanges(publishedCollections ?? [], draft, nameOf);
  } else {
    const draft = discountDrafts.get(draftKey(owner, storeId));
    // The deleted codes' own words come from the seller's list kept on this device.
    if (draft) lines = discountChanges(draftsOf(draft.base, localDiscountSecret(storeId)), draft.drafts, draft.base?.currency ?? "QORT");
  }

  if (lines === null) return <Skeleton width="70%" aria-label="Working out what changed" />;
  if (lines.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing different from what&apos;s published.
      </Typography>
    );
  }
  return (
    <Box component="ul" aria-label="What changed" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {lines.slice(0, MOST).map((line, i) => (
        <Typography component="li" variant="body2" key={i} sx={{ overflowWrap: "anywhere" }}>
          {line}
        </Typography>
      ))}
      {lines.length > MOST && (
        <Typography component="li" variant="body2" color="text.secondary">
          and {lines.length - MOST} more
        </Typography>
      )}
    </Box>
  );
}
