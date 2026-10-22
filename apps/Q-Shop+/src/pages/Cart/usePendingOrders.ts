import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  isRecordingOrder,
  listPendingOrders,
  subscribePendingOrders,
  type PendingOrder,
} from "../../money/pendingOrders";

/**
 * The buyer's orders that were paid (or may have been) but aren't on QDN
 * yet, newest first, kept current as checkout and the pending-order actions
 * change them (money/pendingOrders.ts). Empty when signed out.
 */
export function usePendingOrders(buyerName: string | null | undefined): PendingOrder[] {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribePendingOrders(() => setVersion((v) => v + 1)), []);
  // `version` re-reads the list whenever it changes.
  return useMemo(() => (version >= 0 ? listPendingOrders(buyerName) : []), [buyerName, version]);
}

/** Whether this order is being recorded right now, by any card or the checkout (this tab). */
export function useRecordingOrder(orderUid: string | null | undefined): boolean {
  const snapshot = useCallback(() => (orderUid ? isRecordingOrder(orderUid) : false), [orderUid]);
  return useSyncExternalStore(subscribePendingOrders, snapshot, snapshot);
}
