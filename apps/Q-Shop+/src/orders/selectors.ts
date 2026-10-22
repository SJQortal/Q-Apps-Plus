import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "../state/store";
import type { Order, OrderListKind, OrderOpenState, OrderStatusInfo } from "../state/features/orderSlice";

/** One row of an order list: the search row, the order once opened, and its status once read. */
export interface OrderListItem {
  row: Order;
  order: Order | null;
  openState: OrderOpenState | null;
  status: OrderStatusInfo | null;
}

const selectHashMap = (state: RootState) => state.order.hashMapOrders;
const selectOpenState = (state: RootState) => state.order.openState;
const selectStatuses = (state: RootState) => state.order.statuses;

function itemsOf(
  rows: Order[],
  hashMap: Record<string, Order>,
  openState: Record<string, OrderOpenState>,
  statuses: Record<string, OrderStatusInfo>
): OrderListItem[] {
  return rows.map((row) => {
    const opened = hashMap[row.id];
    return {
      row,
      // An order under the same id from another name is not this row's order.
      order: opened && opened.user === row.user ? opened : null,
      openState: openState[row.id] ?? null,
      status: statuses[row.id] ?? null,
    };
  });
}

export const selectBuyerItems = createSelector(
  [(state: RootState) => state.order.myOrders, selectHashMap, selectOpenState, selectStatuses],
  itemsOf
);

export const selectSellerItems = createSelector(
  [(state: RootState) => state.order.orders, selectHashMap, selectOpenState, selectStatuses],
  itemsOf
);

export function selectItems(kind: OrderListKind) {
  return kind === "buyer" ? selectBuyerItems : selectSellerItems;
}
