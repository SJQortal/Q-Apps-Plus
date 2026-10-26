/**
 * The shop's fields, shared by Create shop and Edit shop: logo, title,
 * description, location, ships to, its policies (dispatch time, returns,
 * terms), the coins it takes (QORT always; ARRR with a payout address) and
 * the Q-Assets it accepts. Controlled: the dialog
 * holds the values (seller/shopFields.ts).
 */
import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Collapse,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ImageUploader from "../components/common/ImageUploader";
import { CoinIcon } from "../components/money/CoinIcon";
import { COINS, FOREIGN_TICKERS, type ForeignTicker, type ShopAsset } from "../money/coins";
import { isHubDecline } from "../qdn/hubErrors";
import { AssetPicker } from "./AssetPicker";
import { MAX_META_DESCRIPTION, MAX_SHOP_TITLE, SHOP_CARD_TEXT_WIDTH, addressWarning, type ShopFormValues } from "./shopFields";
import { ShipsToPicker } from "./ShipsToPicker";
import { autocompletePaperProps, selectMenuProps } from "../components/common/menuStyle";
import { DISPATCH_DAY_CHOICES, MAX_RETURNS_TEXT, MAX_TERMS_TEXT, RETURN_DAY_CHOICES } from "../shop/policies";
import { MAX_AWAY_NOTE } from "../shop/away";
import { LANGUAGES, MAX_LANGUAGES, languageName } from "../shop/languages";
import { ShopLinksField } from "../shop/ShopLinksField";
import { DateField, dayKey } from "../components/common/DateTimeFields";

const NOT_SAID = "none";

export const SectionTitle = ({ children, as = "h3" }: { children: string; as?: "h2" | "h3" }) => (
  <Typography
    component={as}
    sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}
  >
    {children}
  </Typography>
);

interface ShopFormProps {
  values: ShopFormValues;
  onChange: Dispatch<SetStateAction<ShopFormValues>>;
  onImageError: (message: string) => void;
}

