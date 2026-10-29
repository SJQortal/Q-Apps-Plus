import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { QortalSVG } from "../../assets/svgs/QortalSVG";
import { ARRRSVG } from "../../assets/svgs/ARRRSVG";
import { assetIdOf } from "../../money/coins";
import { assetAvatarUrl } from "../../qdn/assetAvatar";

/**
 * A coin's mark: QORT and ARRR as theme-coloured SVGs (as the original), an
 * asset as its avatar from Q-Assets (qdn/assetAvatar.ts), or its initial in
 * a circle while that loads or when it has none. Decorative: the amount next
 * to it always says the coin in words.
 */
export function CoinIcon({ coin, size = 18, label }: { coin: string; size?: number; label?: string }) {
  const theme = useTheme();
  const color = theme.palette.text.primary;
  if (coin === "QORT") return <QortalSVG color={color} width={String(size)} height={String(size)} />;
  if (coin === "ARRR") return <ARRRSVG color={color} width={String(size)} height={String(size)} />;
  const assetId = assetIdOf(coin);
  if (assetId !== null) return <AssetIcon assetId={assetId} size={size} label={label} />;
  return null;
}

function AssetIcon({ assetId, size, label }: { assetId: number; size: number; label?: string }) {
  const [avatar, setAvatar] = useState<{ id: number; url: string | null } | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    assetAvatarUrl(assetId).then(
      (url) => alive && setAvatar({ id: assetId, url }),
      () => alive && setAvatar({ id: assetId, url: null })
    );
    return () => {
      alive = false;
    };
  }, [assetId]);
  const url = avatar?.id === assetId ? avatar.url : null;

  if (url && broken !== url) {
    return (
      <Box
        component="img"
        src={url}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        onError={() => setBroken(url)}
        sx={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, bgcolor: "action.hover" }}
      />
    );
  }
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
