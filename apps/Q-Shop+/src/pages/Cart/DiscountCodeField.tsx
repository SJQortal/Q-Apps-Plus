/**
 * A discount code at checkout's Confirm (discounts/): "Have a discount
 * code?", then the code and Apply, with the reason when it doesn't apply;
 * once applied, which one, and Remove. What it takes off is a line of the
 * order above.
 */
import { useState, type FormEvent } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";

export function DiscountCodeField({
  applied,
  idle,
  onApply,
  onRemove,
  disabled = false,
}: {
  /** What's applied: "SPRING10", or a discount for the buyer's name. */
  applied: { label: string } | null;
  /** Applied, but it takes nothing off this order now (why). */
  idle?: string | null;
  /** Checks and applies a code; the reason when it doesn't apply. */
  onApply: (code: string) => Promise<string | null>;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (applied) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <LocalOfferOutlinedIcon fontSize="small" aria-hidden sx={{ color: "text.secondary" }} />
        <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
            {applied.label}
          </Typography>
          {idle && (
            <Typography variant="body2" color="text.secondary">
              {idle}
            </Typography>
          )}
        </Box>
        <Button color="inherit" onClick={onRemove} disabled={disabled} sx={{ minHeight: 44 }}>
          Remove
        </Button>
      </Box>
    );
  }
  if (!open) {
    return (
      <Box>
        <Button startIcon={<LocalOfferOutlinedIcon />} onClick={() => setOpen(true)} disabled={disabled} sx={{ minHeight: 44, ml: -1 }}>
          Have a discount code?
        </Button>
      </Box>
    );
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    const problem = await onApply(text);
    setBusy(false);
    setError(problem);
    if (!problem) {
      setText("");
      setOpen(false);
    }
  };
  return (
    <Box component="form" onSubmit={submit} noValidate sx={{ display: "flex", gap: 1, alignItems: "flex-start", flexWrap: "wrap" }}>
      <TextField
        label="Discount code"
        value={text}
        onChange={(e) => {
          setText(e.target.value.toUpperCase());
          setError(null);
        }}
        error={!!error}
        helperText={error ?? undefined}
        autoFocus
        slotProps={{ htmlInput: { maxLength: 30, autoCapitalize: "characters", autoComplete: "off", spellCheck: false } }}
        sx={{ flex: "1 1 180px" }}
      />
      <Button type="submit" variant="outlined" disabled={busy || disabled || !text.trim()} sx={{ minHeight: 56 }}>
        {busy ? "Checking…" : "Apply"}
      </Button>
    </Box>
  );
}
