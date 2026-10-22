/**
 * Shop tab → Prices (full screen on phones): the currency, the seller's own
 * exchange rates for QORT and ARRR, and every product's price in the
 * currency, with the QORT and ARRR prices they give (money/fiatPricing.ts).
 * "Fill from QORT prices" turns the products' current QORT prices into the
 * currency at the typed rate, for a first setup. Publishing sends the
 * products whose prices change and the product list
 * (seller/useShopPricing.ts); products left empty keep their QORT and ARRR
 * prices. The rates are the seller's numbers: nothing is fetched from
 * outside Qortal.
 */
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Alert, Box, Button, InputAdornment, Skeleton, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { shopCoins } from "../money/coins";
import {
  FIAT_CURRENCIES,
  RATE_DECIMALS,
  coinPriceFromFiat,
  fiatPriceOf,
  fiatPricingOf,
  parseFiat,
  qortPriceOf,
  rateToText,
  sanitizeFiatInput,
  staleFiatPriceOf,
  type FiatRates,
} from "../money/fiatPricing";
import { formatPrice } from "../money/pricing";
import { FormError } from "./FormError";
import { PublishProductsDialog } from "./PublishProductsDialog";
import type { SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { useShopPricing } from "./useShopPricing";

/** Products listed at a time. */
export const PRICING_PAGE = 30;

function titleOf(details: Record<string, any> | undefined): string {
  return typeof details?.title === "string" ? details.title.trim() : "";
}

function arrrPriceOf(product: Record<string, any> | undefined): number | undefined {
  const list: { currency?: unknown; value?: unknown }[] = Array.isArray(product?.price) ? product.price : [];
  const value = list.find((p) => p?.currency === "ARRR")?.value;
  return typeof value === "number" && value > 0 ? value : undefined;
}

export function PricingDialog({ onClose }: { onClose: () => void }) {
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const publicKey = useSelector((state: RootState) => state.auth.user?.publicKey);
  const owner = currentStore?.owner || "";
  const { request, retry, statusOf, productOf } = useCatalogueLoader(owner);
  const p = useShopPricing();
  const current = useMemo(() => fiatPricingOf(dataContainer), [dataContainer]);
  const takesArrr = shopCoins(currentStore).includes("ARRR");

  const [currency, setCurrency] = useState(current?.currency ?? "USD");
  const [qortRate, setQortRate] = useState(rateToText(current?.rates.QORT));
  const [arrrRate, setArrrRate] = useState(rateToText(current?.rates.ARRR));
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [find, setFind] = useState("");
  const [shown, setShown] = useState(PRICING_PAGE);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Every product's catalogue: their prices in the currency are kept there.
  const catalogueIds = useMemo(() => [...new Set(rows.map((row) => row.catalogueId))], [rows]);
  const catalogueKey = catalogueIds.join("|");
  useEffect(() => {
    if (catalogueKey) request(catalogueKey.split("|"));
  }, [catalogueKey, request]);
  const loads = catalogueIds.map(statusOf);
  const failed = catalogueIds.filter((_, i) => loads[i] === "failed");
  const loading = loads.some((l) => l !== "ready" && l !== "failed");

  const details = (row: SellerRow) => productOf(row.catalogueId, row.productId);
  const initialText = (row: SellerRow) => {
    const fiat = fiatPriceOf(details(row), currency);
    return fiat ? fiat.value.toFixed(2) : "";
  };
  const textOf = (row: SellerRow) => typed[row.productId] ?? initialText(row);

  const q = parseFiat(qortRate, RATE_DECIMALS);
  const a = arrrRate.trim() ? parseFiat(arrrRate, RATE_DECIMALS) : undefined;
  const rates: FiatRates | null = Number.isNaN(q) || (a !== undefined && Number.isNaN(a)) ? null : { QORT: q, ...(a !== undefined && { ARRR: a }) };
  const ratesChanged =
    !current ||
    current.currency !== currency ||
    rateToText(current.rates.QORT) !== qortRate.trim() ||
    rateToText(current.rates.ARRR) !== arrrRate.trim();
  const productsChanged = rows.some((row) => textOf(row) !== initialText(row));
  const changed = ratesChanged || productsChanged;
  const priced = rows.filter((row) => !Number.isNaN(parseFiat(textOf(row)))).length;

  const needle = find.trim().toLowerCase();
  const matching = needle ? rows.filter((row) => titleOf(details(row)).toLowerCase().includes(needle)) : rows;
  const visible = matching.slice(0, shown);

  const fillFromQort = () => {
    if (!rates) return;
    setTyped((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (textOf(row).trim()) continue;
        const qort = qortPriceOf(details(row)) ?? row.priceQort;
        if (typeof qort === "number" && qort > 0) next[row.productId] = (Math.round(qort * rates.QORT * 100) / 100).toFixed(2);
      }
      return next;
    });
  };

  const publish = async () => {
    setFormError(null);
    if (!rates) return setFormError(`Type how much one QORT is worth in ${currency}${takesArrr ? " (and one ARRR, if you like)" : ""}.`);
    const prices: Record<string, number | null> = {};
    for (const row of rows) {
      const text = textOf(row).trim();
      const value = parseFiat(text);
      if (text && Number.isNaN(value)) {
        return setFormError(`Check the price of ${titleOf(details(row)) || "a product"}: a number above 0, with at most 2 decimals.`);
      }
      if (!Number.isNaN(value)) prices[row.productId] = value;
      else if (details(row)?.fiatPrice) prices[row.productId] = null;
    }
    await p.prepare({ pricing: { currency, rates }, prices });
  };

  const requestClose = () => (changed ? setConfirmDiscard(true) : onClose());
  const busy = p.preparing || !!p.job;

  return (
    <>
      <ResponsiveDialog
        open
        onClose={requestClose}
        title={current ? `Prices in ${current.currency}` : "Prices in a currency"}
        maxWidth="md"
        dismissible={false}
        busy={busy}
        actions={
          <>
            {current && (
              <Button color="error" onClick={() => setConfirmStop(true)} disabled={busy} sx={{ mr: "auto" }}>
                Stop using {current.currency}
              </Button>
            )}
            <Button color="inherit" onClick={requestClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="contained" onClick={() => void publish()} disabled={busy || loading || !changed}>
              Publish prices
            </Button>
          </>
        }
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Price your products in a currency at exchange rates you choose: each product&apos;s QORT
            {takesArrr ? " and ARRR" : ""} price is worked out from them, and follows when you change a rate. Buyers pay
            those prices. The rates are yours: nothing is fetched from outside Qortal.
          </Typography>

          <Box component="section" aria-labelledby="pricing-rates-heading" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Typography id="pricing-rates-heading" component="h3" sx={{ fontWeight: 700 }}>
              Currency and rates
            </Typography>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: takesArrr ? "160px 1fr 1fr" : "160px 1fr" } }}>
              <TextField
                select
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={busy}
                slotProps={{ select: { native: true } }}
                sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
              >
                {[...new Set([...FIAT_CURRENCIES, currency])].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </TextField>
              <TextField
                label="1 QORT is worth"
                value={qortRate}
                onChange={(e) => setQortRate(sanitizeFiatInput(e.target.value, RATE_DECIMALS))}
                disabled={busy}
                required
                error={!!qortRate.trim() && Number.isNaN(q)}
                slotProps={{
                  htmlInput: { inputMode: "decimal", autoComplete: "off" },
                  input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
                }}
              />
              {takesArrr && (
                <TextField
                  label="1 ARRR is worth"
                  value={arrrRate}
                  onChange={(e) => setArrrRate(sanitizeFiatInput(e.target.value, RATE_DECIMALS))}
                  disabled={busy}
                  helperText="Optional. Empty: buyers paying in ARRR pay the QORT price at your node's rate."
                  error={!!arrrRate.trim() && Number.isNaN(a ?? NaN)}
                  slotProps={{
                    htmlInput: { inputMode: "decimal", autoComplete: "off" },
                    input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
                  }}
                />
              )}
            </Box>
          </Box>

          <Box component="section" aria-labelledby="pricing-products-heading" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography id="pricing-products-heading" component="h3" sx={{ fontWeight: 700 }}>
              Products
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
              <Typography variant="body2" color="text.secondary" role="status" sx={{ flex: "1 1 auto" }}>
                {`${priced} of ${rows.length} priced in ${currency}`}
              </Typography>
              <Button variant="outlined" onClick={fillFromQort} disabled={!rates || busy || loading} sx={{ minHeight: 44 }}>
                Fill from QORT prices
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Empty: the product keeps the prices it has. &quot;Fill from QORT prices&quot; puts each empty one&apos;s QORT price
              in {currency} at your rate, to start from.
            </Typography>
            {rows.length > 8 && (
              <TextField
                type="search"
                size="small"
                value={find}
                onChange={(e) => {
                  setFind(e.target.value);
                  setShown(PRICING_PAGE);
                }}
                placeholder="Find a product"
                slotProps={{
                  htmlInput: { "aria-label": "Find a product" },
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ "& .MuiInputBase-root": { minHeight: 44 } }}
              />
            )}
            {failed.length > 0 && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" onClick={() => failed.forEach(retry)} sx={{ minHeight: 44 }}>
                    Retry
                  </Button>
                }
              >
                Some products couldn&apos;t be read from your node yet, so their prices can&apos;t be shown.
              </Alert>
            )}
            <Box component="ul" aria-label="Product prices" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {visible.map((row) => {
                const d = details(row);
                const name = titleOf(d);
                const load = statusOf(row.catalogueId);
                const text = textOf(row);
                const value = parseFiat(text);
                const invalid = !!text.trim() && Number.isNaN(value);
                const stale = !text.trim() ? staleFiatPriceOf(d, currency) : null;
                const nowQort = qortPriceOf(d) ?? row.priceQort;
                const nowArrr = arrrPriceOf(d);
                const images: unknown[] = Array.isArray(d?.images) ? d.images : [];
                const pic = (images[typeof d?.mainImageIndex === "number" ? d.mainImageIndex : 0] ?? images[0]) as string | undefined;
                const label = name || "Product";
                let result = "";
                if (!Number.isNaN(value) && rates) {
                  result = `= ${coinPriceFromFiat(value, rates.QORT)} QORT`;
                  if (takesArrr) result += rates.ARRR ? ` · ${coinPriceFromFiat(value, rates.ARRR)} ARRR` : " · ARRR at the node's rate";
                }
                return (
                  <Box
                    component="li"
                    key={row.productId}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      p: 1,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "background.paper",
                      flexWrap: { xs: "wrap", sm: "nowrap" },
                    }}
                  >
                    <Box sx={{ width: 44, height: 44, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0 }}>
                      {pic && <Box component="img" src={pic} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </Box>
                    <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                      {name ? (
                        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{name}</Typography>
                      ) : load === "ready" || load === "failed" ? (
                        <Typography color="text.secondary">Untitled product</Typography>
                      ) : (
                        <Skeleton width="60%" />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {`Now ${formatPrice(nowQort)} QORT${nowArrr ? ` · ${formatPrice(nowArrr)} ARRR` : ""}`}
                        {row.status === "RETIRED" ? " · Retired" : ""}
                      </Typography>
                      {stale !== null && (
                        <Typography variant="body2" color="text.secondary">
                          {`Was ${stale.toFixed(2)} ${currency} until its QORT price was changed elsewhere.`}
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      size="small"
                      value={text}
                      onChange={(e) => setTyped((prev) => ({ ...prev, [row.productId]: sanitizeFiatInput(e.target.value) }))}
                      disabled={busy || !d}
                      error={invalid}
                      helperText={invalid ? "A number above 0" : result || " "}
                      slotProps={{
                        htmlInput: { inputMode: "decimal", autoComplete: "off", "aria-label": `Price of ${label} in ${currency}` },
                        input: { endAdornment: <InputAdornment position="end">{currency}</InputAdornment> },
                      }}
                      sx={{ flex: { xs: "1 1 100%", sm: "0 0 220px" }, "& .MuiInputBase-root": { minHeight: 44 } }}
                    />
                  </Box>
                );
              })}
            </Box>
            {matching.length > shown && (
              <Button variant="outlined" onClick={() => setShown((n) => n + PRICING_PAGE)} sx={{ minHeight: 44 }}>
                Show more ({matching.length - shown} more)
              </Button>
            )}
            {needle && matching.length === 0 && (
              <Typography color="text.secondary">{loading ? "Loading your products' titles…" : "No products match."}</Typography>
            )}
          </Box>
          {p.notice && <Alert severity="info">{p.notice}</Alert>}
          <FormError message={formError ?? p.error} />
        </Box>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title={`Stop using ${current?.currency ?? "the currency"}?`}
        maxWidth="xs"
        actions={
          <>
            <Button color="inherit" onClick={() => setConfirmStop(false)}>
              Keep it
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirmStop(false);
                void p.prepare({ pricing: null, prices: {} });
              }}
            >
              Stop
            </Button>
          </>
        }
      >
        <Typography>
          Your products keep the QORT{takesArrr ? " and ARRR" : ""} prices they have now, and changing a rate no longer
          changes them. You can set prices in a currency again at any time.
        </Typography>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard your changes?"
        maxWidth="xs"
        actions={
          <>
            <Button color="inherit" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </Button>
          </>
        }
      >
        <Typography>The rates and prices you typed here will be lost.</Typography>
      </ResponsiveDialog>

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
