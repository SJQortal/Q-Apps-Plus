/**
 * The cart, as a page at /cart (it replaces the original's cart modal).
 * Pages still ask for the cart with `setIsOpen(true)`; GlobalWrapper sends
 * them here, and this page lowers the flag again so the next ask works.
 */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import { setIsOpen } from "../../state/features/cartSlice";
import { Page } from "../../components/layout/Page";
import { Cart } from "./Cart";

export function CartPage() {
  const dispatch = useDispatch();
  const isOpen = useSelector((state: RootState) => state.cart.isOpen);
  // Several shops get a summary beside their carts (Cart.tsx): room for both.
  const several = useSelector((state: RootState) => Object.keys(state.cart.carts).length > 1);
  useEffect(() => {
    if (isOpen) dispatch(setIsOpen(false));
  }, [isOpen, dispatch]);
  return (
    <Page width={several ? "grid" : "list"}>
      <Cart />
    </Page>
  );
}

export default CartPage;
