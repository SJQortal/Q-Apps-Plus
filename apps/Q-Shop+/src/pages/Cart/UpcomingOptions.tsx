/**
 * Under checkout's address: when the shop offers delivery options, that the
 * buyer picks one next (Standard, Express, Local pickup…), each priced for
 * the address. Its delivery prices are read now (cached), which checkout's
 * Continue reads anyway.
 */
import { Typography } from "@mui/material";
import { useShopDelivery } from "../../delivery/useShopDelivery";
import { deliveryOptionsOf } from "../../delivery/model";

export function UpcomingOptions({ owner, storeId }: { owner: string; storeId: string }) {
  const load = useShopDelivery(owner, storeId);
  const doc = load.status === "ready" ? load.delivery.doc : null;
  const names = doc?.options?.length ? deliveryOptionsOf(doc).map((o) => o.name) : [];
  if (names.length < 2) return null;
  const list = `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return (
    <Typography variant="body2" color="text.secondary">
      Next, you choose how it comes: {list}, each priced for this address.
    </Typography>
  );
}
