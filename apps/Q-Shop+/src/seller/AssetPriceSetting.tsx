/**
 * How an accepted Q-Asset prices what has no price in it (money/assetRates.ts):
 * only the seller's own prices (as before), the Q-Assets trade portal's
 * price, read from the node, or the seller's own rate. Converting lets
 * buyers pay everything in the asset, delivery included.
 */
import { useEffect, useState } from "react";
import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import { fetchAssetQuote, MAX_ASSET_QORT, type AssetPricing, type AssetQuote } from "../money/assetRates";
import { formatPrice } from "../money/pricing";
import { selectMenuProps } from "../components/common/menuStyle";
import { agoText } from "../auctions/format";
import { useNow } from "../hooks/useNow";

type Mode = "own" | "market" | "seller";

/** A typed rate: up to 8 decimals, no more than the limit. */
function parseQort(text: string): number | null {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= MAX_ASSET_QORT ? Math.round(n * 1e8) / 1e8 : null;
}

function quoteText(quote: AssetQuote, label: string, now: number): string {
  const where = quote.source === "trade" ? `latest trade${quote.at ? `, ${agoText(quote.at, now)}` : ""}` : "lowest offer, no trades yet";
  return `1 ${label} ≈ ${formatPrice(quote.qort)} QORT on the trade portal (${where}).`;
}

export function AssetPriceSetting({
  assetId,
  label,
  value,
  onChange,
}: {
  assetId: number;
  label: string;
  value: AssetPricing | undefined;
  onChange: (pricing: AssetPricing | undefined) => void;
}) {
  const mode: Mode = value?.from ?? "own";
  const now = useNow(60_000);
  const [typed, setTyped] = useState(value?.from === "seller" ? String(value.qort) : "");
  const [quote, setQuote] = useState<AssetQuote | null | undefined>(undefined);
  const [quoteFailed, setQuoteFailed] = useState(false);
  // The trade portal's price, read once a setting needs it.
  const wantQuote = mode !== "own";
  useEffect(() => {
    if (!wantQuote) return;
    let alive = true;
    fetchAssetQuote(assetId).then(
      (q) => alive && setQuote(q),
      () => alive && setQuoteFailed(true)
    );
    return () => {
      alive = false;
    };
  }, [assetId, wantQuote]);

  // "My own rate" stays chosen while the field is still empty.
  const [picked, setPicked] = useState<Mode>(mode);
  const choose = (next: Mode) => {
    if (next === "own") onChange(undefined);
    else if (next === "market") onChange({ from: "market" });
    else {
      const start = parseQort(typed) ?? quote?.qort ?? null;
      if (start) setTyped(String(start));
      onChange(start ? { from: "seller", qort: start } : undefined);
      if (!start) setTyped("");
    }
    setPicked(next);
  };
  const shown: Mode = picked === "seller" && mode === "own" ? "seller" : mode;
  const badTyped = shown === "seller" && typed.trim() !== "" && parseQort(typed) === null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 1 }}>
      <TextField
        select
        size="small"
        label={`Other prices in ${label}`}
        value={shown}
        onChange={(e) => choose(e.target.value as Mode)}
        slotProps={{ select: { MenuProps: selectMenuProps } }}
        helperText={
          shown === "own"
            ? `Buyers pay in ${label} only for products you give a price in it, without delivery.`
            : `Products without a price in ${label}, and delivery, convert from QORT, so buyers can pay everything in it.`
        }
      >
        <MenuItem value="own">Only the prices I set in {label}</MenuItem>
        <MenuItem value="market">Convert at the trade portal price</MenuItem>
        <MenuItem value="seller">Convert at my own rate</MenuItem>
      </TextField>
      {shown === "seller" && (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
          <TextField
            size="small"
            label={`1 ${label} =`}
            value={typed}
            inputMode="decimal"
            onChange={(e) => {
              setTyped(e.target.value);
              const qort = parseQort(e.target.value);
              onChange(qort ? { from: "seller", qort } : undefined);
            }}
            error={badTyped}
            helperText={badTyped ? "A number of QORT above 0" : undefined}
            slotProps={{ input: { endAdornment: <Typography color="text.secondary">QORT</Typography> } }}
            sx={{ flex: "1 1 180px" }}
          />
          {quote && (
            <Button
              onClick={() => {
                setTyped(String(quote.qort));
                onChange({ from: "seller", qort: quote.qort });
              }}
              sx={{ minHeight: 40 }}
            >
              Use the trade portal&apos;s {formatPrice(quote.qort)}
            </Button>
          )}
        </Box>
      )}
      {shown !== "own" && (
        <Typography variant="body2" color="text.secondary" role="status">
          {quoteFailed
            ? "Couldn't read the trade portal from your node."
            : quote === undefined
              ? "Reading the trade portal…"
              : quote
                ? quoteText(quote, label, now)
                : shown === "market"
                  ? `${label} has no trades or offers for QORT on the trade portal yet: buyers can't pay converted prices in it until it has. Set your own rate instead.`
                  : `${label} has no trades or offers for QORT on the trade portal yet.`}
        </Typography>
      )}
    </Box>
  );
}
