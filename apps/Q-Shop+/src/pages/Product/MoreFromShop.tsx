/**
 * "More from <shop>" under a product: up to 8 of the shop's other products,
 * in the shop's own order (Featured) then newest, a variant group as one
 * tile, as a strip that scrolls sideways. Their catalogues are read only
 * once the strip nears the screen (most often the product's own, already in).
 */
import { useEffect, useId, useMemo } from "react";
import { Box, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { productRowsFromContainer, type ProductRow } from "../Store/shopData";
import { useCatalogueLoader } from "../../seller/useCatalogueLoader";
import { ProductTile, Row } from "../../discovery/NewProductsStrip";
import { storePath } from "../../qdn/links";

export const MORE_FROM_SHOP = 8;

/** The products to show: listed, not this one or its group, a group once, the shop's order first. */
export function moreFromShopRows(index: unknown, productId: string, group: string | null | undefined): ProductRow[] {
  const doc = index as { products?: unknown; variantGroups?: Record<string, { lead?: unknown }>; productOrder?: unknown } | null | undefined;
  const leads = doc?.variantGroups ?? {};
  const seen = new Set<string>();
  const rows = productRowsFromContainer(doc).filter((row) => {
    if (row.status === "RETIRED" || row.productId === productId) return false;
    if (!row.variant) return true;
    if (group && row.variant.group === group) return false;
    const lead = leads[row.variant.group]?.lead;
    if (typeof lead === "string") return row.productId === lead;
    if (seen.has(row.variant.group)) return false;
    seen.add(row.variant.group);
    return true;
  });
  const order = Array.isArray(doc?.productOrder) ? (doc.productOrder as unknown[]).filter((id): id is string => typeof id === "string") : [];
  const place = new Map(order.map((id, i) => [id, i]));
  return rows
    .sort((a, b) => (place.get(a.productId) ?? Infinity) - (place.get(b.productId) ?? Infinity) || b.created - a.created)
    .slice(0, MORE_FROM_SHOP);
}

export function MoreFromShop({
  owner,
  storeId,
  shopTitle,
  index,
  productId,
  group,
}: {
  owner: string;
  storeId: string;
  shopTitle: string;
  index: unknown;
  productId: string;
  group?: string | null;
}) {
  const headingId = useId();
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "300px 0px" });
  const { request, productOf } = useCatalogueLoader(owner);
  const rows = useMemo(() => moreFromShopRows(index, productId, group), [index, productId, group]);
  const catalogues = [...new Set(rows.map((r) => r.catalogueId))].join("|");
  useEffect(() => {
    if (inView && catalogues) request(catalogues.split("|"));
  }, [inView, catalogues, request]);
  const items = rows.flatMap((row) => {
    const product = productOf(row.catalogueId, row.productId) as (Record<string, unknown> & { id?: string; images?: unknown; mainImageIndex?: unknown; status?: string }) | undefined;
    if (!product || product.status === "RETIRED") return [];
    const images = Array.isArray(product.images) ? (product.images as unknown[]).filter((i): i is string => typeof i === "string") : [];
    const main = typeof product.mainImageIndex === "number" ? product.mainImageIndex : 0;
    return [{ key: `${owner}\n${row.catalogueId}\n${row.productId}`, owner, storeId, catalogueId: row.catalogueId, product: { ...product, id: row.productId } as never, image: images[main] ?? images[0] ?? "" }];
  });
  if (rows.length === 0) return null;
  return (
    <Box component="section" ref={ref} aria-labelledby={headingId} sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0, mt: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700, overflowWrap: "anywhere" }}>
          More from {shopTitle}
        </Typography>
        <Link
          component={RouterLink}
          to={storePath(owner, storeId)}
          underline="hover"
          sx={{ fontSize: 14, fontWeight: 600, minHeight: 44, display: "inline-flex", alignItems: "center", px: 0.5, flexShrink: 0 }}
        >
          See the shop
        </Link>
      </Box>
      {items.length > 0 && (
        <Row aria-labelledby={headingId}>
          {items.map((item) => (
            <ProductTile key={item.key} item={item} />
          ))}
        </Row>
      )}
    </Box>
  );
}
