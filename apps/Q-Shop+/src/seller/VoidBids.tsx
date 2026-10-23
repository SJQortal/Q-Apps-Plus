/**
 * In an auction's edit form: the bids that count, newest first, each of
 * which the seller can void (an absurd bid, or a winner who didn't pay).
 * Voided bids stop counting once the product is published again, so the next
 * bid can win; bidders see that the seller voided them.
 */
import { useEffect, useState } from "react";
import { Alert, Box, Checkbox, CircularProgress, FormControlLabel, Typography } from "@mui/material";
import { fetchBids } from "../auctions/bids";
import { auctionState, type AuctionTerms, type Bid } from "../auctions/rules";
import { formatPrice } from "../money/pricing";

type Load = { key: string; status: "loading" | "ready" | "failed"; bids: Bid[] };

export function VoidBids({
  productId,
  seller,
  terms,
  voided,
  onChange,
}: {
  productId: string;
  seller: string;
  /** The auction as published. */
  terms: AuctionTerms;
  voided: string[];
  onChange: (voided: string[]) => void;
}) {
  const key = `${seller}\n${productId}`;
  const [load, setLoad] = useState<Load>({ key: "", status: "loading", bids: [] });
  useEffect(() => {
    let alive = true;
    fetchBids(productId, seller, { fresh: true }).then(
      ({ bids }) => alive && setLoad({ key, status: "ready", bids }),
      () => alive && setLoad({ key, status: "failed", bids: [] })
    );
    return () => {
      alive = false;
    };
  }, [key, productId, seller]);
  const current = load.key === key ? load : { key, status: "loading" as const, bids: [] };

  if (current.status === "loading") {
    return (
      <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={16} aria-hidden />
        <Typography variant="body2">Reading the bids…</Typography>
      </Box>
    );
  }
  if (current.status === "failed") return <Alert severity="warning">The bids couldn&apos;t be read from your node, so none can be voided right now.</Alert>;

  // Every bid that would count with nothing voided, and the ones voided already.
  const counting = auctionState({ ...terms, voided: [] }, current.bids, Number.MAX_SAFE_INTEGER, seller).accepted;
  const listed = [...counting, ...current.bids.filter((b) => voided.includes(b.id) && !counting.includes(b))].sort((a, b) => b.created - a.created);
  if (listed.length === 0) return <Typography variant="body2" color="text.secondary">No bids yet.</Typography>;
  const toggle = (id: string, on: boolean) => onChange(on ? [...voided, id] : voided.filter((v) => v !== id));
  return (
    <Box component="section" aria-labelledby="void-bids-heading" sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography id="void-bids-heading" variant="body2" sx={{ fontWeight: 700 }}>
        Bids
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Void a bid that isn&apos;t real (an absurd amount, say) or a winner&apos;s who didn&apos;t pay: it stops counting once you publish, and the next bid can win.
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
        {listed.map((bid) => (
          <Box component="li" key={bid.id}>
            <FormControlLabel
              control={<Checkbox checked={voided.includes(bid.id)} onChange={(e) => toggle(bid.id, e.target.checked)} />}
              label={`Void: ${bid.bidder}, ${formatPrice(bid.amount)} QORT, ${new Date(bid.created).toLocaleString()}`}
              sx={{ minHeight: 44, mr: 0, "& .MuiFormControlLabel-label": { overflowWrap: "anywhere" } }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
