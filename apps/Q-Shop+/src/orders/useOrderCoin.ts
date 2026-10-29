/**
 * The coin an order's amounts are shown in, on the buyer's and the seller's
 * screens.
 *
 * The buyer wrote their order, so their screens read it as written. For the
 * seller every field of an order is the buyer's claim (anyone can encrypt an
 * order to a seller): a buyer could pay with a worthless asset they issued
 * and call it "QORT" in `payment.assetName`. So the seller's screens:
 * - read the coin strictly (orders/payment.ts orderCoinOf): a ticker the app
 *   knows or `ASSET:<id>`, otherwise "Unknown coin";
 * - name an asset from the seller's own shop (`acceptedAssets`), or from the
 *   node (`/assets/info?assetId=`, read-only, cached), and show
 *   "Asset #<id>" until it's known; never from `payment.assetName`;
 * - hand the shop to the payment check, which warns when the shop doesn't
 *   accept the coin (orders/payment.ts shopPaymentWarnings).
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../state/store";
import type { Order } from "../state/features/orderSlice";
import type { CurrentStore } from "../state/features/globalSlice";
import { coinLabel, type ShopCoinSettings } from "../money/coins";
import { shortStoreIdOf, shortStoreIdOfOrder } from "../qdn/identifiers";
import { assetInfo } from "../qdn/assets";
import { orderCoin, orderCoinSettings } from "./format";
import { paymentSummary, UNKNOWN_COIN, type PaymentSummary } from "./payment";

export interface OrderCoinView {
  /** For AmountTag. */
  coin: string;
  /** For AmountTag: the asset's name, when the coin is an asset. */
  settings: ShopCoinSettings | null;
  /** The coin in words: "QORT", "ARRR", "Gold", "Asset #42", "Unknown coin". */
  label: string;
  summary: PaymentSummary;
  /** The seller's own shop when the order was placed at it (what it accepts); null for the buyer. */
  shop: ShopCoinSettings | null;
}

/** The signed-in seller's shop, when the order's id says it was placed there. */
function useOwnShopFor(order: Order | null, role: "buyer" | "seller"): CurrentStore | null {
  return useSelector((state: RootState) => {
    if (role !== "seller" || !order) return null;
    const shop = state.global.currentStore;
    if (!shop) return null;
    const short = shop.shortStoreId || shortStoreIdOf(shop.id);
    return short && short === shortStoreIdOfOrder(order.id) ? shop : null;
  });
}

const namesFromNode = new Map<number, string | null>();

/** An asset's name as the node knows it, or null until it's read (or when the node has no such asset). */
export function useAssetNameFromNode(assetId: number | null): string | null {
  const [found, setFound] = useState<{ id: number; name: string | null } | null>(null);
  useEffect(() => {
    if (assetId === null || namesFromNode.has(assetId)) return;
    let live = true;
    assetInfo({ id: assetId }).then(
      (asset) => {
        const name = asset && asset.assetId === assetId && asset.assetName ? asset.assetName : null;
        namesFromNode.set(assetId, name);
        if (live) setFound({ id: assetId, name });
      },
      // The node couldn't be asked: "Asset #<id>" stays.
      () => {}
    );
    return () => {
      live = false;
    };
  }, [assetId]);
  if (assetId === null) return null;
  if (found && found.id === assetId) return found.name;
  return namesFromNode.get(assetId) ?? null;
}

export function useOrderCoinView(order: Order | null, role: "buyer" | "seller"): OrderCoinView {
  const shop = useOwnShopFor(order, role);
  const summary = paymentSummary(order?.payment);
  const assetId = role === "seller" && summary.kind === "asset" ? summary.assetId : null;
  const listed = assetId !== null ? shop?.acceptedAssets?.find((a) => a.id === assetId)?.name?.trim() || null : null;
  const fromNode = useAssetNameFromNode(assetId !== null && !listed ? assetId : null);

  if (role === "buyer") {
    const coin = orderCoin(order);
    const settings = orderCoinSettings(order);
    return { coin, settings, label: coinLabel(coin, settings), summary, shop: null };
  }
  if (!summary.known) return { coin: UNKNOWN_COIN, settings: null, label: UNKNOWN_COIN, summary, shop };
  if (assetId !== null) {
    const name = listed || fromNode || `Asset #${assetId}`;
    return { coin: summary.coin, settings: { acceptedAssets: [{ id: assetId, name }] }, label: name, summary, shop };
  }
  return { coin: summary.coin, settings: null, label: summary.coin, summary, shop };
}

/** For tests. */
export function resetAssetNamesFromNode(): void {
  namesFromNode.clear();
}
