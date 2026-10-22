/**
 * The seller's received orders for their current shop (the Product
 * Manager's Orders tab).
 */
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import LazyLoad from "../../components/common/LazyLoad";
import { useFetchOrders } from "../../hooks/useFetchOrders";
import { OrderTable } from "./OrderTable/OrderTable";
import { ShowOrder } from "./ShowOrder/ShowOrder";

export function OrdersTab() {
  const orders = useSelector((state: RootState) => state.order.orders);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [order, setOrder] = useState<any>(null);
  const { getOrders } = useFetchOrders();
  const handleGetOrders = useCallback(async () => {
    await getOrders();
  }, [getOrders]);
  return (
    <>
      <ShowOrder isOpen={isOpen} setIsOpen={setIsOpen} order={order} from="ProductManager" />
      <OrderTable
        openOrder={(o) => {
          setOrder(o);
          setIsOpen(true);
        }}
        data={orders}
        from="ProductManager"
      ></OrderTable>
      <LazyLoad onLoadMore={handleGetOrders}></LazyLoad>
    </>
  );
}
