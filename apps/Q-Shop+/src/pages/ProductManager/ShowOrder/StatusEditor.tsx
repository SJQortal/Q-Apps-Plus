/**
 * The seller's status form inside the order dialog: Received / Shipped /
 * Refunded, the carrier and tracking number of a shipped order, and a note
 * for the buyer. The dialog's main button sends it
 * (ShowOrder); this holds the draft.
 */
import { Autocomplete, Box, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { ORDER_STATUSES, normalizeStatus } from "../../../orders/status";
import { CARRIERS, MAX_CARRIER, MAX_TRACKING_NUMBER } from "../../../orders/tracking";
import { autocompletePaperProps } from "../../../components/common/menuStyle";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";

export interface StatusDraft {
  status: string;
  note: string;
  /** A shipped order's carrier and tracking number (orders/tracking.ts). */
  carrier: string;
  trackingNumber: string;
}

export function StatusEditor({
  draft,
  onChange,
  disabled,
}: {
  draft: StatusDraft;
  onChange: (draft: StatusDraft) => void;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        value={normalizeStatus(draft.status)}
        onChange={(_, value: string | null) => {
          if (value) onChange({ ...draft, status: value });
        }}
        aria-label="Order status"
        disabled={disabled}
        sx={{
          "& .MuiToggleButton-root": {
            minHeight: 40,
            textTransform: "none",
            fontWeight: 600,
            [`@media ${PHONE_MEDIA}`]: { minHeight: 44 },
          },
        }}
      >
        {ORDER_STATUSES.map((status) => (
          <ToggleButton key={status} value={status}>
            {status}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {normalizeStatus(draft.status) === "Shipped" && (
        // The buyer gets it with a Copy button; the original app shows it in the note.
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 2fr) minmax(0, 3fr)" }, gap: 2 }}>
          <Autocomplete
            freeSolo
            disablePortal
            slotProps={{ paper: autocompletePaperProps }}
            options={CARRIERS as readonly string[]}
            inputValue={draft.carrier}
            onInputChange={(_, value) => onChange({ ...draft, carrier: value.slice(0, MAX_CARRIER) })}
            disabled={disabled}
            renderInput={(params) => <TextField {...params} label="Carrier (optional)" />}
          />
          <TextField
            label="Tracking number (optional)"
            value={draft.trackingNumber}
            onChange={(e) => onChange({ ...draft, trackingNumber: e.target.value })}
            disabled={disabled}
            slotProps={{ htmlInput: { maxLength: MAX_TRACKING_NUMBER, autoCapitalize: "characters", spellCheck: false, autoComplete: "off" } }}
          />
        </Box>
      )}
      <TextField
        label="Note for the buyer"
        value={draft.note}
        onChange={(e) => onChange({ ...draft, note: e.target.value })}
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        disabled={disabled}
        helperText="Delivery details, refund details… Only you and the buyer can read it."
      />
      <Typography variant="body2" color="text.secondary">
        Updating publishes a small encrypted note under your name. Hub asks you to confirm it and its fee.
      </Typography>
    </Box>
  );
}
