/**
 * A shop's delivery prices for what buyers see before checkout (product
 * pages, the cart, checkout's address step): read once per shop (a cached
 * search, then the document only for shops that have one).
 */
import { useEffect, useState } from "react";
import { loadShopDelivery, type ShopDelivery } from "./checkoutDelivery";

export type ShopDeliveryLoad = { status: "loading" } | { status: "ready"; delivery: ShopDelivery } | { status: "failed" };

export function useShopDelivery(owner: string, storeId: string, enabled = true): ShopDeliveryLoad {
  const key = `${owner}\n${storeId}`;
  const [loaded, setLoaded] = useState<{ key: string; load: ShopDeliveryLoad } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadShopDelivery(owner, storeId).then(
      (delivery) => live && setLoaded({ key, load: { status: "ready", delivery } }),
      () => live && setLoaded({ key, load: { status: "failed" } })
    );
    return () => {
      live = false;
    };
  }, [owner, storeId, key, enabled]);
  return loaded?.key === key ? loaded.load : { status: "loading" };
}
