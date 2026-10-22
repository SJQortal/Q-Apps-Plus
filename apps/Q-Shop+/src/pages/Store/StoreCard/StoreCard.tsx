/**
 * A shop on the home page. The whole card is one real link to the shop
 * (named by its title), with a separate "More" button for Open shop and Copy
 * link. Title, description and owner come from the search row at once; the
 * shop's JSON (logo and coins) is read only when the card nears the screen
 * (docs/QORTAL.md → Efficiency rules 6), with "Fetching from peers…" while the
 * node gets it and a plain placeholder, never an endless skeleton, if it
 * can't.
 */
import { memo, useEffect, useId, type MouseEvent } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import { Link as RouterLink } from "react-router-dom";
import { useInView } from "react-intersection-observer";
import { useDispatch, useSelector } from "react-redux";
import { accentWash, primarySoft } from "../../../hub-theme";
import { NameAvatar } from "../../../components/common/NameAvatar";
import { CoinIcon } from "../../../components/money/CoinIcon";
import { coinLabel, shopCoins, type CoinId } from "../../../money/coins";
import { storePath } from "../../../qdn/links";
import { addToHashMapStores } from "../../../state/features/storeSlice";
import type { RootState } from "../../../state/store";
import { LANDSCAPE_PHONE_MEDIA, PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { requestShopDetails, useShopDetails, type ShopDetails, type ShopJson } from "../../../discovery/shopDetails";
import type { ShopEntry } from "../../../discovery/shopIndex";
import { formatRating, type ShopRating } from "../../../discovery/ratings";
import { CARD_ART_HEIGHT } from "../../../discovery/ShopGrid";
import { visuallyHidden } from "../../../discovery/a11y";

/** Coin marks shown before "+N". */
const MAX_COINS = 5;

export interface StoreCardProps {
  shop: ShopEntry;
  /** The signed-in name owns it: a "Yours" badge. */
  mine: boolean;
  /** undefined while the ratings aren't loaded; null when nobody but the owner has reviewed it. */
  rating?: ShopRating | null;
  /** A plain click on the card (before the router navigates). */
  onOpen: (shop: ShopEntry) => void;
  onMenu: (shop: ShopEntry, anchor: HTMLElement) => void;
}

const CardLink = styled(RouterLink)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  color: theme.palette.text.primary,
  textDecoration: "none",
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
  transition: "border-color 160ms ease, box-shadow 160ms ease",
  "@media (hover: hover)": {
    "&:hover": { borderColor: theme.palette.primary.main, boxShadow: theme.shadows[3] },
  },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const Art = styled("div")(({ theme }) => ({
  position: "relative",
  flexShrink: 0,
  height: CARD_ART_HEIGHT.phone,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 12px",
  textAlign: "center",
  backgroundColor: accentWash(theme, 0.08),
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up("sm")]: { height: CARD_ART_HEIGHT.wide },
  // Last, so it wins over the width rule on a phone held sideways.
  [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { height: CARD_ART_HEIGHT.landscape },
}));

const Logo = styled("img")({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",
  padding: 12,
  boxSizing: "border-box",
  display: "block",
});

const Initial = styled("span")(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: 700,
  backgroundColor: primarySoft(theme),
  color: theme.palette.primary.main,
  [`@media ${LANDSCAPE_PHONE_MEDIA}`]: { width: 44, height: 44, fontSize: 20 },
}));

const clamp = (lines: number) =>
  ({
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    overflowWrap: "anywhere",
  }) as const;

/** Only images carried inside the JSON: a web address would be a request outside Qortal. */
function logoOf(details: ShopDetails | undefined): string | undefined {
  if (details?.status !== "ready" || !details.valid) return undefined;
  const logo = details.shop.logo;
  return typeof logo === "string" && logo.startsWith("data:image/") ? logo : undefined;
}

function coinsOf(shop: ShopEntry, json: ShopJson | null): { coins: CoinId[]; labels: string[] } {
  const coins: CoinId[] = json ? shopCoins(json) : shop.acceptsArrr ? ["QORT", "ARRR"] : ["QORT"];
  return { coins, labels: coins.map((coin) => coinLabel(coin, json)) };
}

