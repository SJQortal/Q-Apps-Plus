/** The shop's away notice (away.ts), where buyers decide: its page, its products, checkout. */
import { Alert, Typography } from "@mui/material";
import { awayOf, awayText } from "./away";

export function AwayNotice({ shop, sx }: { shop: { away?: unknown; title?: string } | null | undefined; sx?: object }) {
  const away = awayOf(shop);
  if (!away) return null;
  return (
    <Alert severity="info" sx={sx}>
      <Typography component="span" sx={{ fontWeight: 600, display: "block" }}>
        {shop?.title ? `${shop.title} is away. ` : ""}
        {awayText(away)}
      </Typography>
      {away.note && (
        <Typography component="span" variant="body2" sx={{ display: "block", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {away.note}
        </Typography>
      )}
    </Alert>
  );
}
