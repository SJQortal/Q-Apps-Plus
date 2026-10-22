/**
 * A strip of the newest products across shops, between the first rows of
 * shop cards. It reads nothing until it scrolls into view (src/discovery/
 * newProducts.ts), scrolls sideways on its own (the page never does), and
 * hides itself when there is nothing new to show.
 */
import { useEffect, useId, useState } from "react";
import { Box, Button, Skeleton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { accentWash } from "../hub-theme";
import { PriceTag } from "../components/money/PriceTag";
import { productPath } from "../qdn/links";
import { loadNewProducts, type NewProduct } from "./newProducts";

const TILE_WIDTH = { phone: 156, wide: 184 } as const;

const Row = styled("ul")(({ theme }) => ({
  listStyle: "none",
  margin: 0,
  padding: "2px 2px 8px",
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: TILE_WIDTH.phone,
  gap: 12,
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  scrollSnapType: "x mandatory",
  [theme.breakpoints.up("sm")]: { gridAutoColumns: TILE_WIDTH.wide, gap: 16 },
}));

const Tile = styled(RouterLink)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  color: theme.palette.text.primary,
  textDecoration: "none",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
  transition: "border-color 160ms ease",
  "@media (hover: hover)": { "&:hover": { borderColor: theme.palette.primary.main } },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

function ProductTile({ item }: { item: NewProduct }) {
  const titleId = useId();
  const detailId = useId();
  const { product } = item;
  const outOfStock = product.status === "OUT_OF_STOCK";
  return (
    <Box component="li" sx={{ scrollSnapAlign: "start", minWidth: 0 }}>
      <Tile
        to={productPath(item.owner, item.storeId, product.id, item.catalogueId)}
        aria-labelledby={titleId}
        aria-describedby={detailId}
      >
        <Box sx={(theme) => ({ position: "relative", aspectRatio: "1 / 1", bgcolor: accentWash(theme, 0.08) })}>
          <Box
            component="img"
            src={item.image}
            alt={product.title}
            decoding="async"
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {outOfStock && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                left: 8,
                bottom: 8,
                px: 1,
                lineHeight: "24px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: "background.paper",
                color: "text.primary",
              }}
            >
              Out of stock
            </Box>
          )}
        </Box>
        <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.5, flex: 1 }}>
          <Typography
            id={titleId}
            component="h3"
            sx={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              overflowWrap: "anywhere",
            }}
          >
            {product.title}
          </Typography>
          <Box id={detailId} sx={{ mt: "auto", display: "flex", flexDirection: "column", gap: 0.25 }}>
            <PriceTag product={product} coin="QORT" rate={null} size="small" />
            <Typography variant="body2" color="text.secondary" noWrap>
              {outOfStock ? `Out of stock · ${item.owner}` : item.owner}
            </Typography>
          </Box>
        </Box>
      </Tile>
    </Box>
  );
}

export function NewProductsStrip({ isListedShop }: { isListedShop: (owner: string, storeId: string) => boolean }) {
  const headingId = useId();
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ run: number; items: NewProduct[] | null }>({ run: -1, items: null });

  useEffect(() => {
    if (!inView) return;
    let alive = true;
    loadNewProducts(isListedShop, { fresh: run > 0 }).then(
      (items) => {
        if (alive) setResult({ run, items });
      },
      () => {
        if (alive) setResult({ run, items: null });
      }
    );
    return () => {
      alive = false;
    };
  }, [inView, run, isListedShop]);

  const settled = result.run === run;
  if (settled && result.items && result.items.length === 0) return null;

  return (
    <Box component="section" ref={ref} aria-labelledby={headingId} sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
      <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
        New products
      </Typography>
      {!settled ? (
        <Box role="status" aria-busy="true" aria-label="Loading new products" sx={{ display: "flex", gap: 1.5, overflow: "hidden" }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Box key={i} sx={{ flex: `0 0 ${TILE_WIDTH.phone}px` }}>
              <Skeleton variant="rounded" sx={{ width: "100%", height: TILE_WIDTH.phone }} />
              <Skeleton variant="text" sx={{ fontSize: 14, mt: 1 }} />
              <Skeleton variant="text" sx={{ fontSize: 14, width: "60%" }} />
            </Box>
          ))}
        </Box>
      ) : result.items === null ? (
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Couldn't load new products.
          </Typography>
          <Button variant="outlined" onClick={() => setRun((n) => n + 1)} sx={{ minHeight: 44 }}>
            Retry
          </Button>
        </Box>
      ) : (
        <Row aria-labelledby={headingId}>
          {result.items.map((item) => (
            <ProductTile key={item.key} item={item} />
          ))}
        </Row>
      )}
    </Box>
  );
}
