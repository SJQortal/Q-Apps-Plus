/**
 * The cart at a glance: each shop's subtotal in the coin it's paid in, the
 * total per coin, and Check out all when two or more shops can be checked
 * out together (CombinedCheckoutDialog). Shown when the cart holds more than
 * one shop: beside the carts on wide screens, kept in view while they
 * scroll, and above them on narrower ones.
 */
import { useId } from "react";
import { Box, Button, Divider, Paper, Typography } from "@mui/material";
import ShoppingCartCheckoutOutlinedIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import { AmountTag } from "../../components/money/PriceTag";
import { HEADER_OFFSET } from "../../components/layout/Navbar/useHideOnScroll";
import { amountText } from "../../money/pricing";
import { itemCount } from "./cartLines";
import type { CheckoutGate } from "./ShopCart";
import type { ShopPricing } from "./useCartPricing";

/** The total per coin of the shops that can be paid now, in the cart's order of coins. */
export function totalsByCoin(ready: ShopPricing[]): { coin: string; amount: string; shop: ShopPricing["shop"] }[] {
  const totals = new Map<string, { sum: number; shop: ShopPricing["shop"] }>();
  for (const p of ready) {
    if (!p.priced.ok) continue;
    const entry = totals.get(p.coin) ?? { sum: 0, shop: p.shop };
    entry.sum += Number(p.priced.amount);
    totals.set(p.coin, entry);
  }
  return [...totals].map(([coin, { sum, shop }]) => ({ coin, amount: amountText(sum), shop }));
}

export function CartSummary({
  pricing,
  gate,
  sticky = false,
  onCheckoutAll,
  onCheckout,
}: {
  pricing: ShopPricing[];
  gate: CheckoutGate;
  /** Kept in view beside the carts (wide screens). */
  sticky?: boolean;
  onCheckoutAll: (ready: ShopPricing[]) => void;
  onCheckout: (one: ShopPricing) => void;
}) {
  const headingId = useId();
  const ready = pricing.filter((p) => !p.blocked && p.priced.ok);
  const totals = totalsByCoin(ready);
  const items = pricing.reduce((sum, p) => sum + itemCount(Object.values(p.view.cart.orders)), 0);
  const waiting = pricing.filter((p) => p.blocked);

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={headingId}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        ...(sticky && { position: "sticky", top: `calc(${HEADER_OFFSET} + 16px)` }),
      }}
    >
      <Typography id={headingId} component="h2" sx={{ fontSize: 17, fontWeight: 700 }}>
        Summary
      </Typography>
      <Box component="ul" aria-label="Subtotals" sx={{ m: 0, p: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {pricing.map((p) => (
          <Box component="li" key={p.view.key} sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5 }}>
            <Typography variant="body2" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.title}
            </Typography>
            {p.priced.ok ? (
              <AmountTag value={p.priced.amount} coin={p.coin} shop={p.shop} size="small" sx={{ flexShrink: 0 }} />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                —
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      <Divider />
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700 }}>Total</Typography>
          <Typography variant="body2" color="text.secondary">
            {items === 1 ? "1 item" : `${items} items`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.25 }}>
          {totals.length === 0 ? (
            <Typography color="text.secondary">—</Typography>
          ) : (
            totals.map((t) => <AmountTag key={t.coin} value={t.amount} coin={t.coin} shop={t.shop} sx={{ fontSize: 17 }} />)
          )}
        </Box>
      </Box>
      {ready.length >= 2 ? (
        <Button
          variant="contained"
          size="large"
          startIcon={<ShoppingCartCheckoutOutlinedIcon />}
          onClick={() => onCheckoutAll(ready)}
          disabled={!gate.allowed}
          sx={{ minHeight: 48 }}
        >
          Check out all {ready.length} shops
        </Button>
      ) : ready.length === 1 ? (
        <Button variant="contained" size="large" onClick={() => onCheckout(ready[0])} disabled={!gate.allowed} sx={{ minHeight: 48 }}>
          {pricing.length > 1 ? `Check out ${ready[0].title}` : "Check out"}
        </Button>
      ) : null}
      {/* Signed out or without a name: the page and each shop's cart say why. */}
      {gate.allowed && ready.length >= 2 ? (
        <Typography variant="body2" color="text.secondary">
          One review and one address; each shop is paid on its own, in its coin.
        </Typography>
      ) : null}
      {gate.allowed && waiting.length > 0 && ready.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          Not included now: {waiting.map((p) => `${p.title} (${(p.blocked ?? "").replace(/\.$/, "").toLowerCase()})`).join(", ")}.
        </Typography>
      )}
    </Paper>
  );
}
