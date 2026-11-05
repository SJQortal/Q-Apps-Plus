/**
 * Arrange products (full screen on phones): the products in the order buyers
 * see them under "Collections", each with Move up and Move down, and Move to top or
 * bottom in its menu. Used for the whole shop (seller/useProductOrder.ts) and
 * for one collection's products (seller/CollectionEditor.tsx). Titles and
 * pictures come from the catalogues, read only for the products listed
 * (useCatalogueLoader); long lists show 30 at a time.
 *
 * Every move is said out loud and the focus stays on the product that moved.
 * Nothing is saved until Done; the caller publishes.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ProductImage } from "../components/common/ProductImage";
import { useSelector } from "react-redux";
import { Box, Button, IconButton, Menu, MenuItem, Skeleton, Tooltip, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import type { RootState } from "../state/store";
import { ResponsiveDialog } from "../components/common/mobile";
import { visuallyHiddenSx } from "../pages/Store/a11y";
import { statusOf as stockOf, type SellerRow } from "./productList";
import { useCatalogueLoader } from "./useCatalogueLoader";
import { dropdownPaperSx } from "../components/common/menuStyle";

/** Products listed at a time. */
export const ARRANGE_PAGE = 50;

type Control = "up" | "down" | "more";

function titleOf(details: Record<string, any> | undefined): string {
  return typeof details?.title === "string" ? details.title.trim() : "";
}

function pictureOf(details: Record<string, any> | undefined): string | undefined {
  const images: unknown[] = Array.isArray(details?.images) ? details.images : [];
  const pic = images[typeof details?.mainImageIndex === "number" ? details.mainImageIndex : 0] ?? images[0];
  return typeof pic === "string" ? pic : undefined;
}

