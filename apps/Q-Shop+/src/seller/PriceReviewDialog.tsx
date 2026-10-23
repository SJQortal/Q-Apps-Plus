/**
 * "Publish new prices?": what a prices publish changes (money/fiatPricing.ts
 * priceChanges), old → new, biggest move first, with a warning when a price
 * moves by more than half (a rate typed as 1.8 for 0.18). Shop tab → Prices
 * and the header's QORT rate both ask through it before anything is sent.
 */
import { Alert, Box, Button, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { rateToText, type FiatRates, type PriceChange } from "../money/fiatPricing";
import { formatPrice } from "../money/pricing";

/** The coin prices stay as they are (only `fiatPrice` changes). */
export function sameCoinPrices(c: PriceChange): boolean {
  return c.before.qort === c.after.qort && c.before.arrr === c.after.arrr;
}

/** How far the QORT price moves, as a share of the old one (1 = doubles or halves… or more). */
export function priceMove(c: PriceChange): number {
  const { qort: a } = c.before;
  const { qort: b } = c.after;
  if (!a || !b) return 0;
  return Math.abs(b - a) / a;
}

/** Above this share a price change is called out before publishing. */
export const BIG_PRICE_MOVE = 0.5;

/** "1.50 → 2.00 QORT", "ARRR 0.25 → none (node's rate)". */
function moveText(before: number | undefined, after: number | undefined, coin: string): string | null {
  if (before === after) return null;
  const fmt = (v: number | undefined) => (v === undefined ? (coin === "ARRR" ? "the node's rate" : "none") : `${formatPrice(v)} ${coin}`);
  return `${fmt(before)} → ${fmt(after)}`;
}

export interface PriceReview {
  pricing: { currency: string; rates: FiatRates };
  changes: PriceChange[];
}

export function PriceReviewDialog({
  review,
  titleOf,
  onBack,
  onPublish,
}: {
  review: PriceReview;
  /** A product's title, for the list. */
  titleOf: (productId: string) => string;
  onBack: () => void;
  onPublish: () => void;
}) {
  const moved = review.changes.filter((c) => !sameCoinPrices(c)).sort((a, b) => priceMove(b) - priceMove(a));
  const big = moved.filter((c) => priceMove(c) > BIG_PRICE_MOVE).length;
  const shown = moved.slice(0, 8);
  return (
    <ResponsiveDialog
      open
      onClose={onBack}
      title="Publish new prices?"
      maxWidth="sm"
      actions={
        <>
          <Button color="inherit" onClick={onBack}>
            Back
          </Button>
          <Button variant="contained" onClick={onPublish}>
            Publish
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography>
          {moved.length === 1 ? "1 product gets a new price" : `${moved.length} products get new prices`}, at 1 QORT ={" "}
          {rateToText(review.pricing.rates.QORT)} {review.pricing.currency}
          {review.pricing.rates.ARRR ? ` and 1 ARRR = ${rateToText(review.pricing.rates.ARRR)} ${review.pricing.currency}` : ""}.
        </Typography>
        {big > 0 && (
          <Alert severity="warning">
            {big === 1 ? "1 price changes" : `${big} prices change`} by more than half. Check your rates before publishing.
          </Alert>
        )}
        <Box component="ul" aria-label="Price changes" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {shown.map((c) => (
            <Box component="li" key={c.productId} sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{titleOf(c.productId)}</Typography>
              {[moveText(c.before.qort, c.after.qort, "QORT"), moveText(c.before.arrr, c.after.arrr, "ARRR")]
                .filter(Boolean)
                .map((line) => (
                  <Typography key={line} variant="body2" color="text.secondary">
                    {line}
                  </Typography>
                ))}
            </Box>
          ))}
        </Box>
        {moved.length > shown.length && (
          <Typography variant="body2" color="text.secondary">
            {`and ${moved.length - shown.length} more`}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}
