/**
 * The product form's stock section (stock/model.ts): counting is off by
 * default; on, the seller types the units in stock. An edited product shows
 * what's left (its count minus the orders' notes since), keeps counting when
 * the box is left empty, and counts afresh from a number typed in it. The
 * orders the count includes are listed, each with Don't count (a fake note:
 * anyone can publish an order identifier). Variants type each item's units
 * in its own row instead.
 */
import { Box, Button, FormControlLabel, Switch, TextField, Typography } from "@mui/material";
import { countedOrders, soldSince, stockLeft } from "./model";
import { useStockLeft } from "./notes";
import type { StockFormValues } from "./catalog";

function dateOf(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function StockFields({
  value,
  onChange,
  productId,
  shortStoreId,
  variants,
}: {
  value: StockFormValues;
  onChange: (next: StockFormValues) => void;
  /** The saved product (editing), whose orders count. */
  productId: string | null;
  shortStoreId: string;
  /** It comes in variants: each item's units are typed in its row. */
  variants: boolean;
}) {
  const saved = value.tracked && !variants && productId ? value.saved ?? null : null;
  const counting = useStockLeft(saved && productId ? [{ shortStoreId, productId, stock: { ...saved, voided: undefined } }] : []);
  const notes = counting.notes.get(shortStoreId);
  const voided = value.voided ?? [];
  const sold = saved && productId && notes ? soldSince({ ...saved, voided }, productId, notes) : null;
  const left = saved && sold !== null ? stockLeft(saved, sold) : null;
  const orders = saved && productId && notes ? countedOrders(saved, productId, notes) : [];
  const toggleVoid = (orderUid: string) =>
    onChange({ ...value, voided: voided.includes(orderUid) ? voided.filter((id) => id !== orderUid) : [...voided, orderUid] });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box>
        <FormControlLabel
          control={<Switch checked={value.tracked} onChange={(_, tracked) => onChange({ ...value, tracked })} />}
          label="Count stock"
          sx={{ m: 0, minHeight: 44 }}
        />
        <Typography variant="body2" color="text.secondary">
          {value.tracked
            ? "Each order counts down, and at 0 every buyer sees Sold out. Orders then show publicly how many were bought (not who paid what)."
            : "Off: it stays in stock until you mark it out of stock."}
        </Typography>
      </Box>
      {value.tracked && variants && (
        <Typography variant="body2" color="text.secondary">
          Type each item&apos;s units in its row under Variants.
        </Typography>
      )}
      {value.tracked && !variants && (
        <>
          <TextField
            label="Units in stock"
            value={value.quantity}
            onChange={(e) => onChange({ ...value, quantity: e.target.value.replace(/\D/g, "").slice(0, 7) })}
            placeholder={saved ? (left === null ? "Counting…" : `${left} left now`) : "How many you have"}
            helperText={
              saved
                ? counting.failed && left === null
                  ? "Couldn't read the orders from your node, so what's left isn't known. Leave it empty to keep counting, or type the units you have."
                  : `Counting since ${dateOf(saved.since)} from ${saved.quantity}${sold !== null ? `: ${sold} sold` : ""}. Leave it empty to keep counting; type the units you have to count again from now.`
                : "Every order counts down from this."
            }
            slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" }, inputLabel: { shrink: true } }}
            fullWidth
          />
          {orders.length > 0 && !value.quantity && (
            <Box component="section" aria-label="Orders counted" sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Orders counted
              </Typography>
              <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {orders.map((order) => {
                  const off = voided.includes(order.orderUid);
                  return (
                    <Box component="li" key={order.orderUid} sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere", color: off ? "text.secondary" : "text.primary", textDecoration: off ? "line-through" : "none" }}>
                        {`${order.buyer}: ${order.quantity} · ${dateOf(order.created)}`}
                      </Typography>
                      <Button size="small" color="inherit" variant="outlined" onClick={() => toggleVoid(order.orderUid)} sx={{ minHeight: 44 }} aria-label={`${off ? "Count again" : "Don't count"}: ${order.buyer}'s order of ${order.quantity}`}>
                        {off ? "Count again" : "Don't count"}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Anyone can publish an order: stop counting one you didn&apos;t get. Saving publishes it with the product.
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
