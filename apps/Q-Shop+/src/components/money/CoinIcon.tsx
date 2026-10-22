import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { QortalSVG } from "../../assets/svgs/QortalSVG";
import { ARRRSVG } from "../../assets/svgs/ARRRSVG";
import { assetIdOf } from "../../money/coins";

/**
 * A coin's mark: QORT and ARRR as theme-coloured SVGs (as the original), an
 * asset as its initial in a circle. Decorative: the amount next to it always
 * says the coin in words.
 */
export function CoinIcon({ coin, size = 18, label }: { coin: string; size?: number; label?: string }) {
  const theme = useTheme();
  const color = theme.palette.text.primary;
  if (coin === "QORT") return <QortalSVG color={color} width={String(size)} height={String(size)} />;
  if (coin === "ARRR") return <ARRRSVG color={color} width={String(size)} height={String(size)} />;
  if (assetIdOf(coin) !== null) {
    return (
      <Box
        aria-hidden
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontSize: Math.round(size * 0.55),
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {(label || "A").slice(0, 1).toUpperCase()}
      </Box>
    );
  }
  return null;
}
