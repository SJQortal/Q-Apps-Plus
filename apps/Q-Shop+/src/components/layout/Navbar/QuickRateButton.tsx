/**
 * Beside Manage Shop: the seller's QORT rate, when their shop prices in a
 * currency (money/fiatPricing.ts), "1 QORT = 0.18 USD", and a tap away from
 * changing it (seller/QuickRateDialog.tsx, loaded when first opened). It
 * narrows with the header (useHeaderFit.ts): the rate alone, then the icon alone.
 */
import { lazy, Suspense, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Tooltip } from "@mui/material";
import CurrencyExchangeOutlinedIcon from "@mui/icons-material/CurrencyExchangeOutlined";
import type { RootState } from "../../../state/store";
import { fiatPricingOf, rateToText } from "../../../money/fiatRates";

const QuickRateDialog = lazy(() => import("../../../seller/QuickRateDialog").then((m) => ({ default: m.QuickRateDialog })));

export function QuickRateButton({ phone }: { phone: boolean }) {
  const name = useSelector((state: RootState) => state.auth.user?.name);
  const store = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const pricing = useMemo(() => fiatPricingOf(dataContainer), [dataContainer]);
  const [open, setOpen] = useState(false);
  // The signed-in seller's own current shop, its product list loaded.
  if (!name || !store || store.owner !== name || !pricing || dataContainer?.storeId !== store.id) return null;
  const rate = `${rateToText(pricing.rates.QORT)} ${pricing.currency}`;
  return (
    <>
      <Tooltip title="Change the QORT rate">
        <Button
          variant="outlined"
          color="inherit"
          className="qp-quick-rate"
          onClick={() => setOpen(true)}
          aria-label={`QORT rate: 1 QORT = ${rate}. Change it`}
          startIcon={<CurrencyExchangeOutlinedIcon aria-hidden />}
          sx={{
            flexShrink: 0,
            minHeight: phone ? 44 : 40,
            minWidth: 44,
            px: phone ? 1 : 1.25,
            borderRadius: 999,
            borderColor: "divider",
            textTransform: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
            "& .MuiButton-startIcon": { mr: 0.75 },
            // Phones show the rate without "1 QORT ="; desktop headers drop that, then the rate, as they need (useHeaderFit.ts).
            // The name stays whole for screen readers.
            ...(phone && { "& .qp-rate-prefix": { display: "none" } }),
          }}
        >
          <Box component="span" className="qp-rate-text">
            <Box component="span" className="qp-rate-prefix">
              1 QORT ={" "}
            </Box>
            {rate}
          </Box>
        </Button>
      </Tooltip>
      {open && (
        <Suspense fallback={null}>
          <QuickRateDialog onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
