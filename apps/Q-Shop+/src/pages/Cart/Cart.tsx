/**
 * The cart page's body: orders still to finish first, then every shop's
 * cart (newest first), each with its own coin, subtotal and checkout. The
 * original showed one shop's cart in a modal over the shop page, with the
 * coin picker only on the last step; carts now survive a reload and all of
 * them are here.
 */
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Snackbar } from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import type { RootState } from "../../state/store";
import {
  removeCartFromCarts,
  removeProductFromCart,
  restoreCartItem,
  setCartQuantity,
  type Order,
} from "../../state/features/cartSlice";
import type { CartLine } from "../../money/order";
import type { CheckoutBuyer } from "../../money/checkout";
import type { PendingOrder } from "../../money/pendingOrders";
import { PageHeader } from "../../components/layout/Page";
import { useShellActions } from "../../components/layout/shellState";
import { EmptyState } from "../../components/common/EmptyState";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";
import { CheckoutDialog } from "./CheckoutDialog";
import { PendingOrdersPanel } from "./PendingOrders";
import { ShopCart, type CheckoutGate } from "./ShopCart";
import { useCartData, type ShopCartView } from "./useCartData";
import { usePendingOrders } from "./usePendingOrders";
import { itemCount, type CartShop, type CartViewLine } from "./cartLines";

interface OpenCheckout {
  /** The cart being checked out: a shop is its owner plus its shop id. */
  storeId: string;
  storeOwner: string | null;
  shop: CartShop;
  lines: CartLine[];
  leftOut: number;
  /** Every line of the shop's cart is being bought (the cart goes once paid). */
  wholeCart: boolean;
}

interface RemovedLine {
  storeId: string;
  storeOwner: string | null;
  order: Order;
  index: number;
  lastUpdated: number;
  title: string;
}

export function Cart() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const { signIn, authenticating } = useShellActions();
  const carts = useSelector((state: RootState) => state.cart.carts);
  const { views, retryShop, retryLines } = useCartData(carts);
  const pending = usePendingOrders(user?.name);
  const [checkout, setCheckout] = useState<OpenCheckout | null>(null);
  const [removed, setRemoved] = useState<RemovedLine | null>(null);
  const [recorded, setRecorded] = useState<PendingOrder | null>(null);

  const buyer: CheckoutBuyer | null =
    user?.name && user.address && user.publicKey ? { name: user.name, address: user.address, publicKey: user.publicKey } : null;
  const gate: CheckoutGate = !user
    ? { allowed: false, reason: "Sign in to check out." }
    : !buyer
      ? { allowed: false, reason: "Orders are published under your Qortal name: register one in Hub to check out." }
      : { allowed: true };

  const items = views.reduce((sum, view) => sum + itemCount(Object.values(view.cart.orders)), 0);
  const subtitle =
    views.length > 0
      ? `${items} ${items === 1 ? "item" : "items"} from ${views.length} ${views.length === 1 ? "shop" : "shops"}`
      : undefined;

  const changeQuantity = (view: ShopCartView, line: CartViewLine, quantity: number) => {
    dispatch(setCartQuantity({ storeId: view.storeId, storeOwner: view.owner, productId: line.productId, quantity }));
  };

  const remove = (view: ShopCartView, line: CartViewLine) => {
    const order = view.cart.orders[line.productId];
    if (!order) return;
    setRemoved({
      storeId: view.storeId,
      storeOwner: view.cart.storeOwner,
      order: { ...order },
      index: Object.keys(view.cart.orders).indexOf(line.productId),
      lastUpdated: view.cart.lastUpdated,
      title: line.product?.title || "Item",
    });
    dispatch(removeProductFromCart({ storeId: view.storeId, storeOwner: view.owner, productId: line.productId }));
  };

  const undoRemove = () => {
    if (!removed) return;
    dispatch(
      restoreCartItem({
        storeId: removed.storeId,
        storeOwner: removed.storeOwner,
        order: removed.order,
        index: removed.index,
        lastUpdated: removed.lastUpdated,
      })
    );
    setRemoved(null);
  };

  const openCheckout = (view: ShopCartView, lines: CartLine[], leftOut: number) => {
    if (!view.shop || !buyer || lines.length === 0) return;
    setRecorded(null);
    setCheckout({
      storeId: view.storeId,
      storeOwner: view.owner,
      shop: view.shop,
      lines,
      leftOut,
      wholeCart: lines.length === Object.keys(view.cart.orders).length,
    });
  };

  /** Paid: the order now lives in pending orders until it's on QDN, so the bought lines leave the cart. */
  const onPaid = () => {
    if (!checkout) return;
    const { storeId, storeOwner } = checkout;
    if (checkout.wholeCart) {
      dispatch(removeCartFromCarts({ storeId, storeOwner }));
    } else {
      // Lines left out (not for sale right now) stay, still flagged.
      for (const line of checkout.lines) {
        dispatch(removeProductFromCart({ storeId, storeOwner, productId: line.productId }));
      }
    }
    if (removed?.storeId === storeId && removed.storeOwner === storeOwner) setRemoved(null);
  };

  return (
    <>
      <PageHeader title="Cart" subtitle={subtitle} />

      {!user && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={signIn} disabled={authenticating} sx={{ minHeight: 40 }}>
              {authenticating ? "Signing in…" : "Sign in"}
            </Button>
          }
        >
          Sign in to check out. Your cart stays on this device.
        </Alert>
      )}

      {recorded && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setRecorded(null)}
          action={
            <Button color="inherit" onClick={() => navigate("/my-orders")} sx={{ minHeight: 44 }}>
              View my orders
            </Button>
          }
        >
          Order recorded{recorded.store.title ? ` for ${recorded.store.title}` : ""}.
        </Alert>
      )}

      <PendingOrdersPanel orders={pending} onRecorded={setRecorded} />

      {views.length === 0 ? (
        <EmptyState
          icon={<ShoppingCartOutlinedIcon />}
          title="Your cart is empty"
          description="Add products from any shop: they stay here until you check out."
          actionLabel="Browse shops"
          onAction={() => navigate("/")}
        />
      ) : (
        views.map((view) => (
          <ShopCart
            key={view.key}
            view={view}
            gate={gate}
            onCheckout={openCheckout}
            onQuantity={changeQuantity}
            onRemove={remove}
            onRetryShop={retryShop}
            onRetryLines={retryLines}
          />
        ))
      )}

      {checkout && buyer && (
        <CheckoutDialog
          key={`${checkout.storeOwner ?? ""}\n${checkout.storeId}`}
          shop={checkout.shop}
          lines={checkout.lines}
          leftOut={checkout.leftOut}
          buyer={buyer}
          onClose={() => setCheckout(null)}
          onPaid={onPaid}
        />
      )}

      <Snackbar
        open={removed !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== "clickaway") setRemoved(null);
        }}
        message={removed ? `${removed.title} removed` : ""}
        action={
          <Button color="inherit" onClick={undoRemove} sx={{ minHeight: 44, fontWeight: 700 }}>
            Undo
          </Button>
        }
        // Above the phone's bottom bar (docs/QORTAL.md → pitfall 6).
        sx={{ [`@media ${PHONE_MEDIA}`]: { bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" } }}
      />
    </>
  );
}
