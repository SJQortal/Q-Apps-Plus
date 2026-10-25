/**
 * Under checkout's address: when the shop offers delivery options, that the
 * buyer picks one next (Standard, Express, Local pickup…), each priced for
 * the address. Its delivery prices are read now (cached), which checkout's
 * Continue reads anyway.
 */
import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import { loadShopDelivery } from "../../delivery/checkoutDelivery";
import { deliveryOptionsOf } from "../../delivery/model";

export function UpcomingOptions({ owner, storeId }: { owner: string; storeId: string }) {
  const [names, setNames] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    loadShopDelivery(owner, storeId).then(
      ({ doc }) => live && setNames(doc?.options?.length ? deliveryOptionsOf(doc).map((o) => o.name) : []),
      () => live && setNames([])
    );
    return () => {
      live = false;
    };
  }, [owner, storeId]);
  if (!names || names.length < 2) return null;
  const list = `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
  return (
    <Typography variant="body2" color="text.secondary">
      Next, you choose how it comes: {list}, each priced for this address.
    </Typography>
  );
}
