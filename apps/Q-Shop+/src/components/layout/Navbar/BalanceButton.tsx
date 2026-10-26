/**
 * Left of the account's name: its QORT (wallet/balances.ts), and a
 * tap away its ARRR and the Q-Assets the shops it has browsed take (Simon,
 * 2026-10-25). Settings can hide it (it's on the screen for anyone looking).
 * It narrows with the header (useHeaderFit.ts): last of all, the amount goes
 * and the QORT mark stays.
 */
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, CircularProgress, Divider, IconButton, Popover, Skeleton, Tooltip, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { RootState } from "../../../state/store";
import { CoinIcon } from "../../money/CoinIcon";
import { dropdownPaperSx } from "../../common/menuStyle";
import { assetCoinId, shopAssets, type ShopAsset, type ShopCoinSettings } from "../../../money/coins";
import { fetchAssetQuote } from "../../../money/assetRates";
import { readArrrBalance, refreshBalances, useBalances, useShowBalance } from "../../../wallet/balances";

/** 1,234.56 (a large amount), 12.3456, 0.00012345 (a small one). */
/** At least two decimals, as QORT amounts show everywhere ("7,000.60", not "7,000.6"). */
export function balanceText(amount: number): string {
  const digits = amount >= 1000 ? 2 : amount >= 1 ? 4 : 8;
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

/** The header's short form: two decimals, or up to four under one. */
function shortText(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: amount >= 1 ? 2 : 4 });
}

/** The Q-Assets the shops loaded so far take (their cards, pages and the cart), each once. */
function useAcceptedAssets(): ShopAsset[] {
  const stores = useSelector((state: RootState) => state.store.hashMapStores);
  const viewed = useSelector((state: RootState) => state.store.currentViewedStore);
  const current = useSelector((state: RootState) => state.global.currentStore);
  return useMemo(() => {
    const byId = new Map<number, ShopAsset>();
    for (const shop of [...Object.values(stores), viewed, current] as (ShopCoinSettings | null)[]) {
      for (const asset of shopAssets(shop)) if (!byId.get(asset.id)?.name) byId.set(asset.id, asset);
    }
    return [...byId.values()].sort((a, b) => (a.name || `#${a.id}`).localeCompare(b.name || `#${b.id}`));
  }, [stores, viewed, current]);
}

function Row({ coin, label, children }: { coin: string; label: string; children: React.ReactNode }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 1.25, minHeight: 44, px: 1 }}>
      <CoinIcon coin={coin} size={20} label={label} />
      <Typography sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: "anywhere" }}>{label}</Typography>
      <Box sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{children}</Box>
    </Box>
  );
}

/** "≈ 12.30 QORT": what an asset balance is worth on the Q-Assets trade portal (money/assetRates.ts), read once the menu shows it. */
function AssetWorth({ assetId, amount }: { assetId: number; amount: number }) {
  const [qort, setQort] = useState<number | null>(null);
  useEffect(() => {
    if (!(amount > 0)) return;
    let alive = true;
    fetchAssetQuote(assetId).then(
      (quote) => alive && setQort(quote ? quote.qort * amount : null),
      () => undefined
    );
    return () => {
      alive = false;
    };
  }, [assetId, amount]);
  if (qort === null) return null;
  return (
    <Typography variant="caption" color="text.secondary" component="div" title="At the Q-Assets trade portal's price">
      ≈ {balanceText(qort)} QORT
    </Typography>
  );
}

export function BalanceButton({ phone }: { phone: boolean }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const show = useShowBalance();
  const { balances, status, at, arrr } = useBalances(show ? user?.address : undefined);
  const assets = useAcceptedAssets();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!user?.address || !show) return null;
  const qort = balances?.get(0) ?? (balances ? 0 : null);
  const listId = "qp-balances";
  return (
    <>
      <Tooltip title="Your balances">
        <Button
          variant="outlined"
          color="inherit"
          className="qp-balance"
          onClick={(e) => {
            setAnchor(e.currentTarget);
            void refreshBalances(user.address);
          }}
          aria-haspopup="dialog"
          aria-expanded={!!anchor}
          aria-controls={anchor ? listId : undefined}
          aria-label={qort === null ? "Your balances" : `QORT balance: ${balanceText(qort)} QORT. Your balances`}
          startIcon={<CoinIcon coin="QORT" size={18} />}
          endIcon={phone ? undefined : <ExpandMoreIcon fontSize="small" sx={{ color: "text.secondary" }} />}
          sx={{
            flexShrink: 0,
            minHeight: phone ? 44 : 40,
            minWidth: 44,
            px: phone ? 1 : 1.25,
            borderRadius: 999,
            borderColor: "divider",
            textTransform: "none",
            fontWeight: 600,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
            "& .MuiButton-startIcon": { mr: 0.75 },
            "& .MuiButton-endIcon": { ml: 0.25 },
          }}
        >
          <Box component="span" className="qp-balance-amount">
            {qort !== null ? shortText(qort) : status === "failed" ? "–" : <Skeleton width={48} sx={{ display: "inline-block" }} />}
          </Box>
        </Button>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { id: listId, role: "dialog", "aria-label": "Your balances", sx: (theme: Theme) => ({ ...(dropdownPaperSx as (t: Theme) => object)(theme), width: 320, maxWidth: "calc(100vw - 24px)", p: 1 }) } }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, pb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            Your balances
          </Typography>
          <Tooltip title="Read them again">
            <IconButton aria-label="Read the balances again" onClick={() => void refreshBalances(user.address)} sx={{ width: 40, height: 40 }}>
              {status === "loading" ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <Box component="ul" aria-label="Coins" sx={{ listStyle: "none", m: 0, p: 0 }}>
          <Row coin="QORT" label="QORT">
            {qort !== null ? balanceText(qort) : status === "failed" ? "Couldn't be read" : <Skeleton width={70} />}
          </Row>
          <Row coin="ARRR" label="ARRR">
            {arrr.status === "ready" && arrr.amount !== undefined ? (
              balanceText(arrr.amount)
            ) : arrr.status === "loading" ? (
              <CircularProgress size={18} aria-label="Reading the ARRR balance" />
            ) : (
              // Hub asks before an app reads the ARRR wallet, so only on request.
              <Button size="small" onClick={() => void readArrrBalance()} sx={{ minHeight: 40 }}>
                {arrr.status === "failed" ? "Try again" : "Show"}
              </Button>
            )}
          </Row>
        </Box>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 0.5, fontWeight: 600 }}>
          Q-Assets the shops take
        </Typography>
        {assets.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, pb: 1 }}>
            None of the shops you&apos;ve opened takes a Q-Asset.
          </Typography>
        ) : (
          <Box component="ul" aria-label="Q-Assets" sx={{ listStyle: "none", m: 0, p: 0, maxHeight: 260, overflowY: "auto" }}>
            {assets.map((asset) => {
              const amount = balances?.get(asset.id) ?? (balances ? 0 : null);
              const label = asset.name || `Asset #${asset.id}`;
              return (
                <Row key={asset.id} coin={assetCoinId(asset.id)} label={label}>
                  {amount !== null ? balanceText(amount) : status === "failed" ? "–" : <Skeleton width={50} />}
                  {amount !== null && <AssetWorth assetId={asset.id} amount={amount} />}
                </Row>
              );
            })}
          </Box>
        )}
        {at > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 1, pt: 1 }}>
            As of {new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}, confirmed on your node.
          </Typography>
        )}
      </Popover>
    </>
  );
}
