/**
 * Settings (docs/DESIGN.md → Settings page): Account, Appearance, Shopping,
 * Sync and About, in that order. Every choice applies at once and is kept on
 * this device; Sync saves the theme and preferred coin to QDN only when asked.
 */
import { useId, useState, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Dialog, DialogTitle, IconButton, TextField, Tooltip, Typography, MenuItem } from "@mui/material";
import { styled } from "@mui/material/styles";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { ThemePicker, useHubTheme } from "../../hub-theme";
import type { RootState } from "../../state/store";
import { setPreferredCoin } from "../../state/features/storeSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import { BlockedNamesModal } from "../../components/common/BlockedNamesModal/BlockedNamesModal";
import { ChangelogDialog } from "../../components/common/ChangelogDialog";
import { BottomSheet } from "../../components/common/mobile/BottomSheet";
import { NameAvatar } from "../../components/common/NameAvatar";
import { Page, PageHeader } from "../../components/layout/Page";
import { NameSwitcher } from "../../components/layout/NameSwitcher";
import { useShellActions } from "../../components/layout/shellState";
import { APP_VERSION } from "../../constants/changelog";
import {
  APP_NAME,
  ORIGINAL_APP_LINK,
  ORIGINAL_APP_NAME,
  REPO_URL,
  UPSTREAM_REPO_URL,
} from "../../constants/plus";
import { COINS, coinLabel, type CoinTicker } from "../../money/coins";
import { isHubDecline, isHubTimeout } from "../../qdn/hubErrors";
import { PHONE_MEDIA, usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useSwitchActiveName } from "../../hooks/useUserAccount";
import { copyText } from "../../utils/clipboard";
import { collectSettingsSnapshot, fetchSettingsFromQdn, publishSettingsToQdn } from "../../utils/settingsQdn";
import { isProductView, setProductView, useProductView } from "../../utils/productView";
import { selectMenuProps } from "../../components/common/menuStyle";
import { saveDelivery, savedDelivery } from "../Cart/delivery";
import { showShop, useHiddenShops } from "../../discovery/hiddenShops";

/** The coins a buyer can prefer, in the order the shops offer them. */
export const PREFERRED_COINS: CoinTicker[] = ["QORT", "ARRR"];

const SectionTitle = styled("h2")(({ theme }) => ({
  margin: theme.spacing(0, 0, 1),
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
}));

const Card = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5, 2),
}));

/** A setting: what it is on the left, its control on the right (below it on narrow screens). */
const Row = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1, 2),
  flexWrap: "wrap",
  padding: theme.spacing(1.5, 0),
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
}));

const RowText = styled("div")({ flex: "1 1 240px", minWidth: 0 });

const Buttons = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexWrap: "wrap",
  [`@media ${PHONE_MEDIA}`]: { "& .MuiButton-root": { minHeight: 44 } },
}));

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id} sx={{ mb: 3 }}>
      <SectionTitle id={id}>{title}</SectionTitle>
      <Card>{children}</Card>
    </Box>
  );
}

function RowLabel({ title, children, id }: { title: string; children?: ReactNode; id?: string }) {
  return (
    <RowText>
      <Typography id={id} sx={{ fontWeight: 600, fontSize: 16 }}>
        {title}
      </Typography>
      {children && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14, mt: 0.25 }}>
          {children}
        </Typography>
      )}
    </RowText>
  );
}

