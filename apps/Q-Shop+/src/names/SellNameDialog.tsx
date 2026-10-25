/**
 * Selling one of the viewer's names: at a price on chain (SELL_NAME, as the
 * Names app sells), or by auction (names/auctions.ts: a listing published
 * under the name). The name's content goes with it, so the dialog says what
 * that is. The Names app's rules about primary names stay: the primary name
 * can't be sold while the account has other names, and selling an account's
 * only name warns about private groups' keys.
 */
import { useState } from "react";
import { Alert, Box, Button, FormControlLabel, InputAdornment, MenuItem, Radio, RadioGroup, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ShortUniqueId from "short-unique-id";
import { ResponsiveDialog } from "../components/common/mobile";
import { NameAvatar } from "../components/common/NameAvatar";
import { selectMenuProps } from "../components/common/menuStyle";
import { auctionFromForm, defaultAuctionValues, parseAmount, sanitizeAmountInput, type AuctionFormValues } from "../seller/productDraft";
import { errorMessage, isHubDecline } from "../qdn/hubErrors";
import { invalidateQdnSearches } from "../qdn/search";
import { formatPrice } from "../money/pricing";
import { buildNameAuctionPublish, NAME_AUCTION_ID } from "./auctions";
import { sellName } from "./actions";
import { DateTimeField, dayKey } from "../components/common/DateTimeFields";

const auctionUid = new ShortUniqueId({ length: 8 });
export type NameSaleStatus = "free" | "forSale" | "auction" | "pending";

const STATUS_TEXT: Record<Exclude<NameSaleStatus, "free">, string> = {
  forSale: "already for sale",
  auction: "in an auction",
  pending: "waiting for the next block",
};

export function SellNameDialog({
  names,
  primary,
  statusOf,
  address,
  initial,
  onClose,
  onSent,
}: {
  names: string[];
  /** The account's primary name. */
  primary: string | null;
  statusOf: (name: string) => NameSaleStatus;
  address: string;
  initial?: string | null;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const blockedPrimary = (name: string) => name === primary && names.length > 1;
  const free = (name: string) => statusOf(name) === "free" && !blockedPrimary(name);
  const [chosen, setPicked] = useState<string>(() => (initial && free(initial) ? initial : names.find(free) ?? ""));
  // A name that can't be sold (it became pending, or listed elsewhere meanwhile) gives way to one that can.
  const picked = chosen && free(chosen) ? chosen : names.find(free) ?? "";
  const [how, setHow] = useState<"price" | "auction">("price");
  const [priceText, setPriceText] = useState("");
  const [auction, setAuction] = useState<AuctionFormValues>(() => defaultAuctionValues(Date.now()));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const onlyName = picked === primary && names.length === 1;

  const submit = async () => {
    if (busy || !picked) return;
    setProblem(null);
    if (how === "price") {
      const price = parseAmount(priceText);
      if (!(price > 0)) return setProblem("Type the price in QORT.");
      setBusy(true);
      const result = await sellName(picked, price);
      setBusy(false);
      if (result.kind === "sent") onSent(`Sent. ${picked} is for sale at ${formatPrice(price)} QORT once the next block confirms it.`);
      else if (result.kind === "failed") setProblem(result.message);
      return;
    }
    const now = Date.now();
    const built = auctionFromForm(auction, now, null);
    if ("problem" in built) return setProblem(built.problem);
    setBusy(true);
    try {
      await qortalRequest(buildNameAuctionPublish({ name: picked, owner: address, uid: auctionUid(), terms: built.terms, now }) as never);
      invalidateQdnSearches((url) => url.includes(NAME_AUCTION_ID));
      setBusy(false);
      onSent(`Your auction of ${picked} is published: it shows once QDN has it.`);
    } catch (error) {
      setBusy(false);
      if (!isHubDecline(error)) setProblem(errorMessage(error, "Couldn't publish the auction. Try again."));
    }
  };

  const setField = (key: keyof AuctionFormValues) => (value: string) => setAuction((prev) => ({ ...prev, [key]: value }));

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Sell a name"
      maxWidth="sm"
      busy={busy}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void submit()} disabled={busy || !picked}>
            {busy ? "Sending…" : how === "price" ? "List it for sale" : "Start the auction"}
          </Button>
        </>
      }
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography id="sell-name-which" sx={{ fontWeight: 700, mb: 1 }}>
            Which name
          </Typography>
          <RadioGroup value={picked} onChange={(e) => setPicked(e.target.value)} aria-labelledby="sell-name-which">
            {names.map((name) => {
              const status = statusOf(name);
              const why = blockedPrimary(name) ? "your primary name: sell your other names first" : status !== "free" ? STATUS_TEXT[status] : null;
              return (
                <FormControlLabel
                  key={name}
                  value={name}
                  disabled={!!why}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0, py: 0.5 }}>
                      <NameAvatar name={name} size={32} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{name}</Typography>
                        {(why || name === primary) && (
                          <Typography variant="body2" color="text.secondary">
                            {why ?? "your primary name"}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                  sx={{ m: 0, minHeight: 48 }}
                />
              );
            })}
          </RadioGroup>
          {!picked && (
            <Typography variant="body2" color="text.secondary">
              None of your names can be sold right now.
            </Typography>
          )}
        </Box>

        {picked && (
          <>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Everything published under {picked} goes to its buyer with it, and you can&apos;t publish as {picked} any more.
              </Typography>
            </Box>
            {onlyName && (
              <Alert severity="warning">
                {`${picked} is your only name, and your primary one. If you are an admin of a private group, selling it removes your keys for that group: have another admin re-encrypt the latest keys first.`}
              </Alert>
            )}
            <Box>
              <Typography id="sell-name-how" sx={{ fontWeight: 700, mb: 1 }}>
                How
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={how}
                onChange={(_, value: "price" | "auction" | null) => value && setHow(value)}
                aria-labelledby="sell-name-how"
                sx={{ "& .MuiToggleButton-root": { minHeight: 44, px: 2.5, textTransform: "none" } }}
              >
                <ToggleButton value="price">At a price</ToggleButton>
                <ToggleButton value="auction">Auction</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {how === "price" ? (
              <TextField
                label="Price"
                value={priceText}
                onChange={(e) => setPriceText(sanitizeAmountInput(e.target.value))}
                helperText="Listed on chain, as the Names app lists names: anyone can buy it at this price until you take it off sale. Hub shows the fee."
                slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> } }}
                fullWidth
              />
            ) : (
              <Stack spacing={2}>
                <TextField
                  label="Starting bid"
                  value={auction.startingBid}
                  onChange={(e) => setField("startingBid")(sanitizeAmountInput(e.target.value))}
                  slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> } }}
                  fullWidth
                />
                <DateTimeField label="Ends" value={auction.end} onChange={(end) => setField("end")(end)} min={dayKey(new Date())} helperText="Bidding opens when it's published." required />
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
                  <TextField
                    label="Reserve (optional)"
                    value={auction.reserve}
                    onChange={(e) => setField("reserve")(sanitizeAmountInput(e.target.value))}
                    helperText="The least you sell for; bidders only see whether it's met."
                    slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> } }}
                  />
                  <TextField
                    label="Buy now (optional)"
                    value={auction.buyNow}
                    onChange={(e) => setField("buyNow")(sanitizeAmountInput(e.target.value))}
                    helperText="A bid of this wins at once."
                    slotProps={{ htmlInput: { inputMode: "decimal", autoComplete: "off" }, input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> } }}
                  />
                </Box>
                <TextField
                  select
                  label="A late bid adds"
                  value={auction.extendMinutes}
                  onChange={(e) => setField("extendMinutes")(e.target.value)}
                  slotProps={{ select: { MenuProps: selectMenuProps } }}
                  helperText="A bid in the last minutes moves the end, so no one wins by bidding at the last second."
                >
                  {["0", "2", "5", "10"].map((m) => (
                    <MenuItem key={m} value={m}>
                      {m === "0" ? "Nothing (off)" : `${m} minutes`}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="body2" color="text.secondary">
                  {`The auction is published under ${picked}, so only its owner can run it. When it ends, you list the name at the winning bid and the winner buys it here.`}
                </Typography>
              </Stack>
            )}
          </>
        )}
        {problem && (
          <Alert severity="error" role="alert">
            {problem}
          </Alert>
        )}
      </Stack>
    </ResponsiveDialog>
  );
}
