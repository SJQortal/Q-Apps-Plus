/**
 * What happens after an order is placed, in the shop's own terms (its
 * dispatch time and whether its seller is away, shop/): who does what next,
 * and where the buyer follows it.
 */
import { Box, Typography } from "@mui/material";
import { awayOf, awayText } from "../../shop/away";
import { dispatchText, policiesOf } from "../../shop/policies";

export function NextSteps({ shop, digital }: { shop: { title?: string; owner?: string; policies?: unknown; away?: unknown }; digital: boolean }) {
  const name = shop.title || shop.owner || "The seller";
  const away = awayOf(shop);
  const dispatch = dispatchText(policiesOf(shop));
  const steps = digital
    ? [`${name} sends it as the shop says (by Q-Mail, often).`, "Mark it received in My orders once you have it, then review the shop."]
    : [
        away ? awayText(away, shop.title) : dispatch ? `${dispatch}.` : `${name} sends it and marks it Shipped.`,
        "My orders shows its status, and the tracking number when the seller adds one.",
        "When it arrives, mark it delivered, then review the shop.",
      ];
  return (
    <Box component="ol" aria-label="What happens next" sx={{ m: 0, mt: 1.5, pl: 3, textAlign: "left", display: "flex", flexDirection: "column", gap: 0.5 }}>
      {steps.map((step) => (
        <Typography component="li" variant="body2" key={step} sx={{ overflowWrap: "anywhere" }}>
          {step}
        </Typography>
      ))}
    </Box>
  );
}
