/**
 * A delivery price in the Q-Assets the shop takes (delivery/model.ts
 * `assets`), under the price in QORT or the shop's currency (Simon,
 * 2026-10-26: "the field to add q-asset shipping prices or fetch them in
 * various shipping zones"): the first item and each extra item in the
 * asset, typed or filled from the Q-Assets trade portal's price (read from
 * the node). Left empty, the asset's own setting decides (Edit shop →
 * Q-Assets): it converts from QORT, or delivery can't be paid in it.
 */
import { useState } from "react";
import { Box, Button, CircularProgress, InputAdornment, TextField, Typography } from "@mui/material";
import { CoinIcon } from "../components/money/CoinIcon";
import { assetCoinId, type ShopAsset } from "../money/coins";
import { fetchAssetQuote } from "../money/assetRates";
import { formatPrice } from "../money/pricing";
import { assetInfo } from "../qdn/assets";
import { sanitizeAmountInput } from "./productDraft";

export type AssetFeeText = { first: string; extra: string };

/** What an empty field means for this asset. */
function emptyMeans(asset: ShopAsset): string {
  if (asset.price?.from === "market") return "Empty: converts at the trade portal price.";
  if (asset.price?.from === "seller") return `Empty: converts at your rate (1 ${asset.name} = ${formatPrice(asset.price.qort)} QORT).`;
  return `Empty: buyers can't pay this delivery in ${asset.name}.`;
}

/** An amount in the asset: up to 8 decimals, rounded up (whole units for an asset that can't be split). */
function roundUp(value: number, whole: boolean): string {
  if (whole) return String(Math.max(1, Math.ceil(value - 1e-9)));
  const up = Math.ceil(value * 100 - 1e-9) / 100;
  return String(up >= 0.01 ? up : Math.ceil(value * 1e8) / 1e8);
}

export function AssetFeeFields({
  assets,
  value,
  onChange,
  qortFirst,
  qortExtra,
  label,
}: {
  assets: readonly ShopAsset[];
  value: Record<string, AssetFeeText>;
  onChange: (next: Record<string, AssetFeeText>) => void;
  /** The QORT the typed price comes to (first item, each extra), for filling from the portal; null while it isn't a price. */
  qortFirst: number | null;
  qortExtra: number | null;
  /** "Standard", "Express": whose prices these are, for the fields' names. */
  label?: string;
}) {
  const [filling, setFilling] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  if (assets.length === 0) return null;
  const set = (id: number, patch: Partial<AssetFeeText>) => {
    const key = String(id);
    const next = { ...(value[key] ?? { first: "", extra: "" }), ...patch };
    const out = { ...value };
    if (!next.first && !next.extra) delete out[key];
    else out[key] = next;
    onChange(out);
  };
  const fill = async (asset: ShopAsset) => {
    if (qortFirst === null) return setNotes((n) => ({ ...n, [asset.id]: "Type the price above first." }));
    setFilling(asset.id);
    try {
      const [quote, info] = await Promise.all([fetchAssetQuote(asset.id, { fresh: true }), assetInfo({ id: asset.id }).catch(() => null)]);
      if (!quote) return setNotes((n) => ({ ...n, [asset.id]: `${asset.name} has no trades or offers for QORT on the trade portal yet: type its price.` }));
      const whole = info?.isDivisible === false;
      set(asset.id, {
        first: qortFirst > 0 ? roundUp(qortFirst / quote.qort, whole) : "0",
        extra: qortExtra && qortExtra > 0 ? roundUp(qortExtra / quote.qort, whole) : "",
      });
      setNotes((n) => ({ ...n, [asset.id]: `At 1 ${asset.name} ≈ ${formatPrice(quote.qort)} QORT${quote.source === "offer" ? " (lowest offer)" : ""}, rounded up.` }));
    } catch {
      setNotes((n) => ({ ...n, [asset.id]: "Couldn't read the trade portal from your node. Type the price instead." }));
    } finally {
      setFilling(null);
    }
  };
  const field = (asset: ShopAsset) => ({
    htmlInput: { inputMode: "decimal" as const },
    input: { endAdornment: <InputAdornment position="end">{asset.name}</InputAdornment> },
    inputLabel: { shrink: true },
  });
  return (
    <Box component="section" aria-label={`${label ? `${label} in` : "In"} Q-Assets`} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        In Q-Assets (optional)
      </Typography>
      {assets.map((asset) => {
        const text = value[String(asset.id)] ?? { first: "", extra: "" };
        return (
          <Box key={asset.id} sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, borderRadius: 1.5, border: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <CoinIcon coin={assetCoinId(asset.id)} size={20} label={asset.name} />
              <Typography sx={{ fontWeight: 600, flex: "1 1 auto", minWidth: 0, overflowWrap: "anywhere" }}>{asset.name}</Typography>
              <Button size="small" onClick={() => void fill(asset)} disabled={filling !== null} startIcon={filling === asset.id ? <CircularProgress size={14} /> : undefined} sx={{ minHeight: 40 }}>
                Fill from the trade portal
              </Button>
            </Box>
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" } }}>
              <TextField
                size="small"
                label={`First item in ${asset.name}`}
                value={text.first}
                onChange={(e) => set(asset.id, { first: sanitizeAmountInput(e.target.value) })}
                placeholder="—"
                slotProps={field(asset)}
              />
              <TextField
                size="small"
                label={`Each extra item in ${asset.name}`}
                value={text.extra}
                onChange={(e) => set(asset.id, { extra: sanitizeAmountInput(e.target.value) })}
                placeholder="—"
                slotProps={field(asset)}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" role="status">
              {notes[asset.id] ?? (text.first ? "Free from the same amount as above." : emptyMeans(asset))}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
