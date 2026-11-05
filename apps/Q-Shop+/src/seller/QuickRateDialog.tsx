/**
 * The header's QORT rate (Simon, 2026-10-23: "if user has the USD or other
 * currency prices set up, please next to Manage Shop make a field to quickly
 * adjust the QORT price to USD"): one field, 1 QORT in the shop's currency.
 * Every product priced in the currency gets the QORT price the new rate
 * gives, through the same publish as Shop tab → Prices (seller/
 * useShopPricing.ts): every catalogue read first, the changes listed old →
 * new before anything is sent, then the catalogues that change and the
 * product list. The ARRR rate and everything else stay as they are.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Alert, Box, Button, CircularProgress, InputAdornment, TextField, Typography } from "@mui/material";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { shopCoins } from "../money/coins";
import {
  RATE_DECIMALS,
  coinPriceFromFiat,
  fiatPriceOf,
  fiatPricingOf,
  fiatToText,
  parseFiat,
  priceChanges,
  rateToText,
  sanitizeFiatInput,
} from "../money/fiatPricing";
import { sellerPath } from "../components/layout/shellState";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import { PriceReviewDialog, sameCoinPrices, type PriceReview } from "./PriceReviewDialog";
import type { SellerRow } from "./productList";
import { draftsOfShop } from "./shopDrafts";
import { usePricingCatalogues } from "./usePricingCatalogues";
import { PRICES_DRAFTS_TEXT, useShopPricing } from "./useShopPricing";

const titleOf = (details: Record<string, unknown> | undefined) => (typeof details?.title === "string" ? details.title.trim() : "");

export function QuickRateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const allDrafts = useSelector((state: RootState) => state.global.productsToSave);
  const owner = currentStore?.owner || "";
  const current = useMemo(() => fiatPricingOf(dataContainer), [dataContainer]);
  const takesArrr = shopCoins(currentStore).includes("ARRR");
  const p = useShopPricing();
  const { details, loading, blocking, missingProducts, retryBlocking, read, total } = usePricingCatalogues(rows, owner);
  const [rate, setRate] = useState(rateToText(current?.rates.QORT));
  const [formError, setFormError] = useState<string | null>(null);
  const [review, setReview] = useState<PriceReview | null>(null);

  const currency = current?.currency ?? "";
  const q = parseFiat(rate, RATE_DECIMALS);
  const changed = !!current && rate.trim() !== rateToText(current.rates.QORT);
  // The products that follow the currency: their QORT prices come from the rate.
  const followers = rows.flatMap((row) => {
    const d = details(row) as Record<string, unknown> | undefined;
    const fiat = fiatPriceOf(d, currency);
    return d && fiat ? [{ row, product: d, value: fiat.value }] : [];
  });
  const sample = followers[0];
  const busy = p.preparing || !!p.job;

  const send = async (next: PriceReview) => {
    setReview(null);
    await p.prepare({ pricing: next.pricing, prices: Object.fromEntries(next.changes.map((c) => [c.productId, c.value])) });
  };

  const update = async () => {
    setFormError(null);
    if (!current || busy || loading || blocking.length > 0 || !changed) return;
    if (Number.isNaN(q)) return setFormError(`Type how much one QORT is worth in ${currency}: a number above 0.`);
    if (currentStore?.id && Object.keys(draftsOfShop(allDrafts, currentStore.id)).length > 0) return setFormError(PRICES_DRAFTS_TEXT);
    const pricing = { currency, rates: { ...current.rates, QORT: q } };
    const changes = priceChanges(
      followers.map((f) => ({ productId: f.row.productId, product: f.product, value: f.value })),
      pricing,
      takesArrr
    );
    // Prices that move are listed first; a rate that moves none (no product follows it yet) is just saved.
    if (changes.some((c) => !sameCoinPrices(c))) setReview({ pricing, changes });
    else await send({ pricing, changes });
  };

  if (!current) return null;

  return (
    <>
      <ResponsiveDialog
        open
        onClose={busy ? () => {} : onClose}
        title="QORT rate"
        maxWidth="xs"
        busy={busy}
        actions={
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void update()}
              disabled={busy || loading || blocking.length > 0 || !changed}
              startIcon={p.preparing ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {p.preparing ? "Preparing…" : "Update prices"}
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {currentStore?.title || "Your shop"} prices its products in {currency}. Change what one QORT is worth, and every product priced in {currency} gets the
            QORT price it gives{takesArrr ? "; ARRR prices keep their own rate" : ""}.
          </Typography>
          <TextField
            label="1 QORT is worth"
            value={rate}
            onChange={(e) => {
              setRate(sanitizeFiatInput(e.target.value, RATE_DECIMALS));
              setFormError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void update();
            }}
            autoFocus
            disabled={busy}
            required
            error={!!rate.trim() && Number.isNaN(q)}
            helperText={`Now ${rateToText(current.rates.QORT)} ${currency}`}
            slotProps={{
              htmlInput: { inputMode: "decimal", autoComplete: "off" },
              input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
            }}
          />
          <Box role="status" sx={{ minHeight: 24 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">
                Reading your products… {total > 1 ? `(${read} of ${total})` : ""}
              </Typography>
            ) : (
              <>
                <Typography variant="body2">
                  {followers.length === 0
                    ? `No product is priced in ${currency} yet: only the rate is saved.`
                    : followers.length === 1
                      ? `1 product is priced in ${currency}.`
                      : `${followers.length} products are priced in ${currency}.`}
                </Typography>
                {sample && !Number.isNaN(q) && (
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {`For example ${titleOf(sample.product) || "a product"}: ${fiatToText(sample.value, currency)} ${currency} = ${coinPriceFromFiat(sample.value, q)} QORT`}
                  </Typography>
                )}
              </>
            )}
          </Box>
          {missingProducts > 0 && (
            <Alert severity="info">
              {missingProducts === 1 ? "1 product is" : `${missingProducts} products are`} missing from {missingProducts === 1 ? "its catalogue" : "their catalogues"}{" "}
              (a publish that didn&apos;t finish) and can&apos;t be repriced here.
            </Alert>
          )}
          {blocking.length > 0 && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" onClick={retryBlocking} sx={{ minHeight: 44 }}>
                  Retry
                </Button>
              }
            >
              Some products couldn&apos;t be read from your node yet, so the rate can&apos;t be changed until they are.
            </Alert>
          )}
          {p.notice && <Alert severity="info">{p.notice}</Alert>}
          <FormError message={formError ?? p.error} />
          {currentStore?.id && (
            <Button
              color="inherit"
              onClick={() => {
                onClose();
                navigate(`${sellerPath(currentStore.id)}?tab=shop`);
              }}
              disabled={busy}
              sx={{ alignSelf: "flex-start", minHeight: 44 }}
            >
              All rates and prices
            </Button>
          )}
        </Box>
      </ResponsiveDialog>

      {review && (
        <PriceReviewDialog
          review={review}
          titleOf={(productId) => titleOf(followers.find((f) => f.row.productId === productId)?.product) || "Product"}
          onBack={() => setReview(null)}
          onPublish={() => void send(review)}
        />
      )}

      {p.job && (
        <PublishProductsDialog
          open
          resources={p.job.resources}
          labels={p.job.labels}
          publicKey={publicKey}
          what="prices"
          settledNote="Your products keep their old prices until these are published."
          onDone={() => {
            p.done();
            onClose();
          }}
          onClose={(sent) => p.closed(sent)}
        />
      )}
    </>
  );
}