function CardArt({ shop, details }: { shop: ShopEntry; details: ShopDetails | undefined }) {
  const logo = logoOf(details);
  if (logo) return <Logo src={logo} alt={shop.title} decoding="async" />;
  const caption =
    details?.status === "retrying"
      ? "Fetching from peers…"
      : details?.status === "failed" && details.final
        ? "Logo not available right now"
        : null;
  return (
    <>
      <Initial aria-hidden>{Array.from(shop.title.trim())[0]?.toUpperCase() ?? "?"}</Initial>
      {caption && (
        <Typography variant="body2" color="text.secondary">
          {caption}
        </Typography>
      )}
    </>
  );
}

function StoreCardView({ shop, mine, rating, onOpen, onMenu }: StoreCardProps) {
  const dispatch = useDispatch();
  const titleId = useId();
  const descriptionId = useId();
  const summaryId = useId();
  const details = useShopDetails(shop.key);
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px 0px" });

  useEffect(() => {
    if (inView) void requestShopDetails(shop.owner, shop.id);
  }, [inView, shop.owner, shop.id]);

  const json = details?.status === "ready" && details.valid ? details.shop : null;

  // The cart and the header's shop menu read titles from hashMapStores, as
  // the original's home page filled it. Only when the id is new there: two
  // owners can share a shop id, and must not overwrite each other in turn.
  const known = useSelector((state: RootState) => Boolean(state.store.hashMapStores[shop.id]));
  useEffect(() => {
    if (!json || known) return;
    dispatch(
      addToHashMapStores({
        title: shop.title,
        description: shop.description,
        created: shop.created,
        updated: shop.updated,
        tags: [],
        ...json,
        owner: shop.owner,
        id: shop.id,
        isValid: true,
      })
    );
  }, [json, known, dispatch, shop]);

  const { coins, labels } = coinsOf(shop, json);
  const shownCoins = coins.slice(0, MAX_COINS);
  const moreCoins = coins.length - shownCoins.length;
  const summary = [
    `By ${shop.owner}.`,
    rating ? `Rated ${formatRating(rating.average)} out of 5 from ${rating.count} ${rating.count === 1 ? "review" : "reviews"}.` : "",
    `Pays in ${labels.join(", ")}.`,
    mine ? "Your shop." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window leaves this page as it is.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    onOpen(shop);
  };

  return (
    <Box component="li" ref={ref} data-shop-card sx={{ position: "relative", minWidth: 0 }}>
      <CardLink
        to={storePath(shop.owner, shop.id)}
        onClick={follow}
        aria-labelledby={titleId}
        aria-describedby={shop.description ? `${descriptionId} ${summaryId}` : summaryId}
      >
        <Art>
          <CardArt shop={shop} details={details} />
          {mine && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                px: 1,
                lineHeight: "24px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                bgcolor: "primary.main",
                color: "primary.contrastText",
              }}
            >
              Yours
            </Box>
          )}
        </Art>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, p: 1.5, flex: 1, minWidth: 0 }}>
          <Typography id={titleId} component="h2" sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, ...clamp(2) }}>
            {shop.title}
          </Typography>
          {shop.description && (
            <Typography id={descriptionId} variant="body2" color="text.secondary" sx={{ lineHeight: 1.45, ...clamp(2) }}>
              {shop.description}
            </Typography>
          )}
          <Box aria-hidden sx={{ mt: "auto", pt: 1, display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0, flex: 1 }}>
              <NameAvatar name={shop.owner} size={22} />
              <Typography variant="body2" color="text.secondary" noWrap>
                {shop.owner}
              </Typography>
            </Box>
            {rating && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
                <StarRoundedIcon sx={{ fontSize: 18, color: "warning.main" }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatRating(rating.average)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ({rating.count})
                </Typography>
              </Box>
            )}
          </Box>
          <Box aria-hidden sx={{ display: "flex", alignItems: "center", gap: 0.75, minHeight: 20 }}>
            {shownCoins.map((coin, i) => (
              <CoinIcon key={coin} coin={coin} size={18} label={labels[i]} />
            ))}
            {moreCoins > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                +{moreCoins}
              </Typography>
            )}
          </Box>
          <Box component="span" id={summaryId} sx={visuallyHidden}>
            {summary}
          </Box>
        </Box>
      </CardLink>
      <IconButton
        aria-label={`More for ${shop.title}`}
        aria-haspopup="menu"
        onClick={(event) => onMenu(shop, event.currentTarget)}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 36,
          height: 36,
          color: "text.primary",
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          "&:hover": { bgcolor: "background.paper", borderColor: "text.secondary" },
          "&:focus-visible": { outline: (theme) => `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
          [`@media ${PHONE_MEDIA}`]: { width: 44, height: 44, top: 4, right: 4 },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export const StoreCard = memo(StoreCardView);
