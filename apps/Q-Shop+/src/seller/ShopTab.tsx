/**
 * The seller's Shop tab: the shop as buyers see its details, the coins and
 * assets it takes with their payout addresses, Edit shop (the same dialog as
 * on the shop page), and Advanced → Recreate shop data.
 */
import { useState, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { RootState } from "../state/store";
import EditStoreModal from "../components/modals/EditStoreModal";
import { CoinIcon } from "../components/money/CoinIcon";
import { COINS, FOREIGN_TICKERS, assetCoinId } from "../money/coins";
import { SectionTitle } from "./ShopForm";
import { RecreateShopDataDialog } from "./RecreateShopDataDialog";

/** `zs1abcd…wxyz`: enough to recognise an address without a line of its own. */
export function shortAddress(address: string): string {
  const a = address.trim();
  return a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}

const Card = ({ children, label }: { children: ReactNode; label: string }) => (
  <Box
    component="section"
    aria-label={label}
    sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
  >
    {children}
  </Box>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
    <Typography sx={{ overflowWrap: "anywhere" }}>{children}</Typography>
  </Box>
);

export function ShopTab() {
  const store = useSelector((state: RootState) => state.global.currentStore);
  const [editOpen, setEditOpen] = useState(false);
  const [recreateOpen, setRecreateOpen] = useState(false);
  if (!store) return null;
  const coins = FOREIGN_TICKERS.filter((t) => store.supportedCoins?.includes(t) && store.foreignCoins?.[t]?.trim());
  const missingAddress = FOREIGN_TICKERS.filter((t) => store.supportedCoins?.includes(t) && !store.foreignCoins?.[t]?.trim());
  const assets = store.acceptedAssets ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 760 }}>
      <Box>
        <SectionTitle as="h2">Details</SectionTitle>
        <Card label="Shop details">
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            {store.logo ? (
              <Box
                component="img"
                src={store.logo}
                alt={`${store.title} logo`}
                sx={{ width: 72, height: 72, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider", flexShrink: 0 }}
              />
            ) : null}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, overflowWrap: "anywhere" }}>{store.title}</Typography>
              <Typography color="text.secondary" sx={{ whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
                {store.description}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            <Field label="Location">{store.location || "—"}</Field>
            <Field label="Ships to">{store.shipsTo || "—"}</Field>
          </Box>
          <Box>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)} sx={{ minHeight: 44 }}>
              Edit shop
            </Button>
          </Box>
        </Card>
      </Box>

      <Box>
        <SectionTitle as="h2">Payments</SectionTitle>
        <Card label="Payments">
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
            <PayRow coin="QORT" name="QORT" detail="Paid to your Qortal address" />
            {coins.map((t) => (
              <PayRow key={t} coin={t} name={COINS[t].label} detail={`Paid to ${shortAddress(store.foreignCoins[t])}`} />
            ))}
            {assets.map((a) => (
              <PayRow key={a.id} coin={assetCoinId(a.id)} name={a.name || `Asset #${a.id}`} detail={`Asset #${a.id}, paid to your Qortal address`} />
            ))}
          </Box>
          {missingAddress.length > 0 && (
            <Typography variant="body2" color="text.secondary">
              {missingAddress.join(", ")} {missingAddress.length === 1 ? "is" : "are"} switched on without a payout address, so
              buyers can&apos;t pay in {missingAddress.length === 1 ? "it" : "them"}. Add the address in Edit shop.
            </Typography>
          )}
          <Box>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)} sx={{ minHeight: 44 }}>
              Edit payments
            </Button>
          </Box>
        </Card>
      </Box>

      <Box>
        <SectionTitle as="h2">Advanced</SectionTitle>
        <Card label="Advanced">
          <Typography variant="body2" color="text.secondary">
            If your products don&apos;t load or show wrongly, you can start your product list again. Every product disappears
            from your shop; orders and reviews stay.
          </Typography>
          <Box>
            <Button variant="outlined" color="error" onClick={() => setRecreateOpen(true)} sx={{ minHeight: 44 }}>
              Recreate shop data
            </Button>
          </Box>
        </Card>
      </Box>

      {editOpen && <EditStoreModal open={editOpen} storeId={store.id} onClose={() => setEditOpen(false)} />}
      {recreateOpen && <RecreateShopDataDialog open={recreateOpen} onClose={() => setRecreateOpen(false)} />}
    </Box>
  );
}

function PayRow({ coin, name, detail }: { coin: string; name: string; detail: string }) {
  return (
    <Box component="li" sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 40 }}>
      <CoinIcon coin={coin} size={22} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {detail}
        </Typography>
      </Box>
    </Box>
  );
}