/** "QBuyeR…7b1d0e": enough to recognise an address at a glance. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address;
}

export function SettingsPage() {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const { signIn, authenticating } = useShellActions();
  const user = useSelector((state: RootState) => state.auth.user);
  const preferredCoin = useSelector((state: RootState) => state.store.preferredCoin);
  // The address checkout kept for this name, if the buyer ticked it (pages/Cart/delivery.ts).
  const [forgotFor, setForgotFor] = useState<string | null>(null);
  const savedAddress = user?.name && forgotFor !== user.name ? savedDelivery(user.name) : null;
  const productView = useProductView();
  const { uiTheme, setUiTheme } = useHubTheme();
  const switchName = useSwitchActiveName();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const { list: hiddenShops } = useHiddenShops();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState<"save" | "restore" | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);
  const coinFieldId = useId();
  const viewFieldId = useId();

  const name = user?.name || "";
  const names = (user?.names ?? []).map((n) => n.name).filter(Boolean);
  const closeSwitcher = () => setSwitcherOpen(false);

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) {
      setCopyFailed(null);
      dispatch(setNotification({ msg: `${what} copied`, alertType: "success" }));
    } else {
      // Show the whole text, selectable, for a manual copy (the links are shown whole already).
      setCopyFailed(text);
      dispatch(setNotification({ msg: "Couldn't copy here. Select the text and copy it yourself.", alertType: "info" }));
    }
  };

  const saveToQdn = async () => {
    if (!name) return;
    setSyncBusy("save");
    try {
      await publishSettingsToQdn(name, collectSettingsSnapshot(uiTheme, preferredCoin, productView));
      setSyncNote(`Saved to QDN under ${name}.`);
      dispatch(setNotification({ msg: "Settings saved to QDN", alertType: "success" }));
    } catch (error) {
      if (isHubDecline(error)) setSyncNote("Save cancelled in Hub.");
      else if (isHubTimeout(error))
        setSyncNote("Hub didn't answer in time. If you confirmed the save, it will show up on QDN in a few minutes.");
      else {
        setSyncNote("The save failed; try again in a moment.");
        dispatch(setNotification({ msg: "Could not save settings to QDN", alertType: "error" }));
      }
    } finally {
      setSyncBusy(null);
    }
  };

  const restoreFromQdn = async () => {
    if (!name) return;
    setSyncBusy("restore");
    try {
      const result = await fetchSettingsFromQdn(name);
      if (result.kind === "none") {
        setSyncNote(`No settings saved on QDN for ${name} yet.`);
        return;
      }
      if (result.kind === "not-local") {
        setSyncNote("Your saved settings haven't reached this node yet. Try Restore again in a minute.");
        return;
      }
      if (result.kind === "error") {
        setSyncNote("Couldn't reach your node. Try again in a moment.");
        return;
      }
      const { theme, preferredCoin: coin, productView: view } = result.snapshot;
      if (!theme && !coin && !view) {
        setSyncNote("The saved settings are from a newer version; nothing here changed.");
        return;
      }
      if (theme) setUiTheme(theme);
      if (coin) dispatch(setPreferredCoin(coin));
      if (view) setProductView(view);
      const restored = [theme && "theme", coin && "preferred coin", view && "product view"].filter(Boolean) as string[];
      const list = restored.length > 1 ? `${restored.slice(0, -1).join(", ")} and ${restored.at(-1)}` : restored[0];
      setSyncNote(`Restored your ${list} from QDN.`);
      dispatch(setNotification({ msg: "Settings restored from QDN", alertType: "success" }));
    } finally {
      setSyncBusy(null);
    }
  };

  const coinOptions: string[] = PREFERRED_COINS.includes(preferredCoin as CoinTicker)
    ? PREFERRED_COINS
    : [...PREFERRED_COINS, preferredCoin];

  const switcher = (
    <NameSwitcher
      names={names}
      activeName={name || null}
      onPick={(picked) => {
        switchName(picked);
        closeSwitcher();
      }}
      autoFocusSearch={!phone}
      onEscape={closeSwitcher}
      // Phones: room in the 85dvh sheet for its title and the field. Desktop: two rows at least.
      maxListHeight={
        phone
          ? "min(55dvh, 440px, max(88px, calc(85dvh - 127px)))"
          : "max(88px, min(420px, calc(var(--qshare-app-height, 100dvh) - 200px)))"
      }
    />
  );

  return (
    <Page width="form">
      <PageHeader title="Settings" />

      <Section title="Account">
        {name ? (
          <Row>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0, flex: "1 1 240px" }}>
              <NameAvatar name={name} size={40} eager />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 14 }}>
                  The name you shop and sell as
                </Typography>
              </Box>
            </Box>
            {names.length > 1 && (
              <Buttons>
                <Button variant="outlined" aria-haspopup="dialog" onClick={() => setSwitcherOpen(true)}>
                  Switch name
                </Button>
              </Buttons>
            )}
          </Row>
        ) : (
          <Row>
            <RowLabel title={user ? "No Qortal name" : "Not signed in"}>
              {user
                ? "You are signed in without a Qortal name. Register one in Hub to buy or sell."
                : "Sign in with Qortal to buy, sell and see your orders. You can browse shops without signing in."}
            </RowLabel>
            {!user && (
              <Buttons>
                <Button variant="contained" onClick={signIn} disabled={authenticating}>
                  {authenticating ? "Signing in…" : "Sign in"}
                </Button>
              </Buttons>
            )}
          </Row>
        )}
        {user?.address && (
          <Row>
            <RowLabel title="Address" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
              <Typography
                component="span"
                title={user.address}
                sx={{ fontFamily: "monospace", fontSize: 14, overflowWrap: "anywhere" }}
              >
                {copyFailed === user.address ? user.address : shortAddress(user.address)}
              </Typography>
              <Tooltip title="Copy address">
                <IconButton
                  aria-label="Copy address"
                  onClick={() => copy(user.address, "Address")}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <ContentCopyOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Row>
        )}
      </Section>
      {phone ? (
        <BottomSheet open={switcherOpen} onClose={closeSwitcher} title="Switch name">
          {switcher}
        </BottomSheet>
      ) : (
        <Dialog open={switcherOpen} onClose={closeSwitcher} maxWidth="xs" fullWidth aria-labelledby="switch-name-title">
          <DialogTitle id="switch-name-title">Switch name</DialogTitle>
          <Box sx={{ pb: 1 }}>{switcher}</Box>
        </Dialog>
      )}

      <Section title="Appearance">
        <Box sx={{ py: 1.5 }}>
          <RowLabel title="Theme">
            Hub 3.0 and Q-Shop Classic follow Hub&apos;s light or dark mode; Black and White keep their own. Saved on this
            device.
          </RowLabel>
          <ThemePicker />
        </Box>
        <Row>
          <RowLabel title="Product lists" id={`${viewFieldId}-title`}>
            Shop pages and Products as a grid of pictures, or a list with more of each product. Automatic shows a list on phones
            and a grid elsewhere.
          </RowLabel>
          <TextField
            select
            size="small"
            id={viewFieldId}
            label="Show as"
            value={productView}
            onChange={(event) => isProductView(event.target.value) && setProductView(event.target.value)}
            slotProps={{ select: { MenuProps: selectMenuProps } }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="auto">Automatic</MenuItem>
            <MenuItem value="grid">Grid</MenuItem>
            <MenuItem value="list">List</MenuItem>
          </TextField>
        </Row>
      </Section>

      <Section title="Shopping">
        <Row>
          <RowLabel title="Preferred coin" id={`${coinFieldId}-title`}>
            Prices on shop pages show, and you pay, in this coin when the shop accepts it; otherwise in QORT.
          </RowLabel>
          <TextField
            select
            size="small"
            id={coinFieldId}
            label="Coin"
            value={preferredCoin}
            onChange={(event) => dispatch(setPreferredCoin(event.target.value))}
            slotProps={{ select: { MenuProps: selectMenuProps } }}
            sx={{ minWidth: 200 }}
          >
            {coinOptions.map((coin) => (
              <MenuItem key={coin} value={coin}>
                {COINS[coin as CoinTicker]?.label ?? coinLabel(coin)}
              </MenuItem>
            ))}
          </TextField>
        </Row>
        {savedAddress && (
          <Row>
            <RowLabel title="Saved delivery address">
              {[savedAddress.streetAddress, savedAddress.city, savedAddress.country].filter(Boolean).join(", ")}: kept in this browser for {user?.name}&apos;s next
              checkout (other Q-Apps in this Hub can read it).
            </RowLabel>
            <Buttons>
              <Button
                variant="outlined"
                onClick={() => {
                  if (!user?.name) return;
                  saveDelivery(user.name, null);
                  setForgotFor(user.name);
                }}
              >
                Forget it
              </Button>
            </Buttons>
          </Row>
        )}
        <Row>
          <RowLabel title="Blocked names">The block list Q-Shop shares with Q-Blog.</RowLabel>
          <Buttons>
            <Button
              variant="outlined"
              startIcon={<PersonOffOutlinedIcon />}
              onClick={() => setBlockedOpen(true)}
              disabled={!user}
            >
              Manage
            </Button>
          </Buttons>
        </Row>
        {hiddenShops.length > 0 && (
          // Shops hidden from the lists on this device (discovery/hiddenShops.ts).
          <Row>
            <RowLabel title="Hidden shops">
              {hiddenShops.length === 1 ? "1 shop isn't" : `${hiddenShops.length} shops aren't`} listed in Shops or Products on this device.
            </RowLabel>
            <Box component="ul" aria-label="Hidden shops" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
              {hiddenShops.map((shop) => (
                <Box component="li" key={`${shop.owner}\n${shop.shortStoreId}`} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography sx={{ flex: "1 1 160px", minWidth: 0, overflowWrap: "anywhere" }}>
                    {shop.title || shop.shortStoreId}{" "}
                    <Box component="span" sx={{ color: "text.secondary" }}>
                      by {shop.owner}
                    </Box>
                  </Typography>
                  <Button variant="outlined" onClick={() => showShop(shop.owner, shop.shortStoreId)} aria-label={`Show again: ${shop.title || shop.shortStoreId}`} sx={{ minHeight: 44 }}>
                    Show again
                  </Button>
                </Box>
              ))}
            </Box>
          </Row>
        )}
      </Section>

      <Section title="Sync">
        <Row>
          <RowLabel title="Settings on QDN">
            Save your theme, preferred coin and product view under your name, so another device can restore them. Saving publishes a
            small document: Hub asks you to confirm, and the usual fee applies.
          </RowLabel>
          <Buttons>
            <Button
              variant="outlined"
              startIcon={<CloudDownloadOutlinedIcon />}
              onClick={restoreFromQdn}
              disabled={!name || syncBusy !== null}
            >
              {syncBusy === "restore" ? "Restoring…" : "Restore"}
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={saveToQdn}
              disabled={!name || syncBusy !== null}
            >
              {syncBusy === "save" ? "Saving…" : "Save to QDN"}
            </Button>
          </Buttons>
        </Row>
        {/* Always in the page, so screen readers hear each new line. */}
        <Typography variant="body2" role="status" sx={{ fontSize: 14, pb: syncNote ? 1.5 : 0 }}>
          {syncNote ?? ""}
        </Typography>
      </Section>

      <Section title="About">
        <Row>
          <RowLabel title={`${APP_NAME} ${APP_VERSION}`}>
            Simon&apos;s version of Qortal&apos;s {ORIGINAL_APP_NAME}. It reads and writes the same shops, products, orders
            and reviews.
          </RowLabel>
          <Buttons>
            <Button variant="outlined" startIcon={<HistoryOutlinedIcon />} onClick={() => setChangelogOpen(true)}>
              What&apos;s new
            </Button>
          </Buttons>
        </Row>
        {ORIGINAL_APP_LINK && (
          <Row>
            <RowLabel title={`The original ${ORIGINAL_APP_NAME}`}>Opens in a new Hub tab.</RowLabel>
            <Buttons>
              <Button variant="outlined" component="a" href={ORIGINAL_APP_LINK} startIcon={<OpenInNewOutlinedIcon />}>
                Open {ORIGINAL_APP_NAME}
              </Button>
            </Buttons>
          </Row>
        )}
        {[
          { label: "Source", url: REPO_URL },
          { label: "Upstream", url: UPSTREAM_REPO_URL },
        ].map(({ label, url }) => (
          <Row key={label}>
            <RowLabel title={label}>
              <Box component="span" sx={{ overflowWrap: "anywhere", userSelect: "all" }}>
                {url}
              </Box>
            </RowLabel>
            <Tooltip title={`Copy the ${label.toLowerCase()} link`}>
              <IconButton
                aria-label={`Copy the ${label.toLowerCase()} link`}
                onClick={() => copy(url, `${label} link`)}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <ContentCopyOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Row>
        ))}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, pb: 1.5 }}>
          Hub doesn&apos;t open web links from apps; copy them into your browser.
        </Typography>
      </Section>

      {blockedOpen && <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />}
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Page>
  );
}

export default SettingsPage;
