/**
 * The Overview's Recent activity (seller/activity.ts): who ordered, who
 * marked an order delivered, who reviewed the shop and who added it or one
 * of its products to their favourites, newest first, 8 at a time. An order
 * or Delivered opens the order, a review opens it, a favourite product
 * links to the product.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, ButtonBase, Rating, Skeleton, Typography } from "@mui/material";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import type { Order } from "../../state/features/orderSlice";
import { EmptyState } from "../../components/common/EmptyState";
import { NameAvatar } from "../../components/common/NameAvatar";
import { useNow } from "../../hooks/useNow";
import { agoText } from "../../auctions/format";
import { productPath } from "../../qdn/links";
import { isDigitalOrder, itemSummary, orderItems } from "../../orders/format";
import type { ShopReview } from "../Store/reviewsData";
import { useCatalogueLoader } from "../../seller/useCatalogueLoader";
import type { ActivityItem } from "../../seller/activity";
import { ReviewDialog } from "./ShowOrder/ShowOrder";

export const ACTIVITY_PAGE = 8;

function titleOf(product: Record<string, any> | undefined): string {
  return typeof product?.title === "string" ? product.title.trim() : "";
}

export function RecentActivity({
  items,
  loading,
  owner,
  storeId,
  onOpenOrder,
}: {
  items: ActivityItem[];
  /** Nothing to show yet, and still reading. */
  loading: boolean;
  owner: string;
  storeId: string;
  onOpenOrder: (order: Order) => void;
}) {
  const now = useNow(60_000);
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  const [review, setReview] = useState<ShopReview | null>(null);
  const { request, productOf } = useCatalogueLoader(owner);
  const visible = items.slice(0, shown);
  // Favourite products' titles: their catalogues, for the ones on screen.
  const cataloguesKey = [...new Set(visible.flatMap((a) => (a.kind === "favorite" && a.favorite.catalogueId ? [a.favorite.catalogueId] : [])))].join("|");
  useEffect(() => {
    if (cataloguesKey) request(cataloguesKey.split("|"));
  }, [cataloguesKey, request]);

  const rows = useMemo(
    () =>
      visible.map((a) => {
        let icon: ReactNode = null;
        let text: ReactNode = "";
        let detail: ReactNode = null;
        let action: { onClick: () => void } | { to: string } | null = null;
        if (a.kind === "order") {
          icon = <ShoppingBagOutlinedIcon />;
          text = `${a.name} placed an order`;
          const order = a.item.order;
          detail = order ? itemSummary(orderItems(order)) : null;
          if (order) action = { onClick: () => onOpenOrder(order) };
        } else if (a.kind === "delivered") {
          icon = <CheckCircleOutlinedIcon />;
          const order = a.item.order;
          text = order && isDigitalOrder(order) ? `${a.name} marked their order received` : `${a.name} marked their order delivered`;
          detail = order ? itemSummary(orderItems(order)) : null;
          if (order) action = { onClick: () => onOpenOrder(order) };
        } else if (a.kind === "review") {
          icon = <RateReviewOutlinedIcon />;
          text = `${a.name} reviewed your shop`;
          detail = (
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", columnGap: 1 }}>
              <Rating component="span" value={a.review.rating} precision={0.5} readOnly size="small" aria-label={`${a.review.rating} out of 5 stars`} />
              {a.review.title && <span>“{a.review.title}”</span>}
            </Box>
          );
          action = { onClick: () => setReview(a.review) };
        } else if (a.kind === "favorite") {
          icon = <FavoriteBorderOutlinedIcon />;
          const fav = a.favorite;
          if (fav.kind === "shop") {
            text = `${a.name} added your shop to their favourites`;
          } else {
            const title = fav.catalogueId && fav.productId ? titleOf(productOf(fav.catalogueId, fav.productId)) : "";
            text = `${a.name} added ${title || "a product"} to their favourites`;
            if (fav.catalogueId && fav.productId) action = { to: productPath(owner, storeId, fav.productId, fav.catalogueId) };
          }
        }
        return { a, icon, text, detail, action };
      }),
    [visible, onOpenOrder, owner, storeId, productOf]
  );

  if (loading && items.length === 0) {
    return (
      <Box aria-hidden sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={60} />
        ))}
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<NotificationsNoneOutlinedIcon />}
        title="Nothing new yet"
        description="Orders, deliveries, reviews and favourites of your shop and its products show here."
      />
    );
  }

  return (
    <>
      <Box component="ul" aria-label="Recent activity" sx={{ listStyle: "none", m: 0, p: 0, border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
        {rows.map(({ a, icon, text, detail, action }, i) => {
          const ago = a.at ? agoText(a.at, now) : "";
          const body = (
            <>
              <Box component="span" sx={{ position: "relative", flexShrink: 0, display: "flex" }}>
                <NameAvatar name={a.name} size={36} />
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    position: "absolute",
                    right: -4,
                    bottom: -4,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "background.paper",
                    color: "text.secondary",
                    "& svg": { fontSize: 14 },
                  }}
                >
                  {icon}
                </Box>
              </Box>
              <Box component="span" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <Typography component="span" sx={{ fontWeight: 600, overflowWrap: "anywhere", lineHeight: 1.35 }}>
                  {text}
                </Typography>
                {detail && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {detail}
                  </Typography>
                )}
                {/* On phones the time goes under the text, so the text keeps the width. */}
                <Typography component="span" variant="body2" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>
                  {ago}
                </Typography>
              </Box>
              <Typography component="span" variant="body2" color="text.secondary" aria-hidden sx={{ display: { xs: "none", sm: "block" }, flexShrink: 0, whiteSpace: "nowrap" }}>
                {ago}
              </Typography>
            </>
          );
          const sx = {
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 1.5,
            py: 1.25,
            minHeight: 60,
            width: "100%",
            boxSizing: "border-box",
            textAlign: "left",
            justifyContent: "flex-start",
            color: "inherit",
            textDecoration: "none",
          } as const;
          const interactive = {
            ...sx,
            transition: "background-color 150ms ease",
            "&:hover": { bgcolor: "action.hover" },
            "&.Mui-focusVisible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", outlineOffset: -2 },
          };
          return (
            <Box component="li" key={a.key} sx={{ borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}>
              {action && "to" in action ? (
                <ButtonBase component={RouterLink} to={action.to} focusRipple sx={interactive}>
                  {body}
                </ButtonBase>
              ) : action ? (
                <ButtonBase onClick={action.onClick} focusRipple sx={interactive}>
                  {body}
                </ButtonBase>
              ) : (
                <Box sx={sx}>{body}</Box>
              )}
            </Box>
          );
        })}
      </Box>
      {items.length > shown && (
        <Button variant="outlined" color="inherit" onClick={() => setShown((n) => n + ACTIVITY_PAGE)} sx={{ alignSelf: "center", minHeight: 44, mt: 1.5 }}>
          Show more ({items.length - shown} more)
        </Button>
      )}
      {review && <ReviewDialog review={review} title={`${review.name}'s review`} onClose={() => setReview(null)} />}
    </>
  );
}
