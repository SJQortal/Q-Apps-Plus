/**
 * Cart parts the shop and product pages share: the header's cart button
 * with its count, and the "Added to cart · View cart" message.
 */
import { Badge, Button, IconButton, Snackbar, Tooltip } from "@mui/material";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import type { RootState } from "../../state/store";
import { allCartsItemCount } from "../../state/features/cartSlice";
import { PHONE_MEDIA } from "../../hooks/usePhoneLayout";

export function CartButton() {
  const navigate = useNavigate();
  const count = useSelector((state: RootState) => allCartsItemCount(state.cart.carts));
  const label = count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart";
  return (
    <Tooltip title="Cart">
      <IconButton aria-label={label} onClick={() => navigate("/cart")} sx={{ width: 44, height: 44 }}>
        {/*
          No badge at 0: a hidden MUI badge keeps its last number (a "0") as text, which axe
          counts as visible text missing from the name "Cart" (WCAG 2.5.3).
        */}
        {count > 0 ? (
          <Badge badgeContent={count} color="primary" max={99}>
            <ShoppingCartOutlinedIcon />
          </Badge>
        ) : (
          <ShoppingCartOutlinedIcon />
        )}
      </IconButton>
    </Tooltip>
  );
}

export interface AddedNotice {
  /** Changes with every add, so a second add restarts the timer. */
  at: number;
  title: string;
  quantity: number;
}

/** "Added to cart · View cart", above the phone's bottom bar (docs/QORTAL.md → pitfall 6). */
export function AddedToCartSnackbar({ notice, onClose }: { notice: AddedNotice | null; onClose: () => void }) {
  const navigate = useNavigate();
  const what = notice ? (notice.quantity > 1 ? `${notice.quantity} × ${notice.title}` : notice.title) : "";
  return (
    <Snackbar
      key={notice?.at}
      open={!!notice}
      autoHideDuration={5000}
      onClose={(_event, reason) => {
        if (reason !== "clickaway") onClose();
      }}
      message={what ? `Added to cart · ${what}` : "Added to cart"}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{
        [`@media ${PHONE_MEDIA}`]: { bottom: "calc(80px + env(safe-area-inset-bottom, 0px))" },
        "& .MuiSnackbarContent-message": { overflowWrap: "anywhere" },
      }}
      action={
        <Button
          color="inherit"
          sx={{ fontWeight: 700, minHeight: 44 }}
          onClick={() => {
            onClose();
            navigate("/cart");
          }}
        >
          View cart
        </Button>
      }
    />
  );
}
