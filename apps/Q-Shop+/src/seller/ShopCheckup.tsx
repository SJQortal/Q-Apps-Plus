/**
 * The shop checkup card on the seller page's Overview (seller/checkup.ts):
 * what the shop still needs to use Q-Shop+ fully, each with a way to do it
 * (Fix categories, Edit shop, Delivery, Retire the delivery-fee products),
 * then what more it can do. Shops made in the original app see it first
 * thing; once every step is done it shrinks to a line that can be hidden.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Box, Button, LinearProgress, Paper, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import type { RootState } from "../state/store";
import { setProductsToSave } from "../state/features/globalSlice";
import { ResponsiveDialog } from "../components/common/mobile";
import { fetchDeliveryDoc } from "../delivery/deliveryDoc";
import { isFeeProduct, shopCheckup, type CheckupKey } from "./checkup";
import { FixCategoriesDialog } from "./FixCategoriesDialog";
import { editBase } from "./productDraft";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { isListedCategory } from "../constants/categories";
import type { SellerRow } from "./productList";
import type { SellerTab } from "../pages/ProductManager/sellerTabs";
import { visuallyHiddenSx } from "../pages/Store/a11y";
import { openWalkthrough } from "../onboarding/Walkthrough";

const HIDDEN_KEY = "qshopplus-checkup-hidden";
/** Catalogues read for titles and types (a shop has a few; past this the checkup works from the list alone). */
const MAX_CATALOGUES = 10;

function hiddenFor(storeId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[]).includes(storeId);
  } catch {
    return false;
  }
}

function hide(storeId: string): void {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as string[];
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...list, storeId])].slice(-50)));
  } catch {
    // Private windows: it shows again next time.
  }
}

/** Whether the shop has delivery prices (null while they are read; true when the node can't say, so nothing nags). */
function useHasDelivery(owner: string, storeId: string): boolean | null {
  const [found, setFound] = useState<{ key: string; has: boolean } | null>(null);
  const key = `${owner}\n${storeId}`;
  useEffect(() => {
    if (!owner || !storeId) return;
    let alive = true;
    fetchDeliveryDoc(owner, storeId).then(
      (doc) => alive && setFound({ key, has: !!doc }),
      () => alive && setFound({ key, has: true })
    );
    return () => {
      alive = false;
    };
  }, [owner, storeId, key]);
  return found?.key === key ? found.has : null;
}

