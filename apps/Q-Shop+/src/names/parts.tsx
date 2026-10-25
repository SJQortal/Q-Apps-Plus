/**
 * Small parts the Names page and its dialogs share: who sells a name (their
 * primary name, read once a session), what the name comes with (its QDN
 * resources counted, names/content.ts), and an auction's standing from one
 * read of its bids (the dialog follows it live with useAuction).
 */
import { useEffect, useState } from "react";
import { Box, Chip, Skeleton, Typography } from "@mui/material";
import { NameAvatar } from "../components/common/NameAvatar";
import { auctionState, timeLeft, type AuctionState } from "../auctions/rules";
import { serviceLabel, type NameContent } from "./content";
import { primaryNameOf, shortAddress } from "./market";
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

/** "Comes with 1 website · 3 videos" (the most first, `max` of them), or what's known so far. */
export function ContentLine({ content, max = 3 }: { content: NameContent | null | "failed"; max?: number }) {
  if (content === null) return <Skeleton width="70%" aria-label="Reading what it published" />;
  if (content === "failed") return <Typography variant="body2" color="text.secondary">Couldn&apos;t read what it published.</Typography>;
  if (content.total === 0) return <Typography variant="body2" color="text.secondary">Nothing published under it yet.</Typography>;
  const shown = content.services.slice(0, max).map((s) => serviceLabel(s.service, s.count));
  const more = content.services.length - shown.length;
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
      Comes with {shown.join(" · ")}
      {more > 0 ? ` and ${more} more kind${more === 1 ? "" : "s"}` : ""}
      {content.privateCount > 0 ? `${shown.length ? " · " : ""}${content.privateCount} private` : ""}
      {content.capped ? " (300+ in all)" : ""}
    </Typography>
  );
}

/** Every kind of resource the name holds, as chips. */
export function ContentChips({ content }: { content: NameContent }) {
  return (
    <Box component="ul" aria-label="What it published" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
      {content.services.map((s) => (
        <Box component="li" key={s.service}>
          <Chip size="small" variant="outlined" label={serviceLabel(s.service, s.count)} />
        </Box>
      ))}
      {content.privateCount > 0 && (
        <Box component="li">
          <Chip size="small" variant="outlined" label={`${content.privateCount} private (encrypted)`} />
        </Box>
      )}
    </Box>
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