export function ShopForm({ values, onChange, onImageError }: ShopFormProps) {
  const set = <K extends keyof ShopFormValues>(key: K, value: ShopFormValues[K]) => onChange((prev) => ({ ...prev, [key]: value }));
  const setAssets: Dispatch<SetStateAction<ShopAsset[]>> = (update) =>
    onChange((prev) => ({ ...prev, assets: typeof update === "function" ? update(prev.assets) : update }));
  const name = values.title.trim() || "Shop";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box component="section" aria-label="Logo" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <SectionTitle>Logo</SectionTitle>
        {values.logo ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box
              component="img"
              src={values.logo}
              alt={`${name} logo`}
              sx={{ width: 96, height: 96, objectFit: "contain", borderRadius: 1, border: 1, borderColor: "divider", bgcolor: "action.hover" }}
            />
            <Button color="inherit" startIcon={<DeleteOutlineOutlinedIcon />} onClick={() => set("logo", null)} sx={{ minHeight: 44 }}>
              Remove logo
            </Button>
          </Box>
        ) : (
          <ImageUploader label="Add shop logo" onPick={(img) => set("logo", img)} onError={onImageError} />
        )}
      </Box>

      <Box component="section" aria-label="Details" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionTitle>Details</SectionTitle>
        <TextField
          label="Title"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          required
          fullWidth
          slotProps={{ htmlInput: { maxLength: MAX_SHOP_TITLE } }}
          helperText={`${values.title.length}/${MAX_SHOP_TITLE}`}
        />
        <TextField
          label="Description"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          required
          fullWidth
          multiline
          minRows={3}
          maxRows={10}
        />
        <ShopLinksField links={values.links} onChange={(links) => set("links", links)} />
        <Box>
          <TextField
            label="Meta description"
            value={values.metaDescription}
            onChange={(e) => set("metaDescription", e.target.value.replace(/\s*\n\s*/g, " "))}
            fullWidth
            multiline
            minRows={2}
            maxRows={3}
            slotProps={{ htmlInput: { maxLength: MAX_META_DESCRIPTION } }}
            helperText={`The two lines under your shop in the Shops list, also found by its search. Left empty, the list shows the start of the description. ${values.metaDescription.length}/${MAX_META_DESCRIPTION}`}
          />
          {(values.metaDescription.trim() || values.description.trim()) && (
            <Box sx={{ mt: 1, p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, maxWidth: SHOP_CARD_TEXT_WIDTH + 24 }}>
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>
                In the Shops list
              </Typography>
              <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{values.title.trim() || "Your shop"}</Typography>
              {/* As the shop card shows it: two lines at its narrowest. */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}
              >
                {(values.metaDescription.trim() || values.description.trim()).slice(0, 180)}
              </Typography>
            </Box>
          )}
        </Box>
        <TextField label="Location" value={values.location} onChange={(e) => set("location", e.target.value)} required fullWidth />
        <ShipsToPicker
          value={values.shippingCountries}
          onChange={(codes) => set("shippingCountries", codes)}
          states={values.shippingStates}
          onStatesChange={(states) => set("shippingStates", states)}
          typed={values.shipsTo}
        />
      </Box>

      <Box component="section" aria-label="Policies" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <SectionTitle>Policies</SectionTitle>
        <Typography variant="body2" color="text.secondary">
          Buyers see these on your shop, your products and at checkout, before they pay. All optional.
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField
            select
            label="Dispatch time"
            value={values.dispatchDays ?? NOT_SAID}
            onChange={(e) => set("dispatchDays", e.target.value === NOT_SAID ? null : Number(e.target.value))}
            helperText="From payment to sending it off"
            slotProps={{ select: { MenuProps: selectMenuProps } }}
          >
            <MenuItem value={NOT_SAID}>Not said</MenuItem>
            {DISPATCH_DAY_CHOICES.map((days) => (
              <MenuItem key={days} value={days}>
                {days === 1 ? "1 working day" : `${days} working days`}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Returns"
            value={values.returnDays ?? NOT_SAID}
            onChange={(e) => set("returnDays", e.target.value === NOT_SAID ? null : Number(e.target.value))}
            helperText="How long after delivery a buyer can ask"
            slotProps={{ select: { MenuProps: selectMenuProps } }}
          >
            <MenuItem value={NOT_SAID}>Not said</MenuItem>
            {RETURN_DAY_CHOICES.map((days) => (
              <MenuItem key={days} value={days}>
                {days === 0 ? "No returns" : `Within ${days} days`}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <TextField
          label="Returns and refunds, in your words"
          value={values.returns}
          onChange={(e) => set("returns", e.target.value)}
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          placeholder="Unused items in their packaging; the buyer pays return postage; refunds in the coin paid."
          slotProps={{ htmlInput: { maxLength: MAX_RETURNS_TEXT } }}
          helperText={`${values.returns.length}/${MAX_RETURNS_TEXT}`}
        />
        <TextField
          label="Other terms"
          value={values.terms}
          onChange={(e) => set("terms", e.target.value)}
          fullWidth
          multiline
          minRows={2}
          maxRows={8}
          placeholder="Made to order; customs duties are the buyer's; message me before ordering more than 10."
          slotProps={{ htmlInput: { maxLength: MAX_TERMS_TEXT } }}
          helperText={`${values.terms.length}/${MAX_TERMS_TEXT}`}
        />
        <Autocomplete
          multiple
          disablePortal
          slotProps={{ paper: autocompletePaperProps }}
          options={LANGUAGES.map((l) => l.code)}
          getOptionLabel={(code) => languageName(code)}
          value={values.languages}
          onChange={(_, codes) => set("languages", codes.slice(0, MAX_LANGUAGES))}
          filterSelectedOptions
          renderInput={(params) => <TextField {...params} label="Languages you answer in" helperText="Buyers abroad see whether they can write to you." />}
        />
        <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}>
          <FormControlLabel
            control={<Switch checked={values.away} onChange={(e) => set("away", e.target.checked)} />}
            label="I'm away for a while"
            sx={{ minHeight: 44, mr: 0 }}
          />
          <Typography variant="body2" color="text.secondary">
            Buyers see it, and when you&apos;re back, before they pay; orders still come in.
          </Typography>
          <Collapse in={values.away} unmountOnExit>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(230px, 1fr) minmax(0, 1.6fr)" }, gap: 2, pt: 2 }}>
              <DateField
                label="Back on (optional)"
                value={values.awayUntil}
                onChange={(day) => set("awayUntil", day)}
                min={dayKey(new Date())}
                helperText="It goes away by itself after that day"
              />
              <TextField
                label="Note for buyers (optional)"
                value={values.awayNote}
                onChange={(e) => set("awayNote", e.target.value.replace(/\s*\n\s*/g, " "))}
                multiline
                maxRows={3}
                slotProps={{ htmlInput: { maxLength: MAX_AWAY_NOTE } }}
                helperText={`${values.awayNote.length}/${MAX_AWAY_NOTE}`}
                placeholder="At a craft fair; messages answered in the evenings."
              />
            </Box>
          </Collapse>
        </Box>
      </Box>

      <Box component="section" aria-label="Payments" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <SectionTitle>Payments</SectionTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 44 }}>
          <CoinIcon coin="QORT" size={22} />
          <Box>
            <Typography sx={{ fontWeight: 600 }}>QORT</Typography>
            <Typography variant="body2" color="text.secondary">
              Always accepted, paid to your Qortal address.
            </Typography>
          </Box>
        </Box>
        {FOREIGN_TICKERS.map((ticker) => (
          <PaymentRow
            key={ticker}
            ticker={ticker}
            on={values.coins[ticker]}
            address={values.addresses[ticker]}
            onToggle={(on) => onChange((prev) => ({ ...prev, coins: { ...prev.coins, [ticker]: on } }))}
            onAddress={(address) => onChange((prev) => ({ ...prev, addresses: { ...prev.addresses, [ticker]: address } }))}
          />
        ))}
      </Box>

      <Box component="section" aria-label="Q-Assets" sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <SectionTitle>Q-Assets</SectionTitle>
        <Typography variant="body2" color="text.secondary">
          Qortal assets buyers can pay with, sent to your Qortal address.
        </Typography>
        <AssetPicker assets={values.assets} onChange={setAssets} />
      </Box>
    </Box>
  );
}

function PaymentRow({
  ticker,
  on,
  address,
  onToggle,
  onAddress,
}: {
  ticker: ForeignTicker;
  on: boolean;
  address: string;
  onToggle: (on: boolean) => void;
  onAddress: (address: string) => void;
}) {
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const warning = on ? addressWarning(ticker, address) : null;

  const fillFromWallet = async () => {
    setNote(null);
    setReading(true);
    try {
      const res = await qortalRequest({ action: "GET_USER_WALLET", coin: ticker });
      if (res?.address) onAddress(String(res.address));
      else setNote(`Hub didn't give a ${ticker} address. Paste it instead.`);
    } catch (error) {
      if (!isHubDecline(error)) setNote(`Couldn't read your ${ticker} wallet from Hub. Paste the address instead.`);
    } finally {
      setReading(false);
    }
  };

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", pt: 1 }}>
      <FormControlLabel
        control={<Switch checked={on} onChange={(e) => onToggle(e.target.checked)} />}
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CoinIcon coin={ticker} size={22} />
            <span>Accept {COINS[ticker].label}</span>
          </Box>
        }
        sx={{ minHeight: 44, mr: 0 }}
      />
      <Collapse in={on} unmountOnExit>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 1, pb: 1 }}>
          <TextField
            label={`${ticker} payout address`}
            value={address}
            onChange={(e) => onAddress(e.target.value)}
            required
            fullWidth
            helperText={`Buyers paying in ${ticker} send to this address.`}
            slotProps={{ htmlInput: { autoComplete: "off", autoCapitalize: "off", spellCheck: false } }}
          />
          <Box>
            <Button
              variant="outlined"
              onClick={() => void fillFromWallet()}
              disabled={reading}
              startIcon={reading ? <CircularProgress size={18} /> : <AccountBalanceWalletOutlinedIcon />}
              sx={{ minHeight: 44 }}
            >
              Use my {ticker} wallet address
            </Button>
          </Box>
          {warning && <Alert severity="warning">{warning}</Alert>}
          {note && <Alert severity="info">{note}</Alert>}
        </Box>
      </Collapse>
    </Box>
  );
}
