import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../state/store";
import type { DeliveredInfo, ForeignApp, Order, OrderListKind, OrderOpenState, OrderStatusInfo } from "../state/features/orderSlice";
import { shownStatus } from "./status";

/**
 * One row of an order list: the search row, the order once opened, and its
 * status once read, as it shows ("Delivered" once the buyer said so).
 */
export interface OrderListItem {
  row: Order;
  order: Order | null;
  openState: OrderOpenState | null;
  status: OrderStatusInfo | null;
  /** The buyer's confirmation: null when there is none, undefined while not known. */
  delivered?: DeliveredInfo | null;
  /** Another app's order (openState "foreign"): the app it came from. */
  foreignApp?: ForeignApp;
}

const selectHashMap = (state: RootState) => state.order.hashMapOrders;
const selectOpenState = (state: RootState) => state.order.openState;
const selectStatuses = (state: RootState) => state.order.statuses;
const selectDelivered = (state: RootState) => state.order.delivered;
const selectForeignApps = (state: RootState) => state.order.foreignApps;

function itemsOf(
  rows: Order[],
  hashMap: Record<string, Order>,
  openState: Record<string, OrderOpenState>,
  statuses: Record<string, OrderStatusInfo>,
  delivered: Record<string, DeliveredInfo | null>,
  foreignApps: Record<string, ForeignApp>
): OrderListItem[] {
  return rows.map((row) => {
    const opened = hashMap[row.id];
    const foreignApp = openState[row.id] === "foreign" ? foreignApps[row.id] : undefined;
    return {
      row,
      // An order under the same id from another name is not this row's order.
      order: opened && opened.user === row.user ? opened : null,
      openState: openState[row.id] ?? null,
      status: shownStatus(statuses[row.id] ?? null, delivered[row.id]),
      delivered: delivered[row.id],
      ...(foreignApp && { foreignApp }),
    };
  });
}

export const selectBuyerItems = createSelector(
  [(state: RootState) => state.order.myOrders, selectHashMap, selectOpenState, selectStatuses, selectDelivered, selectForeignApps],
  itemsOf
);

export const selectSellerItems = createSelector(
  [(state: RootState) => state.order.orders, selectHashMap, selectOpenState, selectStatuses, selectDelivered, selectForeignApps],
  itemsOf
);

export function selectItems(kind: OrderListKind) {
  return kind === "buyer" ? selectBuyerItems : selectSellerItems;
}