export function ShopCheckup({
  storeId,
  onOpenTab,
  onAddProduct,
}: {
  storeId: string;
  onOpenTab?: (tab: SellerTab, extra?: Record<string, string>) => void;
  /** Opens Add product (the seller page's own dialog). */
  onAddProduct?: () => void;
}) {
  const dispatch = useDispatch();
  const store = useSelector((state: RootState) => state.global.currentStore);
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const rows = useSelector((state: RootState) => state.global.listProducts.products) as SellerRow[];
  const owner = store?.owner || name;
  const listLoaded = useSelector((state: RootState) => state.global.dataContainer?.storeId === storeId);
  const drafts = useSelector((state: RootState) => state.global.productsToSave) as Record<string, unknown>;
  const hasDelivery = useHasDelivery(owner, storeId);
  const { request, productOf } = useCatalogueLoader(owner);
  const listed = useMemo(() => rows.filter((r) => r.status !== "RETIRED"), [rows]);
  const catalogues = [...new Set(listed.map((r) => r.catalogueId))].slice(0, MAX_CATALOGUES).join("|");
  useEffect(() => {
    if (catalogues) request(catalogues.split("|"));
  }, [catalogues, request]);
  const [fixing, setFixing] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [drafted, setDrafted] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => hiddenFor(storeId));

  if (!store || store.id !== storeId) return null;
  const detailsOf = (row: SellerRow) => productOf(row.catalogueId, row.productId) as { title?: unknown; type?: unknown } | undefined;
  const items = shopCheckup({ shop: store, rows, detailsOf, hasDelivery, listLoaded });
  const done = items.filter((i) => i.done).length;
  const all = done === items.length;
  const oldRows = listed.filter((r) => !isListedCategory(r.category));
  const titleOf = (row: SellerRow) => {
    const t = detailsOf(row)?.title;
    return typeof t === "string" ? t : undefined;
  };
  const feeRows = listed.filter((r) => isFeeProduct(r, titleOf(r)));
  const examples = [...new Set(oldRows.map((r) => r.category?.trim()).filter(Boolean))].slice(0, 3).map((c) => `"${c}"`).join(", ");
  const editShop = () => onOpenTab?.("shop", { edit: "1" });

  const retire = () => {
    let count = 0;
    for (const row of feeRows) {
      // A product with edits waiting in Ready to publish keeps them.
      const base = editBase(row, detailsOf(row) as Record<string, unknown> | undefined, drafts);
      if (!base) continue;
      dispatch(setProductsToSave({ ...base, status: "RETIRED", isUpdate: true, user: name }));
      count++;
    }
    setRetiring(false);
    setDrafted(count === 1 ? "1 product is ready to publish, retired." : `${count} products are ready to publish, retired.`);
  };

  if (hidden && all) return null;

  const STEPS: Record<CheckupKey, { title: string; text: ReactNode; action?: ReactNode }> = {
    products: {
      title: "Add your first product",
      text: "A title, a category, a few pictures and a price; it waits in Ready to publish until you publish it.",
      action: (
        <Button variant="contained" onClick={() => (onAddProduct ? onAddProduct() : onOpenTab?.("products"))} sx={{ minHeight: 44 }}>
          Add product
        </Button>
      ),
    },
    categories: {
      title: "Pick categories from the list",
      text: `${oldRows.length === 1 ? "1 product still uses" : `${oldRows.length} products still use`} a category from before${examples ? ` (${examples})` : ""}. Buyers filter every shop by one shared list.`,
      action: (
        <Button variant="contained" onClick={() => setFixing(true)} sx={{ minHeight: 44 }}>
          Fix categories
        </Button>
      ),
    },
    details: {
      title: "Complete your shop's details",
      text: "A logo, a description and where you are.",
      action: (
        <Button variant="outlined" color="inherit" onClick={editShop} sx={{ minHeight: 44 }}>
          Edit shop
        </Button>
      ),
    },
    payments: {
      title: "Add your payout address",
      text: "Your shop takes a coin it has no address for, so buyers can't pay in it.",
      action: (
        <Button variant="outlined" color="inherit" onClick={editShop} sx={{ minHeight: 44 }}>
          Edit shop
        </Button>
      ),
    },
    shipsTo: {
      title: "Choose where you ship",
      text: `Tick the countries you deliver to, so buyers see it and checkout can tell them${store.shipsTo ? `. You typed "${store.shipsTo}": one tap turns it into countries.` : "."}`,
      action: (
        <Button variant="outlined" color="inherit" onClick={editShop} sx={{ minHeight: 44 }}>
          Choose countries
        </Button>
      ),
    },
    delivery: {
      title: "Set delivery prices",
      text: "Buyers pay delivery at checkout, by country or region. Add options like Express or Local pickup for them to pick from.",
      action: (
        <Button variant="outlined" color="inherit" onClick={() => onOpenTab?.("delivery")} sx={{ minHeight: 44 }}>
          Set delivery prices
        </Button>
      ),
    },
    policies: {
      title: "Say how you dispatch and take returns",
      text: "How soon an order leaves, whether you take returns and within how long, and any terms of yours. Buyers see them before they pay.",
      action: (
        <Button variant="outlined" color="inherit" onClick={editShop} sx={{ minHeight: 44 }}>
          Set policies
        </Button>
      ),
    },
    feeProducts: {
      title: "Retire your delivery-fee products",
      text: `${feeRows.length === 1 ? "1 product charges" : `${feeRows.length} products charge`} for delivery (${feeRows
        .map((r) => titleOf(r) || r.category)
        .slice(0, 3)
        .join(", ")}). With delivery prices, buyers pay it at checkout instead.`,
      action:
        hasDelivery === false ? (
          <Typography variant="body2" color="text.secondary">
            Set delivery prices first.
          </Typography>
        ) : (
          <Button variant="outlined" color="inherit" onClick={() => setRetiring(true)} sx={{ minHeight: 44 }}>
            Retire them
          </Button>
        ),
    },
  };

  return (
    <Paper component="section" aria-labelledby="shop-checkup-title" variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
          <Typography id="shop-checkup-title" component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
            {all ? "Your shop is up to date" : "Get your shop ready for Q-Shop+"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {all ? "Everything Q-Shop+ needs is set. More you can do:" : `${done} of ${items.length} done. Each step takes a minute.`}
          </Typography>
        </Box>
        <Button color="inherit" onClick={() => openWalkthrough("seller")} sx={{ minHeight: 44 }}>
          Seller guide
        </Button>
        {all && (
          <Button
            color="inherit"
            onClick={() => {
              hide(storeId);
              setHidden(true);
            }}
            sx={{ minHeight: 44 }}
          >
            Hide
          </Button>
        )}
      </Box>
      {!all && <LinearProgress variant="determinate" value={(done / items.length) * 100} aria-label={`${done} of ${items.length} steps done`} sx={{ height: 6, borderRadius: 3 }} />}
      {!all && (
        <Box component="ol" aria-label="Steps" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          {items.map((item) => {
            const step = STEPS[item.key];
            return (
              <Box component="li" key={item.key} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, flexWrap: "wrap", py: 0.75, borderTop: 1, borderColor: "divider" }}>
                {item.done ? <CheckCircleIcon color="success" sx={{ mt: 0.25 }} aria-hidden /> : <RadioButtonUncheckedIcon sx={{ mt: 0.25, color: "text.secondary" }} aria-hidden />}
                <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, textDecoration: item.done ? "line-through" : "none", color: item.done ? "text.secondary" : "text.primary" }}>
                    {step.title}
                    {item.done && <Box component="span" sx={visuallyHiddenSx}> (done)</Box>}
                  </Typography>
                  {!item.done && (
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {step.text}
                    </Typography>
                  )}
                </Box>
                {!item.done && step.action}
              </Box>
            );
          })}
        </Box>
      )}
      {all && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button variant="outlined" color="inherit" size="small" onClick={() => onOpenTab?.("collections")} sx={{ minHeight: 36 }}>
            Make collections
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => onOpenTab?.("products")} sx={{ minHeight: 36 }}>
            Arrange or count stock
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => onOpenTab?.("delivery")} sx={{ minHeight: 36 }}>
            Delivery options
          </Button>
          <Button variant="outlined" color="inherit" size="small" onClick={() => onOpenTab?.("shop")} sx={{ minHeight: 36 }}>
            Prices in USD
          </Button>
        </Box>
      )}
      {drafted && (
        <Alert
          severity="success"
          onClose={() => setDrafted(null)}
          action={
            <Button color="inherit" onClick={() => onOpenTab?.("products")} sx={{ minHeight: 44 }}>
              Publish them
            </Button>
          }
        >
          {`${drafted} Publish them together on the Products tab.`}
        </Alert>
      )}
      {fixing && (
        <FixCategoriesDialog
          rows={oldRows}
          onClose={() => setFixing(false)}
          onDrafted={(count) => {
            setFixing(false);
            setDrafted(count === 1 ? "1 product is ready to publish with its new category." : `${count} products are ready to publish with their new categories.`);
          }}
        />
      )}
      {retiring && (
        <ResponsiveDialog
          open
          onClose={() => setRetiring(false)}
          title="Retire the delivery-fee products?"
          maxWidth="xs"
          actions={
            <>
              <Button color="inherit" onClick={() => setRetiring(false)}>
                Keep them
              </Button>
              <Button variant="contained" onClick={retire}>
                Retire {feeRows.length === 1 ? "it" : "them"}
              </Button>
            </>
          }
        >
          <Typography>
            {feeRows.map((r) => titleOf(r) || r.category).join(", ")}: buyers no longer see {feeRows.length === 1 ? "it" : "them"}, and{" "}
            {feeRows.length === 1 ? "it stays" : "they stay"} in Products, where you can delete {feeRows.length === 1 ? "it" : "them"}. Your delivery prices
            charge delivery at checkout instead.
          </Typography>
        </ResponsiveDialog>
      )}
    </Paper>
  );
}
