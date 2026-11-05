/**
 * The buyer's choice of delivery option at Confirm (delivery/model.ts):
 * each option the shop offers for this order and address, with its note
 * ("1–3 days") and what it adds, in the coin they pay with.
 */
import { useId } from "react";
import { Box, FormControlLabel, Radio, RadioGroup, Typography } from "@mui/material";
import { AmountTag } from "../../components/money/PriceTag";
import { unitPrice } from "../../money/pricing";
import type { ShopCoinSettings } from "../../money/coins";
import type { DeliveryChoice } from "../../delivery/checkoutDelivery";

export function DeliveryOptionsPicker({
  choices,
  value,
  onChange,
  coin,
  rate,
  shop,
  label = "Delivery",
}: {
  choices: DeliveryChoice[];
  value: string;
  onChange: (choice: DeliveryChoice) => void;
  coin: string;
  rate: number | null;
  shop: ShopCoinSettings | null | undefined;
  label?: string;
}) {
  const labelId = useId();
  return (
    <Box>
      <Typography id={labelId} variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => {
          const choice = choices.find((c) => c.id === event.target.value);
          if (choice) onChange(choice);
        }}
      >
        {choices.map((choice) => {
          const fee = choice.line ? unitPrice(choice.line.product, coin, rate) : 0;
          return (
            <FormControlLabel
              key={choice.id || "base"}
              value={choice.id}
              control={<Radio />}
              sx={{ m: 0, alignItems: "flex-start", "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0, py: 1.1 } }}
              label={
                <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography component="span" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                      {choice.name}
                    </Typography>
                    {choice.note && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block", overflowWrap: "anywhere" }}>
                        {choice.note}
                      </Typography>
                    )}
                  </Box>
                  {choice.line && fee ? <AmountTag value={fee} coin={coin} shop={shop} size="small" /> : <Typography variant="body2">Free</Typography>}
                </Box>
              }
            />
          );
        })}
      </RadioGroup>
    </Box>
  );
}
