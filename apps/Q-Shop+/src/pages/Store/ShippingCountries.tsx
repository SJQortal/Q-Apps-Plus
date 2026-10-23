/**
 * "Ships to Europe (except Russian Federation) · 51 countries": the shop's
 * countries (constants/shipping.ts), listed by region in a dialog, for a
 * buyer who wants to check theirs.
 */
import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { ResponsiveDialog } from "../../components/common/mobile";
import { ALL_STATE_CODES, SHIPPING_REGIONS, US, countryName, shippingCountriesOf, shippingStatesOf, stateName, statesSummary } from "../../constants/shipping";

export function ShippingCountriesButton({ shop }: { shop: { shippingCountries?: unknown; shippingStates?: unknown; title?: string } }) {
  const [open, setOpen] = useState(false);
  const list = shippingCountriesOf(shop);
  if (!list) return null;
  const chosen = new Set(list);
  // In the United States, the states it ships to when some only.
  const states = chosen.has(US) ? shippingStatesOf(shop) : null;
  const missingStates = states ? ALL_STATE_CODES.filter((c) => !states.includes(c)) : [];
  return (
    <>
      <Button
        size="small"
        onClick={() => setOpen(true)}
        sx={{ minHeight: 32, py: 0, px: 0.75, ml: -0.25, textTransform: "none", fontWeight: 600, verticalAlign: "baseline" }}
        aria-haspopup="dialog"
      >
        {list.length === 1 ? "1 country" : `${list.length} countries`}
      </Button>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} title={`Where ${shop.title || "the shop"} ships`} maxWidth="sm">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SHIPPING_REGIONS.map((region) => {
            const inside = region.codes.filter((c) => chosen.has(c));
            if (inside.length === 0) return null;
            const names = inside.map(countryName).sort((a, b) => a.localeCompare(b));
            return (
              <Box key={region.id} component="section" aria-label={region.label}>
                <Typography sx={{ fontWeight: 700 }}>
                  {region.label}{" "}
                  <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                    {inside.length === region.codes.length ? "· all" : `· ${inside.length} of ${region.codes.length}`}
                  </Box>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                  {names.join(", ")}
                </Typography>
              </Box>
            );
          })}
          {states && (
            <Box component="section" aria-label="Within the United States">
              <Typography sx={{ fontWeight: 700 }}>
                Within the United States{" "}
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                  · {statesSummary(states)}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
                {missingStates.length <= states.length
                  ? `Not to ${missingStates.map(stateName).sort((a, b) => a.localeCompare(b)).join(", ")}.`
                  : `Only to ${states.map(stateName).sort((a, b) => a.localeCompare(b)).join(", ")}.`}
              </Typography>
            </Box>
          )}
        </Box>
      </ResponsiveDialog>
    </>
  );
}
