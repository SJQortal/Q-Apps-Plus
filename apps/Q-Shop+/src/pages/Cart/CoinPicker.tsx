import { useId } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { CoinIcon } from "../../components/money/CoinIcon";
import { coinLabel, type CoinId, type ShopCoinSettings } from "../../money/coins";

/**
 * The coins a shop takes, as a row of pill buttons (they wrap on phones).
 * One coin: just says which. The choice is the buyer's preferred coin
 * (useShopCoin), so it carries over to other shops that take it.
 */
export function CoinPicker({
  coins,
  value,
  onChange,
  shop,
  disabled,
}: {
  coins: CoinId[];
  value: string;
  onChange: (coin: string) => void;
  shop: ShopCoinSettings | null;
  disabled?: boolean;
}) {
  const labelId = useId();
  if (coins.length <= 1) {
    const only = coins[0] ?? "QORT";
    return (
      <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        Pays in
        <CoinIcon coin={only} size={16} label={coinLabel(only, shop)} />
        <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>
          {coinLabel(only, shop)}
        </Box>
      </Typography>
    );
  }
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }} id={labelId}>
        Pay with
      </Typography>
      <ToggleButtonGroup
        exclusive
        value={value}
        onChange={(_, next: string | null) => {
          if (next) onChange(next);
        }}
        aria-labelledby={labelId}
        disabled={disabled}
        sx={{
          flexWrap: "wrap",
          gap: 1,
          "& .MuiToggleButtonGroup-grouped": {
            m: 0,
            border: 1,
            borderColor: "divider",
            borderRadius: "999px !important",
            minHeight: 44,
            px: 1.75,
            gap: 0.75,
            textTransform: "none",
            fontWeight: 600,
            color: "text.primary",
          },
          "& .MuiToggleButtonGroup-grouped.Mui-selected": {
            borderColor: "primary.main",
            bgcolor: "action.selected",
            color: "text.primary",
          },
          "& .MuiToggleButtonGroup-grouped:focus-visible": {
            outline: 2,
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      >
        {coins.map((coin) => (
          <ToggleButton key={coin} value={coin}>
            <CoinIcon coin={coin} size={18} label={coinLabel(coin, shop)} />
            {coinLabel(coin, shop)}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
