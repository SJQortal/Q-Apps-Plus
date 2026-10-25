/**
 * A shop's delivery prices for what buyers see before checkout (product
 * pages, the cart, checkout's address step): a cached search, then the
 * document only for shops that have one; read from the node again when the
 * session's copy is over a minute old.
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
    loadShopDelivery(owner, storeId, { maxAgeMs: 60_000 }).then(
      (delivery) => live && setLoaded({ key, load: { status: "ready", delivery } }),
      () => live && setLoaded({ key, load: { status: "failed" } })
    );
    return () => {
      live = false;
    };
  }, [owner, storeId, key, enabled]);
  return loaded?.key === key ? loaded.load : { status: "loading" };
}
