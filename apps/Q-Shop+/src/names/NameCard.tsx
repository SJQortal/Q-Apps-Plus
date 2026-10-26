/**
 * One name for sale on the Names page: its avatar and name, who sells it,
 * and its price or its auction's standing, with Buy or Bid. Who sells it and
 * the auction's bids are read only once the card is on screen; what it comes
 * with is the dialog's link to the explorer.
 */
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import { useInView } from "react-intersection-observer";
import { NameAvatar } from "../components/common/NameAvatar";
import { AmountTag } from "../components/money/PriceTag";
import { auctionTimeText, CopyNameButton, SellerLine, useAuctionGlance } from "./parts";
import type { MarketItem } from "./useNamesMarket";
import type { PendingName } from "./actions";

export function NameCard({
  item,
  now,
  mine,
  pending,
  onOpen,
}: {
  item: MarketItem;
  now: number;
  /** The viewer's own name (sold from their account). */
  mine: boolean;
  /** A transaction of the viewer's on it, waiting for the next block. */
  pending: PendingName | undefined;
  onOpen: (item: MarketItem) => void;
}) {
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "300px 0px", fallbackInView: true });
  const glance = useAuctionGlance(item.auction, now, inView);
  const auction = item.auction;
  const label = mine ? "Manage" : pending ? "Waiting for the next block…" : auction ? (glance?.phase === "ended" ? "See result" : "Bid") : "Buy";

  return (
    <Paper
      ref={ref}
      component="article"
      variant="outlined"
      aria-label={item.name}
      sx={{ p: 2, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1.5, height: "100%", boxSizing: "border-box", minWidth: 0 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <NameAvatar name={item.name} size={56} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.25, minWidth: 0 }}>
            <Typography component="h3" sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.3, overflowWrap: "anywhere", minWidth: 0 }}>
              {item.name}
            </Typography>
            <CopyNameButton name={item.name} />
          </Box>
          {mine ? (
            <Typography variant="body2" color="text.secondary">
              Yours
            </Typography>
          ) : (
            <SellerLine owner={item.owner} enabled={inView} />
          )}
        </Box>
      </Box>
      <Box sx={{ mt: "auto", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
        {auction ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0, flex: "1 1 auto" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Chip size="small" variant="outlined" icon={<GavelOutlinedIcon />} label="Auction" />
              <AmountTag value={glance?.high?.amount ?? auction.terms.startingBid} coin="QORT" size="small" />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {glance?.high ? "Leading bid" : "Starting bid"} · {auctionTimeText(glance ?? { phase: now < auction.terms.start ? "upcoming" : now < auction.terms.end ? "live" : "ended", end: auction.terms.end }, auction.terms.start, now)}
            </Typography>
          </Box>
        ) : (
          // As wide as the price, so a long one sends the button to the next line.
          <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
            <AmountTag value={item.price} coin="QORT" />
          </Box>
        )}
        <Button
          variant={mine || pending ? "outlined" : "contained"}
          color={mine || pending ? "inherit" : "primary"}
          onClick={() => onOpen(item)}
          aria-label={`${label}: ${item.name}`}
          sx={{ minHeight: 44, flexShrink: 0, ml: "auto" }}
        >
          {label}
        </Button>
      </Box>
    </Paper>
  );
}
