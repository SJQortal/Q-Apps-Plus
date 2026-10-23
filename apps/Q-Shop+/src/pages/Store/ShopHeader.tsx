/**
 * The top of a shop page: logo, owner, rating and how many orders it has
 * received (pages/Store/orderCount.ts), where it is and ships to, the coins it takes, and what you can do (message the seller, share, see
 * the details; the owner also edits the shop or opens Manage Shop).
 */
import { Box, Button, Rating, Skeleton, Typography } from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import type { CurrentStore } from "../../state/features/globalSlice";
import { NameAvatar } from "../../components/common/NameAvatar";
import { CoinIcon } from "../../components/money/CoinIcon";
import { coinLabel, shopCoins } from "../../money/coins";
import { mailToLink, storeLink } from "../../qdn/links";
import { CopyLinkButton } from "./CopyLinkButton";
import { roundToHalf } from "./reviewsData";
import type { ShopReviews } from "./useShopData";
import { orderCountLabel, type OrderCount } from "./orderCount";
import { ShippingCountriesButton } from "./ShippingCountries";
import { useLoadedPictures } from "../../components/common/useLoadedPictures";

const panelSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  bgcolor: "background.paper",
  p: { xs: 2, sm: 2.5 },
} as const;

export function ShopHeaderSkeleton() {
  return (
    <Box sx={panelSx} aria-hidden>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Skeleton variant="rounded" sx={{ width: { xs: 64, sm: 88 }, height: { xs: 64, sm: 88 }, flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="40%" />
          <Skeleton width="55%" />
          <Skeleton width="70%" />
        </Box>
      </Box>
      <Skeleton variant="rounded" height={44} sx={{ mt: 2 }} />
    </Box>
  );
}

export function RatingSummaryButton({ reviews, onOpen }: { reviews: ShopReviews; onOpen: () => void }) {
  const { summary, status } = reviews;
  if (status === "loading") return <Skeleton width={140} height={32} />;
  const average = summary.average;
  const label =
    average === null
      ? "No reviews yet"
      : `${average.toFixed(1)} (${summary.count} review${summary.count === 1 ? "" : "s"})`;
  return (
    <Button
      onClick={onOpen}
      color="inherit"
      aria-label={average === null ? "Reviews: none yet" : `Rated ${average.toFixed(1)} out of 5 from ${summary.count} review${summary.count === 1 ? "" : "s"}. Open reviews`}
      sx={{ minHeight: 44, px: 1, ml: -1, gap: 1, fontWeight: 600, textTransform: "none", justifyContent: "flex-start" }}
    >
      {average !== null && <Rating value={roundToHalf(average)} precision={0.5} readOnly size="small" aria-hidden />}
      <span>{label}</span>
    </Button>
  );
}

/**
 * The shop's own description: larger and in the page's main text colour
 * (Simon: "the shops description text could be a bit more clear and nicer
 * and bigger"), whole and across the header's width (Simon: "no read more
 * read less on the shop pages … the text can extend across the screen").
 */
export function ShopDescription({ text }: { text: string }) {
  return (
    <Typography
      sx={{ mt: 2, fontSize: { xs: 16, sm: 17 }, lineHeight: 1.65, color: "text.primary", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
    >
      {text}
    </Typography>
  );
}

export function ShopHeader({
  shop,
  owner,
  storeId,
  isOwner,
  canEdit,
  reviews,
  orderCount,
  onOpenReviews,
  onOpenDetails,
  onEdit,
  onSellerPage,
}: {
  shop: CurrentStore;
  owner: string;
  storeId: string;
  isOwner: boolean;
  /** The owner's current shop is this one (the edit dialog edits the current shop). */
  canEdit: boolean;
  reviews: ShopReviews;
  /** Orders received (null while it loads, or for a shop id another name shares). */
  orderCount?: OrderCount | null;
  onOpenReviews: () => void;
  onOpenDetails: () => void;
  onEdit: () => void;
  onSellerPage: () => void;
}) {
  const coins = shopCoins(shop);
  const orders = orderCount ? orderCountLabel(orderCount) : null;
  const title = shop.title || "Shop";
  const pictures = useLoadedPictures();
  return (
    <Box component="section" aria-label="About this shop" sx={panelSx}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        {shop.logo ? (
          <Box
            component="img"
            src={shop.logo}
            alt={`${title} logo`}
            onLoad={pictures.onLoad(shop.logo)}
            // The whole logo, never cropped to a square: as wide as it is (a wide logo up to the max), square while it
            // loads. Its backdrop goes once it is in, so a transparent background shows the panel.
            sx={{
              height: { xs: 64, sm: 88 },
              width: "auto",
              minWidth: { xs: 64, sm: 88 },
              maxWidth: { xs: 96, sm: 200 },
              borderRadius: 2,
              objectFit: "contain",
              flexShrink: 0,
              bgcolor: pictures.isLoaded(shop.logo) ? "transparent" : "action.hover",
            }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              width: { xs: 64, sm: 88 },
              height: { xs: 64, sm: 88 },
              borderRadius: 2,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              bgcolor: "action.hover",
              color: "text.secondary",
            }}
          >
            <StorefrontOutlinedIcon fontSize="large" />
          </Box>
        )}
        {/* Who and how it's rated on the left; where it is, where it ships and what it takes beside it on wider screens. */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1fr)" },
            columnGap: 4,
            rowGap: 0.75,
            alignItems: "start",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
              <NameAvatar name={owner} size={24} eager />
              <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                  by{" "}
                </Box>
                {owner}
                {isOwner ? (
                  <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                    {" "}
                    (you)
                  </Box>
                ) : null}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5 }}>
              <RatingSummaryButton reviews={reviews} onOpen={onOpenReviews} />
              {orders && (
                <Typography variant="body2" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <ShoppingBagOutlinedIcon fontSize="small" aria-hidden />
                  {orders}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
            {shop.location ? (
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <PlaceOutlinedIcon fontSize="small" aria-hidden />
                <span>{shop.location}</span>
              </Typography>
            ) : null}
            {shop.shipsTo ? (
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <LocalShippingOutlinedIcon fontSize="small" aria-hidden />
                <span>
                  Ships to {shop.shipsTo} <ShippingCountriesButton shop={shop} />
                </span>
              </Typography>
            ) : null}
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" component="span">
                Accepts
              </Typography>
              <Box component="ul" aria-label="Accepted coins" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 1 }}>
                {coins.map((coin) => (
                  <Box
                    component="li"
                    key={coin}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.5,
                      px: 1,
                      py: 0.25,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <CoinIcon coin={coin} size={16} label={coinLabel(coin, shop)} />
                    {coinLabel(coin, shop)}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
      {shop.description ? <ShopDescription text={shop.description} /> : null}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2, "& > *": { flex: { xs: "1 1 auto", sm: "0 0 auto" } } }}>
        {isOwner ? (
          <>
            {/* Named and drawn as the header's Manage Shop, where it leads (Simon, 2026-10-23). */}
            <Button variant="contained" startIcon={<SellOutlinedIcon />} onClick={onSellerPage} sx={{ minHeight: 44 }}>
              Manage Shop
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<EditOutlinedIcon />}
              onClick={onEdit}
              disabled={!canEdit}
              sx={{ minHeight: 44 }}
            >
              Edit shop
            </Button>
          </>
        ) : (
          <Button
            component="a"
            href={mailToLink(owner)}
            className="qortal-link"
            variant="outlined"
            color="inherit"
            startIcon={<EmailOutlinedIcon />}
            sx={{ minHeight: 44 }}
          >
            Message seller
          </Button>
        )}
        <CopyLinkButton link={storeLink(owner, storeId)} label="Share" />
        <Button variant="outlined" color="inherit" startIcon={<InfoOutlinedIcon />} onClick={onOpenDetails} sx={{ minHeight: 44 }}>
          Details
        </Button>
      </Box>
    </Box>
  );
}
