/**
 * Small parts the Names page and its dialogs share: who sells a name (their
 * primary name, read once a session), the link to what its owner published
 * (the explorer), and an auction's standing from one read of its bids (the
 * dialog follows it live with useAuction).
 */
import { useEffect, useState } from "react";
import { Box, Button, Link, Typography } from "@mui/material";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import { NameAvatar } from "../components/common/NameAvatar";
import { auctionState, timeLeft, type AuctionState } from "../auctions/rules";
import { explorerAccountLink, primaryNameOf, shortAddress } from "./market";
import { fetchNameBids, type NameAuction } from "./auctions";

/** The seller's primary name (or their address while it loads, or when they have none). */
export function useSellerName(owner: string, enabled = true): string | null {
  const [found, setFound] = useState<{ owner: string; name: string | null } | null>(null);
  useEffect(() => {
    if (!enabled || !owner) return;
    let alive = true;
    primaryNameOf(owner).then((name) => alive && setFound({ owner, name }));
    return () => {
      alive = false;
    };
  }, [owner, enabled]);
  return found?.owner === owner ? found.name : null;
}

export function SellerLine({ owner, enabled = true }: { owner: string; enabled?: boolean }) {
  const name = useSellerName(owner, enabled);
  return (
    <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
      {name && <NameAvatar name={name} size={20} />}
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        by {name ?? shortAddress(owner)}
      </Box>
    </Typography>
  );
}

/** What an account published, in Q-Mintership+'s explorer (opens in a Hub tab). */
export function ExplorerButton({ address, name }: { address: string; name: string }) {
  return (
    <Button
      component={Link}
      href={explorerAccountLink(address)}
      variant="outlined"
      color="inherit"
      startIcon={<TravelExploreOutlinedIcon />}
      aria-label={`See what it published: ${name}'s owner in the explorer`}
      sx={{ minHeight: 44, alignSelf: "flex-start" }}
    >
      See what it published
    </Button>
  );
}

/** An auction's standing from one read of its bids (cached for the session); null until it's in. */
export function useAuctionGlance(auction: NameAuction | null, now: number, enabled: boolean): AuctionState | null {
  const [bids, setBids] = useState<{ uid: string; bids: Awaited<ReturnType<typeof fetchNameBids>>["bids"] } | null>(null);
  const uid = auction?.uid ?? "";
  const name = auction?.name ?? "";
  useEffect(() => {
    if (!enabled || !uid) return;
    let alive = true;
    fetchNameBids({ uid, name }).then(
      (read) => alive && setBids({ uid, bids: read.bids }),
      () => alive && setBids({ uid, bids: [] })
    );
    return () => {
      alive = false;
    };
  }, [uid, name, enabled]);
  if (!auction || bids?.uid !== auction.uid) return null;
  return auctionState(auction.terms, bids.bids, now, auction.name);
}

/** "Ends in 2d 4h", "Starts in 3h", "Ended". */
export function auctionTimeText(state: Pick<AuctionState, "phase" | "end">, start: number, now: number): string {
  if (state.phase === "upcoming") return `Starts in ${timeLeft(start - now)}`;
  if (state.phase === "live") return `Ends in ${timeLeft(state.end - now)}`;
  return "Ended";
}
