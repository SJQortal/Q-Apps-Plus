/**
 * The product form's auction terms (auctions/rules.ts): starting bid, when it
 * starts and ends (quick picks for the end), an optional reserve and buy-now
 * price, and how much a late bid extends it. All in QORT.
 */
import { Alert, Box, Button, InputAdornment, MenuItem, TextField, Typography } from "@mui/material";
import { CoinIcon } from "../components/money/CoinIcon";
import { selectMenuProps } from "../components/common/menuStyle";
import { useNow } from "../hooks/useNow";
import type { AuctionTerms } from "../auctions/rules";
import { sanitizeAmountInput, toLocalInput, type AuctionFormValues } from "./productDraft";

const DURATIONS = [1, 3, 7, 14];
const EXTENDS = [
  { value: "0", label: "Off" },
  { value: "2", label: "2 minutes" },
  { value: "5", label: "5 minutes" },
  { value: "10", label: "10 minutes" },
];

const qortSlot = {
  htmlInput: { inputMode: "decimal" as const, autoComplete: "off" },
  input: {
    startAdornment: (
      <InputAdornment position="start">
        <CoinIcon coin="QORT" size={20} />
      </InputAdornment>
    ),
    endAdornment: <InputAdornment position="end">QORT</InputAdornment>,
  },
};

/** The end `days` after the start, or after now once that has passed (or it starts on publishing), to the hour. */
function endAfter(startText: string, days: number): string {
  const typed = startText.trim() ? new Date(startText).getTime() : NaN;
  const base = Number.isFinite(typed) ? Math.max(typed, Date.now()) : Date.now();
  return toLocalInput(Math.ceil((base + days * 86_400_000) / 3_600_000) * 3_600_000);
}

export function AuctionFields({
  value,
  onChange,
  saved = null,
}: {
  value: AuctionFormValues;
  onChange: (next: AuctionFormValues) => void;
  /** The auction as published, when editing one: once bidding starts its terms are the bidders' (productDraft.ts auctionFromForm). */
  saved?: AuctionTerms | null;
}) {
  const now = useNow(30_000);
  const running = !!saved && now >= saved.start && now < saved.end;
  const ended = !!saved && now >= saved.end;
  const set = <K extends keyof AuctionFormValues>(key: K, next: AuctionFormValues[K]) => onChange({ ...value, [key]: next });
  const endIn = (days: number) => set("end", endAfter(value.start, days));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {running && <Alert severity="info">Bidding has started, so its terms stay as bidders saw them: only the end can move, to later.</Alert>}
      {ended && (
        <Alert severity="info">
          This auction has ended. Leave its terms as they are to keep its result, or run it again: clear Starts (or set a new start) and set a new end; earlier
          bids then no longer count.
        </Alert>
      )}
      <TextField
        label="Starting bid"
        value={value.startingBid}
        onChange={(e) => set("startingBid", sanitizeAmountInput(e.target.value))}
        required
        fullWidth
        disabled={running}
        helperText="The lowest first bid. Each bid after it must beat the last by a small step."
        slotProps={qortSlot}
      />
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
        <TextField
          label="Starts"
          type="datetime-local"
          value={value.start}
          onChange={(e) => set("start", e.target.value)}
          fullWidth
          disabled={running}
          helperText="Empty: as soon as you publish it."
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Ends"
          type="datetime-local"
          value={value.end}
          onChange={(e) => set("end", e.target.value)}
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Runs for
        </Typography>
        {DURATIONS.map((days) => (
          <Button key={days} variant="outlined" color="inherit" size="small" onClick={() => endIn(days)} sx={{ minHeight: 44 }}>
            {days === 1 ? "1 day" : `${days} days`}
          </Button>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(0, 1fr)" } }}>
        <TextField
          label="Reserve price"
          value={value.reserve}
          onChange={(e) => set("reserve", sanitizeAmountInput(e.target.value))}
          fullWidth
          disabled={running}
          helperText="Optional. The least you sell for; bidders only see whether it's reached."
          slotProps={qortSlot}
        />
        <TextField
          label="Buy-now price"
          value={value.buyNow}
          onChange={(e) => set("buyNow", sanitizeAmountInput(e.target.value))}
          fullWidth
          disabled={running}
          helperText="Optional. A bid of this much wins at once."
          slotProps={qortSlot}
        />
      </Box>
      <TextField
        select
        label="A late bid extends the auction by"
        value={value.extendMinutes}
        onChange={(e) => set("extendMinutes", e.target.value)}
        fullWidth
        disabled={running}
        helperText="A bid in the last minutes moves the end, so no one wins by bidding at the last second."
        slotProps={{ select: { MenuProps: selectMenuProps } }}
      >
        {EXTENDS.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="body2" color="text.secondary">
        Bids and the winner&apos;s payment are in QORT. Each bid is a small publish on QDN by the bidder. Q-Shop, the original app, shows this
        product as out of stock, so it can&apos;t be bought there at a fixed price.
      </Typography>
    </Box>
  );
}
