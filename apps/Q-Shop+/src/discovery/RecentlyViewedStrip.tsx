/**
 * Recently viewed (recentlyViewed.ts) at the top of the Products page: the
 * products opened lately, as the New products strip's tiles. Their
 * catalogues are read when the strip shows (cached; most were just read on
 * their own pages), and one the node can't serve, or that its shop dropped,
 * is left out.
 */
import { useEffect, useId, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { fetchQdnJson } from "../qdn/search";
import { ProductTile, Row } from "./NewProductsStrip";
import { clearRecentlyViewed, useRecentlyViewed, type ViewedProduct } from "./recentlyViewed";
import type { NewProduct } from "./newProducts";

type Catalogue = { products?: Record<string, Record<string, unknown>> } | null;

export function RecentlyViewedStrip() {
  const headingId = useId();
  const viewed = useRecentlyViewed();
  const [catalogues, setCatalogues] = useState<Record<string, Catalogue>>({});
  const wanted = [...new Set(viewed.map((v) => `${v.owner}\n${v.catalogueId}`))].filter((key) => !(key in catalogues)).join("|");
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    for (const key of wanted.split("|")) {
      const [owner, catalogueId] = key.split("\n");
      fetchQdnJson<Catalogue>("DOCUMENT", owner, catalogueId).then(
        (catalogue) => alive && setCatalogues((prev) => ({ ...prev, [key]: catalogue })),
        () => alive && setCatalogues((prev) => ({ ...prev, [key]: null }))
      );
    }
    return () => {
      alive = false;
    };
  }, [wanted]);
  const items: NewProduct[] = viewed.flatMap((v: ViewedProduct) => {
    const product = catalogues[`${v.owner}\n${v.catalogueId}`]?.products?.[v.productId];
    if (!product || typeof product.title !== "string" || product.status === "RETIRED") return [];
    const images = Array.isArray(product.images) ? (product.images as unknown[]).filter((i): i is string => typeof i === "string") : [];
    const main = typeof product.mainImageIndex === "number" ? product.mainImageIndex : 0;
    return [{ key: `${v.owner}\n${v.catalogueId}\n${v.productId}`, owner: v.owner, storeId: v.storeId, catalogueId: v.catalogueId, product: { ...product, id: v.productId } as never, image: images[main] ?? images[0] ?? "" }];
  });
  if (items.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Recently viewed
        </Typography>
        <Button color="inherit" onClick={clearRecentlyViewed} sx={{ minHeight: 44 }}>
          Clear
        </Button>
      </Box>
      <Row aria-labelledby={headingId}>
        {items.map((item) => (
          <ProductTile key={item.key} item={item} />
        ))}
      </Row>
    </Box>
  );
}
