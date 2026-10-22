/**
 * Everything about a shop: its description (plain text, never HTML), when it
 * opened, where it is and ships to, the coins it takes, and a way to message
 * the owner. Full screen on phones.
 */
import type { ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import { ResponsiveDialog } from "../../../components/common/mobile";
import { NameAvatar } from "../../../components/common/NameAvatar";
import { CoinIcon } from "../../../components/money/CoinIcon";
import { coinLabel, shopCoins, type ShopCoinSettings } from "../../../money/coins";
import { mailToLink } from "../../../qdn/links";

export interface ShopDetails extends ShopCoinSettings {
  title?: string;
  description?: string;
  logo?: string;
  location?: string;
  shipsTo?: string;
  created?: number | string;
}

export function formatShopDate(created: number | string | undefined): string {
  const time = typeof created === "string" ? Number(created) : created;
  if (!time || !Number.isFinite(time)) return "";
  return new Date(time).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "140px minmax(0, 1fr)" }, gap: { xs: 0.25, sm: 2 }, py: 1.25 }}>
      <Typography component="dt" variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}>
        {children}
      </Box>
    </Box>
  );
}

export function StoreDetails({
  open,
  onClose,
  shop,
  owner,
}: {
  open: boolean;
  onClose: () => void;
  shop: ShopDetails;
  owner: string;
}) {
  const title = shop.title || "Shop";
  const opened = formatShopDate(shop.created);
  const coins = shopCoins(shop);
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Shop details"
      maxWidth="sm"
      actions={
        <Button component="a" href={mailToLink(owner)} className="qortal-link" variant="contained" startIcon={<EmailOutlinedIcon />}>
          Message seller
        </Button>
      }
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        {shop.logo ? (
          <Box
            component="img"
            src={shop.logo}
            alt={`${title} logo`}
            sx={{ width: 64, height: 64, borderRadius: 2, objectFit: "cover", flexShrink: 0, bgcolor: "action.hover" }}
          />
        ) : null}
        <Typography component="p" sx={{ fontWeight: 700, fontSize: 20, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
      </Box>
      <Box component="dl" sx={{ m: 0, "& > div + div": { borderTop: 1, borderColor: "divider" } }}>
        <Row label="Owner">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <NameAvatar name={owner} size={24} />
            <span>{owner}</span>
          </Box>
        </Row>
        {shop.description ? (
          <Row label="About">
            <Typography sx={{ whiteSpace: "pre-wrap" }}>{shop.description}</Typography>
          </Row>
        ) : null}
        {opened ? <Row label="Opened">{opened}</Row> : null}
        {shop.location ? <Row label="Location">{shop.location}</Row> : null}
        {shop.shipsTo ? <Row label="Ships to">{shop.shipsTo}</Row> : null}
        <Row label="Accepts">
          <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {coins.map((coin) => (
              <Box component="li" key={coin} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                <CoinIcon coin={coin} size={20} label={coinLabel(coin, shop)} />
                {coinLabel(coin, shop)}
              </Box>
            ))}
          </Box>
        </Row>
      </Box>
    </ResponsiveDialog>
  );
}