/** `list` with the item at `from` moved to `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

export function ArrangeDialog({
  title,
  intro,
  rows,
  doneLabel = "Done",
  onDone,
  onClose,
  onReset,
  resetLabel,
  busy = false,
  footer,
}: {
  title: string;
  intro: ReactNode;
  /** The products, in the order to start from. */
  rows: SellerRow[];
  doneLabel?: string;
  /** The new order (product ids); `reset` when the seller chose the reset and moved nothing since. */
  onDone: (order: string[], reset: boolean) => void;
  onClose: () => void;
  /** The order the reset button goes back to (e.g. newest first); no button without it. */
  onReset?: () => string[];
  resetLabel?: string;
  /** Done is being worked on (e.g. a publish being prepared). */
  busy?: boolean;
  /** Under the list: an error or a note. */
  footer?: ReactNode;
}) {
  const owner = useSelector((state: RootState) => state.global.currentStore?.owner || state.auth.user?.name);
  const { request, statusOf, productOf } = useCatalogueLoader(owner);
  const byId = useMemo(() => new Map(rows.map((row) => [row.productId, row])), [rows]);
  const start = useMemo(() => rows.map((row) => row.productId), [rows]);
  const [order, setOrder] = useState<string[]>(start);
  const [reset, setReset] = useState(false);
  const [shown, setShown] = useState(ARRANGE_PAGE);
  const [announcement, setAnnouncement] = useState("");
  const [menu, setMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);
  const controls = useRef(new Map<string, HTMLElement | null>());
  const focusAfter = useRef<{ id: string; control: Control } | null>(null);
  const changed = reset || order.join("\n") !== start.join("\n");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const requestClose = () => (changed ? setConfirmDiscard(true) : onClose());

  const visible = order.slice(0, shown);
  const visibleKey = [...new Set(visible.map((id) => byId.get(id)?.catalogueId).filter(Boolean))].join("|");
  useEffect(() => {
    if (visibleKey) request(visibleKey.split("|"));
  }, [visibleKey, request]);

  useEffect(() => {
    const wanted = focusAfter.current;
    if (!wanted) return;
    focusAfter.current = null;
    const pick = (control: Control) => controls.current.get(`${wanted.id}\n${control}`);
    const usable = (el: HTMLElement | null | undefined) => !!el && !(el as HTMLButtonElement).disabled;
    const target = [pick(wanted.control), pick("up"), pick("down"), pick("more")].find(usable);
    target?.focus();
  }, [order, shown]);

  const nameOf = (id: string) => {
    const row = byId.get(id);
    return (row && titleOf(productOf(row.catalogueId, row.productId))) || "Product";
  };

  const move = (id: string, to: number, control: Control) => {
    const from = order.indexOf(id);
    const next = moveItem(order, from, to);
    if (next === order) return;
    setOrder(next);
    setReset(false);
    const at = next.indexOf(id);
    // A product moved past the products shown comes into the list with them.
    if (at >= shown) setShown(Math.ceil((at + 1) / ARRANGE_PAGE) * ARRANGE_PAGE);
    setAnnouncement(`${nameOf(id)} moved to ${at + 1} of ${next.length}.`);
    focusAfter.current = { id, control };
  };

  const ref = (id: string, control: Control) => (el: HTMLElement | null) => {
    controls.current.set(`${id}\n${control}`, el);
  };

  return (
    <>
    <ResponsiveDialog
      open
      onClose={requestClose}
      title={title}
      maxWidth="sm"
      dismissible={false}
      busy={busy}
      actions={
        <>
          {onReset && (
            <Button
              color="inherit"
              onClick={() => {
                setOrder(onReset());
                setReset(true);
                setAnnouncement(`Back to ${resetLabel ?? "the first order"}.`);
              }}
              disabled={busy}
              sx={{ mr: "auto" }}
            >
              {resetLabel ?? "Reset"}
            </Button>
          )}
          <Button color="inherit" onClick={requestClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => onDone(order, reset)} disabled={busy || !changed}>
            {doneLabel}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {intro}
        </Typography>
        <Box component="ol" aria-label="Products in order" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
          {visible.map((id, i) => {
            const row = byId.get(id);
            const details = row ? productOf(row.catalogueId, row.productId) : undefined;
            const name = titleOf(details);
            const pic = pictureOf(details);
            const load = row ? statusOf(row.catalogueId) : "failed";
            const label = name || "Product";
            return (
              <Box
                component="li"
                key={id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                  minWidth: 0,
                }}
              >
                <Typography aria-hidden sx={{ width: 28, textAlign: "right", color: "text.secondary", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {i + 1}
                </Typography>
                <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover", flexShrink: 0 }}>
                  {pic && <ProductImage src={pic} alt="" />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box component="span" sx={visuallyHiddenSx}>{`${i + 1}. `}</Box>
                  {name ? (
                    <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere", lineHeight: 1.3 }}>{name}</Typography>
                  ) : load === "failed" || load === "ready" ? (
                    <Typography color="text.secondary">Untitled product</Typography>
                  ) : (
                    <Skeleton width="70%" />
                  )}
                  {row && (stockOf(row) === "OUT_OF_STOCK" || stockOf(row) === "AUCTION") && (
                    <Typography variant="body2" color="text.secondary">
                      {stockOf(row) === "AUCTION" ? "Auction" : "Out of stock"}
                    </Typography>
                  )}
                </Box>
                <Tooltip title="Move up">
                  <span>
                    <IconButton
                      ref={ref(id, "up")}
                      aria-label={`Move up: ${label}`}
                      onClick={() => move(id, i - 1, "up")}
                      disabled={i === 0 || busy}
                      sx={{ width: 44, height: 44 }}
                    >
                      <ArrowUpwardIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move down">
                  <span>
                    <IconButton
                      ref={ref(id, "down")}
                      aria-label={`Move down: ${label}`}
                      onClick={() => move(id, i + 1, "down")}
                      disabled={i === order.length - 1 || busy}
                      sx={{ width: 44, height: 44 }}
                    >
                      <ArrowDownwardIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <IconButton
                  ref={ref(id, "more")}
                  aria-label={`More moves: ${label}`}
                  aria-haspopup="menu"
                  onClick={(event) => setMenu({ anchor: event.currentTarget, id })}
                  disabled={busy || order.length < 3}
                  sx={{ width: 44, height: 44 }}
                >
                  <MoreVertIcon />
                </IconButton>
              </Box>
            );
          })}
        </Box>
        {order.length > shown && (
          <Button variant="outlined" onClick={() => setShown((n) => n + ARRANGE_PAGE)} sx={{ minHeight: 44 }}>
            Show more ({order.length - shown} more)
          </Button>
        )}
        {footer}
      </Box>
      <Menu anchorEl={menu?.anchor ?? null} open={!!menu} onClose={() => setMenu(null)} slotProps={{ paper: { sx: dropdownPaperSx } }}>
        <MenuItem
          disabled={!menu || order.indexOf(menu.id) === 0}
          onClick={() => {
            if (menu) move(menu.id, 0, "more");
            setMenu(null);
          }}
          sx={{ minHeight: 44 }}
        >
          Move to top
        </MenuItem>
        <MenuItem
          disabled={!menu || order.indexOf(menu.id) === order.length - 1}
          onClick={() => {
            if (menu) move(menu.id, order.length - 1, "more");
            setMenu(null);
          }}
          sx={{ minHeight: 44 }}
        >
          Move to bottom
        </MenuItem>
      </Menu>
      {/* Moves are said out loud: the rows change places without the focus leaving the product. */}
      <Box role="status" aria-live="polite" sx={visuallyHiddenSx}>
        {announcement}
      </Box>
    </ResponsiveDialog>
    <ResponsiveDialog
      open={confirmDiscard}
      onClose={() => setConfirmDiscard(false)}
      title="Discard the new order?"
      maxWidth="xs"
      actions={
        <>
          <Button color="inherit" onClick={() => setConfirmDiscard(false)}>
            Keep arranging
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setConfirmDiscard(false);
              onClose();
            }}
          >
            Discard
          </Button>
        </>
      }
    >
      <Typography>The order you set here will be lost.</Typography>
    </ResponsiveDialog>
    </>
  );
}
