/**
 * Where the shop's product index (data container) stands, when it isn't
 * simply loaded (hooks/useOwnShops.ts sets `global.ownShopStatus`):
 * - `container-missing`: the shop has none on QDN; the seller can create an
 *   empty one (Hub confirms). Nothing is ever published without asking: the
 *   original published one at start-up (docs/apps/Q-Shop+.md → Bugs 2).
 * - `unavailable`: it exists but the node can't serve it yet: "Fetching from
 *   peers…", asked again after 2, 4 and 8 seconds, then Retry.
 * - `error`: the shop itself couldn't be read: Retry.
 */
import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import type { OwnShopStatus } from "../state/features/globalSlice";
import { RecreateShopDataDialog } from "./RecreateShopDataDialog";

/** Waits before each automatic retry, in ms. Tests shorten them. */
export const productListRetryDelays = { ms: [2_000, 4_000, 8_000] };

export function ProductListStatus({ status, onReload }: { status: OwnShopStatus; onReload: () => void }) {
  const [tries, setTries] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const autoRetrying = status === "unavailable" && tries < productListRetryDelays.ms.length;

  useEffect(() => {
    if (!autoRetrying) return;
    const timer = window.setTimeout(() => {
      setTries((n) => n + 1);
      onReload();
    }, productListRetryDelays.ms[tries]);
    return () => window.clearTimeout(timer);
  }, [autoRetrying, tries, onReload]);

  if (status === "container-missing") {
    return (
      <>
        <Alert
          severity="warning"
          action={
            <Button color="inherit" onClick={() => setCreateOpen(true)} sx={{ minHeight: 44, whiteSpace: "nowrap" }}>
              Create product list
            </Button>
          }
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography sx={{ fontWeight: 700 }}>Your shop has no product list on QDN yet</Typography>
          <Typography variant="body2">Products can&apos;t be added or shown until it has one.</Typography>
        </Alert>
        {createOpen && <RecreateShopDataDialog open={createOpen} mode="missing" onClose={() => setCreateOpen(false)} />}
      </>
    );
  }

  if (status === "unavailable" || status === "loading") {
    if (status === "loading" || autoRetrying) {
      return (
        <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}>
          <CircularProgress size={20} />
          <Typography>{tries > 0 || status === "unavailable" ? "Fetching your product list from peers…" : "Loading your product list…"}</Typography>
        </Box>
      );
    }
    return (
      <Alert
        severity="info"
        action={
          <Button color="inherit" onClick={onReload} sx={{ minHeight: 44 }}>
            Retry
          </Button>
        }
        sx={{ alignItems: "center" }}
      >
        <Typography sx={{ fontWeight: 700 }}>Your product list isn&apos;t on your node yet</Typography>
        <Typography variant="body2">It is on QDN; your node is still fetching it from peers. Try again in a minute.</Typography>
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" onClick={onReload} sx={{ minHeight: 44 }}>
            Retry
          </Button>
        }
        sx={{ alignItems: "center" }}
      >
        Couldn&apos;t load your shop from your node.
      </Alert>
    );
  }

  return null;
}
