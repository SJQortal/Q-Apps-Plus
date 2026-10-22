/**
 * A shop's collections on its page (qdn/collections.ts):
 * - CollectionCards: a row of cards (picture, title, how many products) that
 *   scrolls sideways when they don't fit; each is a link that opens the shop
 *   on that collection (`?collection=<id>`), so it can be shared. Collections
 *   with none of the shop's listed products aren't shown.
 * - CollectionHeader: the open collection's picture, title and description
 *   over its products, with All products and Share collection.
 */
import { useId } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, ButtonBase, Skeleton, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import type { ShopCollection } from "../../qdn/collections";
import { collectionLink, collectionPath, storePath } from "../../qdn/links";
import { CopyLinkButton } from "./CopyLinkButton";

const countText = (n: number) => (n === 1 ? "1 product" : `${n} products`);

function Picture({ src, size }: { src?: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size ?? "100%",
        height: size,
        aspectRatio: size ? undefined : "4 / 3",
        flexShrink: 0,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "action.hover",
        color: "text.secondary",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        <Box component="img" src={src} alt="" loading="lazy" decoding="async" sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <CollectionsBookmarkOutlinedIcon sx={{ fontSize: size ? size / 2.5 : 40 }} />
      )}
    </Box>
  );
}

export function CollectionCards({
  owner,
  storeId,
  collections,
  counts,
  selectedId,
  loading = false,
}: {
  owner: string;
  storeId: string;
  collections: ShopCollection[];
  /** Listed products per collection id. */
  counts: Record<string, number>;
  selectedId: string | null;
  loading?: boolean;
}) {
  const headingId = useId();
  const shown = collections.filter((c) => (counts[c.id] ?? 0) > 0);
  if (!loading && shown.length === 0) return null;
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ mt: 3, minWidth: 0 }}>
      <Typography id={headingId} component="h2" sx={{ fontSize: 18, fontWeight: 700, mb: 1.5 }}>
        Collections
      </Typography>
      <Box
        component="ul"
        aria-busy={loading || undefined}
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          pb: 1,
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: { xs: "minmax(136px, 40%)", sm: "176px" },
          gap: 1.5,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          "& > li": { scrollSnapAlign: "start", minWidth: 0 },
        }}
      >
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i}>
                <Skeleton variant="rounded" sx={{ width: "100%", height: "auto", aspectRatio: "4 / 3" }} />
                <Skeleton width="70%" />
              </li>
            ))
          : shown.map((c) => {
              const selected = c.id === selectedId;
              return (
                <li key={c.id}>
                  <ButtonBase
                    component={RouterLink}
                    to={collectionPath(owner, storeId, c.id)}
                    aria-current={selected ? "page" : undefined}
                    sx={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      textAlign: "left",
                      gap: 0.75,
                      p: 1,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: selected ? "primary.main" : "divider",
                      bgcolor: selected ? "action.selected" : "background.paper",
                      "@media (hover: hover)": { "&:hover": { bgcolor: "action.hover" } },
                      "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: 2 },
                    }}
                  >
                    <Picture src={c.image} />
                    <Typography
                      sx={{
                        fontWeight: 700,
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {c.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {countText(counts[c.id] ?? 0)}
                    </Typography>
                  </ButtonBase>
                </li>
              );
            })}
      </Box>
    </Box>
  );
}

export function CollectionHeader({
  owner,
  storeId,
  collection,
  count,
  headingId,
}: {
  owner: string;
  storeId: string;
  collection: ShopCollection;
  count: number;
  /** The products section is labelled by this heading. */
  headingId: string;
}) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 2 }}>
      {collection.image && <Picture src={collection.image} size={88} />}
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography id={headingId} component="h2" sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}>
          {collection.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Collection · {countText(count)}
        </Typography>
        {collection.description && (
          <Typography sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere", mt: 0.5 }}>{collection.description}</Typography>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
          <Button component={RouterLink} to={storePath(owner, storeId)} variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} sx={{ minHeight: 44 }}>
            All products
          </Button>
          <CopyLinkButton link={collectionLink(owner, storeId, collection.id)} label="Share collection" />
        </Box>
      </Box>
    </Box>
  );
}
