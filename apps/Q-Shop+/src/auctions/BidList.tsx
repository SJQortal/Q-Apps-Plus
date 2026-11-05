/**
 * An auction's bids, newest first, each with its bidder's avatar and name
 * (Simon, 2026-10-25), for product auctions (AuctionPanel.tsx) and name
 * auctions (names/NameDialog.tsx). The viewer's own bid still on its way to
 * the node shows at once, marked so.
 */
import { Box, Typography } from "@mui/material";
import { NameAvatar } from "../components/common/NameAvatar";
import { formatPrice } from "../money/pricing";
import { agoText } from "./format";
import type { Bid } from "./rules";

const qort = (value: number) => `${formatPrice(value)} QORT`;

/** "Ann", with her avatar: who leads, or who bid. */
export function Bidder({ name, you = false, size = 24 }: { name: string; you?: boolean; size?: number }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0, verticalAlign: "middle" }}>
      <NameAvatar name={name} size={size} />
      <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere", fontWeight: you ? 700 : 600 }}>
        {name}
        {you && " (you)"}
      </Box>
    </Box>
  );
}

export function BidList({
  bids,
  now,
  mine,
  pending,
  id,
}: {
  /** Oldest first, as the auction keeps them. */
  bids: readonly Bid[];
  now: number;
  mine: ReadonlySet<string>;
  pending: ReadonlySet<string>;
  id?: string;
}) {
  const newestFirst = [...bids].reverse();
  return (
    <Box id={id} component="ol" aria-label="Bids, newest first" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
      {newestFirst.map((bid, i) => (
        <Box
          component="li"
          key={bid.id}
          sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, py: 0.75, borderTop: i === 0 ? 0 : 1, borderColor: "divider" }}
        >
          <Typography variant="body2" component="div" sx={{ minWidth: 0 }}>
            <Bidder name={bid.bidder} you={mine.has(bid.bidder)} />
          </Typography>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {qort(bid.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pending.has(bid.id) ? "On its way to your node" : agoText(bid.created, now)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
