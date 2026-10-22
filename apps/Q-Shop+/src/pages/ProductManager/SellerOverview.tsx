/**
 * The seller's overview of their current shop: orders to handle, recent
 * orders and a few numbers. Round 2 fills this in; the seller page shows it
 * as its first tab.
 */
import { Typography } from "@mui/material";

export function SellerOverview({ storeId }: { storeId: string }) {
  return (
    <Typography color="text.secondary" data-store-id={storeId}>
      Overview coming soon.
    </Typography>
  );
}
