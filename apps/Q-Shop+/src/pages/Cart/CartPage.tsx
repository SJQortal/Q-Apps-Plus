/**
 * The cart, as a page at /cart. Round 2 replaces the old modal with a real
 * page; until then this shows the old cart and leaves when it closes.
 */
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../state/store";
import { setIsOpen } from "../../state/features/cartSlice";
import { Cart } from "./Cart";

export function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isOpen = useSelector((state: RootState) => state.cart.isOpen);
  const wasOpen = useRef(false);
  useEffect(() => {
    dispatch(setIsOpen(true));
  }, [dispatch]);
  useEffect(() => {
    if (isOpen) wasOpen.current = true;
    else if (wasOpen.current) navigate("/");
  }, [isOpen, navigate]);
  return <Cart />;
}

export default CartPage;
